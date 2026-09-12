"""Indices screen — every broad-market + sector index in one list, with a category tag.
Chart artifacts come from jobs/charts.py's index branch; this module is just the list
metadata (value, change, category) shown before you open one.
"""

from __future__ import annotations

import logging

from jobs.charts import slug
from jobs.config import BROAD_INDICES, SECTOR_HISTORY_DAYS, SECTOR_INDICES
from jobs.sources import index_history

log = logging.getLogger("jobs.indices")

ALL_INDICES = list(dict.fromkeys(BROAD_INDICES + SECTOR_INDICES))


def build(days: int = SECTOR_HISTORY_DAYS) -> tuple[dict, dict]:
    rows: list[dict] = []
    as_of: str | None = None

    for sym in ALL_INDICES:
        hist = index_history(sym, days)
        if hist is None or hist.empty:
            continue
        hist = hist.sort_values("date").reset_index(drop=True)
        last = hist.iloc[-1]
        prev = hist.iloc[-2] if len(hist) > 1 else None
        change = float(last["close"] - prev["close"]) if prev is not None else None
        change_pct = (
            round((float(last["close"]) / float(prev["close"]) - 1.0) * 100.0, 2)
            if prev is not None and prev["close"]
            else None
        )
        as_of = last["date"].date().isoformat()
        rows.append(
            {
                "symbol": sym,
                "slug": slug(sym),
                "category": "sectoral" if sym in SECTOR_INDICES else "broad",
                "value": round(float(last["close"]), 2),
                "change": round(change, 2) if change is not None else None,
                "change_pct": change_pct,
            }
        )

    # Group by category only — Python's sort is stable, so within each group this keeps
    # ALL_INDICES's own order (NIFTY 50, Next 50, 100, 200, 500, ...), not an alphabetical
    # string sort, which would put "NIFTY 100" before "NIFTY 50" (wrong on any real
    # reading of the name).
    rows.sort(key=lambda r: r["category"])
    stats = {"ok": bool(rows), "count": len(rows), "total": len(ALL_INDICES)}
    log.info("indices: %s of %s built", len(rows), len(ALL_INDICES))
    return {"as_of": as_of, "indices": rows}, stats
