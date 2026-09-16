"""The rolling OHLC panel — the job's working store.

One parquet file: Nifty 500 × ~1 year of daily bars. The nightly run appends today's
bhavcopy and drops anything past the retention window. **The API never opens this file**;
it only reads the JSON artifacts derived from it.
"""

from __future__ import annotations

import logging
from datetime import date, timedelta

import pandas as pd

from jobs.config import PANEL_DAYS, PANEL_PATH, UNIVERSE_INDEX
from jobs.sources import bhavcopy, index_constituents

log = logging.getLogger("jobs.panel")

COLUMNS = ["date", "symbol", "open", "high", "low", "close", "prev_close",
           "volume", "turnover", "delivery_qty", "delivery_pct"]


def load() -> pd.DataFrame:
    if PANEL_PATH.exists():
        df = pd.read_parquet(PANEL_PATH)
        df["date"] = pd.to_datetime(df["date"])
        return df
    return pd.DataFrame(columns=COLUMNS)


def save(df: pd.DataFrame) -> None:
    PANEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.sort_values(["symbol", "date"]).reset_index(drop=True).to_parquet(PANEL_PATH, index=False)


# A real session never repeats the previous one: across the live panel 0 of ~2,900
# symbols share both close and volume day to day. A date where nearly all of them do
# is a holiday stamped with the prior session's file.
PHANTOM_SESSION_SHARE = 0.95


def drop_phantom_sessions(panel: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
    """Remove sessions that are byte-for-byte copies of the session before them.
    Heals a panel that was built before bhavcopy() learned to check the file's own date."""
    if panel.empty:
        return panel, []
    close = panel.pivot_table(index="date", columns="symbol", values="close")
    volume = panel.pivot_table(index="date", columns="symbol", values="volume")
    both = close.notna() & close.shift().notna()
    same = (close == close.shift()) & (volume == volume.shift()) & both
    share = same.sum(axis=1) / both.sum(axis=1).where(lambda n: n > 0)
    phantoms = list(share[share >= PHANTOM_SESSION_SHARE].index)
    if not phantoms:
        return panel, []
    return panel[~panel["date"].isin(phantoms)].reset_index(drop=True), [pd.Timestamp(d).date().isoformat() for d in phantoms]


def _sessions(end: date, back: int) -> list[date]:
    """Weekday candidates, newest first. Holidays simply return no bhavcopy."""
    out, d = [], end
    while len(out) < back:
        if d.weekday() < 5:
            out.append(d)
        d -= timedelta(days=1)
    return out


def build(end: date, backfill_days: int) -> tuple[pd.DataFrame, dict]:
    """Append every missing session up to ``end``. Returns (panel, stats)."""
    universe = set(index_constituents(UNIVERSE_INDEX)) if UNIVERSE_INDEX else set()
    panel, phantoms = drop_phantom_sessions(load())
    if phantoms:
        log.warning("panel: dropped phantom sessions (copies of the prior day): %s", phantoms)
    have = set(panel["date"].dt.date.unique()) if not panel.empty else set()

    wanted = [d for d in _sessions(end, backfill_days) if d not in have]
    wanted.sort()

    fetched, failed = [], []
    for d in wanted:
        df = bhavcopy(d)
        if df is None or df.empty:
            failed.append(d.isoformat())
            continue
        if universe:
            df = df[df["symbol"].isin(universe)]
        fetched.append(df)
        log.info("panel += %s (%s rows)", d, len(df))

    if fetched:
        # Never concat the empty placeholder frame — its object-dtype columns would
        # poison the numeric ones.
        parts = ([panel] if not panel.empty else []) + fetched
        panel = pd.concat(parts, ignore_index=True)

    if panel.empty:
        return panel, {"ok": False, "sessions_added": 0, "failed": failed}

    panel = panel.drop_duplicates(subset=["symbol", "date"], keep="last")
    # keep only the retention window
    cutoff = sorted(panel["date"].unique())[-PANEL_DAYS:]
    panel = panel[panel["date"].isin(cutoff)]

    stats = {
        "ok": True,
        "sessions_added": len(fetched),
        "failed": failed,
        "phantom_sessions_dropped": phantoms,
        "symbols": int(panel["symbol"].nunique()),
        "sessions": int(panel["date"].nunique()),
        "rows": len(panel),
    }
    return panel, stats


def wide(panel: pd.DataFrame, field: str) -> pd.DataFrame:
    """date × symbol matrix for one field — the shape every calculation wants."""
    return panel.pivot_table(index="date", columns="symbol", values=field).sort_index()


def latest_session(panel: pd.DataFrame) -> pd.Timestamp | None:
    return panel["date"].max() if not panel.empty else None
