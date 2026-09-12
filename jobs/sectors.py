"""Sector rotation — 1M/3M return ranking with rank deltas, plus a simplified relative
rotation graph (RS-ratio vs the benchmark, and its rate of change) for each sector index.

The RRG here is deliberately simpler than the classic JdK RS-Ratio/RS-Momentum (no
double-smoothing): X = a 30-session relative-performance ratio vs the benchmark, rebased
to 100; Y = that ratio's 10-week rate of change. Matches the plain-English definition
the UI shows in its own tooltip, not a from-scratch reimplementation of the JdK method.
"""

from __future__ import annotations

import logging

import pandas as pd

from jobs.charts import slug
from jobs.config import (
    RRG_MOMENTUM_SESSIONS,
    RRG_RS_WINDOW_SESSIONS,
    RRG_TAIL_POINTS,
    RRG_TAIL_STEP_SESSIONS,
    SECTOR_BENCHMARK,
    SECTOR_HISTORY_DAYS,
    SECTOR_INDICES,
    SECTOR_RANK_DELTA_SESSIONS,
    SECTOR_RETURN_1M_SESSIONS,
    SECTOR_RETURN_3M_SESSIONS,
)
from jobs.sources import index_constituents, index_history, symbol_names

log = logging.getLogger("jobs.sectors")


def _return_pct(close: pd.Series, sessions: int) -> float | None:
    if len(close) <= sessions:
        return None
    return round((close.iloc[-1] / close.iloc[-1 - sessions] - 1.0) * 100.0, 2)


def _return_as_of(close: pd.Series, sessions: int, back: int) -> float | None:
    """Same return window, measured as of `back` sessions ago — for rank deltas."""
    trimmed = close.iloc[: len(close) - back] if back > 0 else close
    return _return_pct(trimmed, sessions)


def _rs_tail(merged: pd.DataFrame) -> list[dict]:
    """Last RRG_TAIL_POINTS weekly (x=rs_ratio, y=rs_momentum) readings, oldest first."""
    needed = RRG_RS_WINDOW_SESSIONS + RRG_MOMENTUM_SESSIONS + RRG_TAIL_POINTS * RRG_TAIL_STEP_SESSIONS
    if len(merged) < needed:
        return []
    rel = merged["close_s"] / merged["close_b"]
    rs_ratio = rel / rel.shift(RRG_RS_WINDOW_SESSIONS) * 100.0
    rs_momentum = (rs_ratio / rs_ratio.shift(RRG_MOMENTUM_SESSIONS) - 1.0) * 100.0
    valid = rs_ratio.notna() & rs_momentum.notna()
    idx = merged.index[valid]
    if len(idx) == 0:
        return []
    tail = list(idx[-1 :: -RRG_TAIL_STEP_SESSIONS][:RRG_TAIL_POINTS][::-1])
    return [{"x": round(float(rs_ratio.iloc[i]), 2), "y": round(float(rs_momentum.iloc[i]), 2)} for i in tail]


def _constituent_rows(members: list[str], panel: pd.DataFrame, names: dict[str, str]) -> tuple[list[dict], int]:
    if panel.empty or not members:
        return [], 0
    latest = panel[panel["date"] == panel["date"].max()].set_index("symbol")
    rows: list[dict] = []
    advancers = 0
    for sym in members:
        if sym not in latest.index:
            continue
        bar = latest.loc[sym]
        close, prev = bar.get("close"), bar.get("prev_close")
        if pd.isna(close):
            continue
        chg = round((float(close) / float(prev) - 1.0) * 100.0, 2) if prev is not None and pd.notna(prev) and prev else None
        if chg is not None and chg > 0:
            advancers += 1
        rows.append({"symbol": sym, "name": names.get(sym, sym), "ltp": round(float(close), 2), "change_pct": chg})
    rows.sort(key=lambda r: r["change_pct"] if r["change_pct"] is not None else -999.0, reverse=True)
    return rows, advancers


def build(panel: pd.DataFrame) -> tuple[dict, dict]:
    bench_hist = index_history(SECTOR_BENCHMARK, SECTOR_HISTORY_DAYS)
    if bench_hist is None or bench_hist.empty:
        return {}, {"ok": False, "sectors_ok": 0, "sectors_total": len(SECTOR_INDICES)}
    bench_hist = bench_hist.sort_values("date").reset_index(drop=True)

    names = symbol_names()
    raw_rows: list[dict] = []
    failed: list[str] = []

    for sym in SECTOR_INDICES:
        hist = index_history(sym, SECTOR_HISTORY_DAYS)
        if hist is None or hist.empty:
            failed.append(sym)
            continue
        hist = hist.sort_values("date").reset_index(drop=True)
        close = hist["close"]

        merged = (
            pd.merge(hist[["date", "close"]], bench_hist[["date", "close"]], on="date", suffixes=("_s", "_b"))
            .sort_values("date")
            .reset_index(drop=True)
        )
        members = index_constituents(sym)
        constituents, advancers = _constituent_rows(members, panel, names)

        raw_rows.append(
            {
                "name": sym,
                "return_1m": _return_pct(close, SECTOR_RETURN_1M_SESSIONS),
                "return_3m": _return_pct(close, SECTOR_RETURN_3M_SESSIONS),
                "_return_1m_prior": _return_as_of(close, SECTOR_RETURN_1M_SESSIONS, SECTOR_RANK_DELTA_SESSIONS),
                "rs_tail": _rs_tail(merged),
                "stock_count": len(members),
                "advancers": advancers,
                "constituents": constituents,
            }
        )

    ranked_now = sorted((r for r in raw_rows if r["return_1m"] is not None), key=lambda r: r["return_1m"], reverse=True)
    for i, r in enumerate(ranked_now):
        r["rank"] = i + 1
    ranked_prior = sorted(
        (r for r in raw_rows if r["_return_1m_prior"] is not None), key=lambda r: r["_return_1m_prior"], reverse=True
    )
    prior_rank = {r["name"]: i + 1 for i, r in enumerate(ranked_prior)}

    sectors = []
    for r in raw_rows:
        rank = r.get("rank")
        prior = prior_rank.get(r["name"])
        sectors.append(
            {
                "name": r["name"],
                "slug": slug(r["name"]),
                "rank": rank,
                "rank_delta": (prior - rank) if (rank is not None and prior is not None) else None,
                "return_1m": r["return_1m"],
                "return_3m": r["return_3m"],
                "rs_tail": r["rs_tail"],
                "stock_count": r["stock_count"],
                "advancers": r["advancers"],
                "constituents": r["constituents"],
            }
        )
    sectors.sort(key=lambda s: (s["rank"] is None, s["rank"]))

    payload = {
        "as_of": bench_hist["date"].iloc[-1].date().isoformat(),
        "benchmark": SECTOR_BENCHMARK,
        "sectors": sectors,
    }
    stats = {"ok": bool(sectors), "sectors_ok": len(sectors), "sectors_total": len(SECTOR_INDICES), "failed": failed}
    log.info("sectors: %s of %s built (failed: %s)", len(sectors), len(SECTOR_INDICES), failed or "none")
    return payload, stats
