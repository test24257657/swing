from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date

import pandas as pd

from app.ingestion.sources.cache import raw_cache_path

log = logging.getLogger("swing.ingest.bhavcopy")


@dataclass
class BhavRow:
    nse_symbol: str
    series: str
    d: date
    open: float
    high: float
    low: float
    close: float
    prev_close: float | None
    vwap: float | None
    volume: int
    trades: int | None
    turnover: float | None
    delivery_qty: int | None
    delivery_pct: float | None


# nselib column name -> our field. nselib occasionally renames these; keep the mapping in
# one place so a break is a one-line fix.
_COLS = {
    "SYMBOL": "nse_symbol",
    "SERIES": "series",
    "OPEN_PRICE": "open",
    "HIGH_PRICE": "high",
    "LOW_PRICE": "low",
    "CLOSE_PRICE": "close",
    "PREV_CLOSE": "prev_close",
    "AVG_PRICE": "vwap",
    "TTL_TRD_QNTY": "volume",
    "NO_OF_TRADES": "trades",
    "TURNOVER_LACS": "turnover_lacs",
    "DELIV_QTY": "delivery_qty",
    "DELIV_PER": "delivery_pct",
}


def _to_float(v) -> float | None:
    try:
        f = float(str(v).replace(",", "").strip())
        return f if pd.notna(f) else None
    except (ValueError, TypeError):
        return None


def _to_int(v) -> int | None:
    f = _to_float(v)
    return int(f) if f is not None else None


def fetch_bhavcopy(d: date, *, use_cache: bool = True) -> pd.DataFrame:
    """Full-market EOD bhavcopy with delivery data for ``d``.

    Writes the raw CSV to the raw cache first. Tries nselib, then jugaad-data. Raises if
    both fail (the caller records a failed ingestion run).
    """
    cache = raw_cache_path("bhavcopy", d.isoformat())
    if use_cache and cache.exists() and cache.stat().st_size > 0:
        log.info("bhavcopy %s from cache", d)
        return pd.read_csv(cache)

    df = _fetch_nselib(d)
    if df is None:
        df = _fetch_jugaad(d)
    if df is None:
        raise RuntimeError(f"bhavcopy unavailable for {d} from all sources")

    df.to_csv(cache, index=False)
    return df


def _fetch_nselib(d: date) -> pd.DataFrame | None:
    try:
        from nselib import capital_market

        raw = capital_market.bhav_copy_with_delivery(d.strftime("%d-%m-%Y"))
        return pd.DataFrame(raw)
    except Exception as exc:  # noqa: BLE001 - never let one source kill the job
        log.warning("nselib bhavcopy failed for %s: %s", d, exc)
        return None


def _fetch_jugaad(d: date) -> pd.DataFrame | None:
    try:
        from jugaad_data.nse import full_bhavcopy_raw

        raw = full_bhavcopy_raw(d)
        # newer jugaad returns the CSV text (or a file path); older returned a DataFrame
        if isinstance(raw, pd.DataFrame):
            return raw
        if isinstance(raw, str):
            import os
            from io import StringIO

            return pd.read_csv(raw) if os.path.exists(raw) else pd.read_csv(StringIO(raw))
        return pd.DataFrame(raw)
    except Exception as exc:  # noqa: BLE001
        log.warning("jugaad bhavcopy failed for %s: %s", d, exc)
        return None


def normalize(df: pd.DataFrame, d: date) -> list[BhavRow]:
    """Map a raw bhavcopy frame to typed rows. Unknown/renamed columns degrade to None
    rather than raising — a partial row beats a dropped symbol."""
    df = df.rename(columns={k: v for k, v in _COLS.items() if k in df.columns})
    rows: list[BhavRow] = []
    for r in df.to_dict("records"):
        series = str(r.get("series", "EQ")).strip().upper()
        if series not in {"EQ", "BE", "BZ"}:
            continue
        symbol = str(r.get("nse_symbol", "")).strip().upper()
        if not symbol:
            continue
        turnover_lacs = _to_float(r.get("turnover_lacs"))
        rows.append(
            BhavRow(
                nse_symbol=symbol,
                series=series,
                d=d,
                open=_to_float(r.get("open")) or 0.0,
                high=_to_float(r.get("high")) or 0.0,
                low=_to_float(r.get("low")) or 0.0,
                close=_to_float(r.get("close")) or 0.0,
                prev_close=_to_float(r.get("prev_close")),
                vwap=_to_float(r.get("vwap")),
                volume=_to_int(r.get("volume")) or 0,
                trades=_to_int(r.get("trades")),
                turnover=turnover_lacs * 1e5 if turnover_lacs is not None else None,
                delivery_qty=_to_int(r.get("delivery_qty")),
                delivery_pct=_to_float(r.get("delivery_pct")),
            )
        )
    return rows
