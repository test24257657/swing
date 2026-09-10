"""Setup-pattern screener — runs the four detectors across the whole panel.

The detectors themselves (``jobs/patterns/``) are unchanged from the Postgres-era
build; this module supplies their per-symbol context (20-day avg volume, ATR-14,
listing date) from the rolling panel instead of a database, and writes one artifact
instead of upserting a table.
"""

from __future__ import annotations

import logging

import pandas as pd

from jobs.indicators import sma, wilder_atr
from jobs.patterns.base import DetectContext
from jobs.patterns.detect import detect_all
from jobs.sources import listing_dates, symbol_names

log = logging.getLogger("jobs.screener")

MIN_SESSIONS = 60  # the longest detector requirement (52-week breakout)


def _frame(sub: pd.DataFrame) -> pd.DataFrame:
    return sub.sort_values("date").set_index("date")[["high", "low", "close", "volume"]]


def build(panel: pd.DataFrame) -> tuple[dict, dict]:
    if panel.empty:
        return {}, {"ok": False, "symbols_scanned": 0, "symbols_matched": 0}

    names = symbol_names()
    listings = listing_dates()
    latest = panel["date"].max()

    rows: list[dict] = []
    by_code: dict[str, int] = {}
    by_stage: dict[str, int] = {}
    scanned = 0

    for symbol, sub in panel.groupby("symbol"):
        if len(sub) < MIN_SESSIONS or sub["date"].max() != latest:
            continue
        scanned += 1
        df = _frame(sub)
        vol20 = sma(df["volume"], 20)
        atr14 = wilder_atr(df["high"], df["low"], df["close"], 14)
        ctx = DetectContext(
            listing_date=listings.get(symbol),
            vol_sma_20=float(vol20.iloc[-1]) if pd.notna(vol20.iloc[-1]) else None,
            high_52w=None,
            atr_14=float(atr14.iloc[-1]) if pd.notna(atr14.iloc[-1]) else None,
        )
        matches = detect_all(df, ctx)
        if not matches:
            continue

        last = sub.sort_values("date").iloc[-1]
        prev_close = float(last["prev_close"]) if pd.notna(last.get("prev_close")) else None
        ltp = float(last["close"])
        change_pct = round((ltp / prev_close - 1.0) * 100.0, 2) if prev_close else None

        matches = sorted(matches, key=lambda m: m.confidence, reverse=True)
        for m in matches:
            by_code[m.pattern_code] = by_code.get(m.pattern_code, 0) + 1
            by_stage[m.stage] = by_stage.get(m.stage, 0) + 1

        rows.append(
            {
                "symbol": symbol,
                "name": names.get(symbol, symbol),
                "ltp": round(ltp, 2),
                "change_pct": change_pct,
                "volume": int(last["volume"]) if pd.notna(last.get("volume")) else 0,
                "patterns": [
                    {
                        "code": m.pattern_code,
                        "stage": m.stage,
                        "confidence": m.confidence,
                        "pivot_price": m.pivot_price,
                        "stop_suggestion": m.stop_suggestion,
                        "target_suggestion": m.target_suggestion,
                    }
                    for m in matches
                ],
            }
        )

    rows.sort(key=lambda r: max((p["confidence"] for p in r["patterns"]), default=0.0), reverse=True)

    payload = {
        "as_of": latest.date().isoformat(),
        "facets": {"patterns": by_code, "stages": by_stage},
        "rows": rows,
    }
    stats = {"ok": bool(rows), "symbols_scanned": scanned, "symbols_matched": len(rows)}
    log.info("screener: %s matches across %s scanned symbols", len(rows), scanned)
    return payload, stats
