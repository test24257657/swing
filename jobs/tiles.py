"""The four index tiles at the top of Pulse, plus the volatility card."""

from __future__ import annotations

import pandas as pd

from jobs.config import (
    SPARKLINE_DAYS,
    TILE_INDICES,
    VIX_BANDS,
    VIX_PERCENTILE_DAYS,
    VIX_VERDICTS,
)
from jobs.sources import index_history


def build(days: int) -> tuple[list[dict], dict | None, dict]:
    """Returns (tiles, vix_card, stats)."""
    tiles: list[dict] = []
    vix_series: pd.DataFrame | None = None
    ok, failed = 0, []

    for symbol in TILE_INDICES:
        hist = index_history(symbol, days)
        if hist is None or hist.empty:
            failed.append(symbol)
            continue
        ok += 1
        if symbol == "INDIA VIX":
            vix_series = hist

        closes = hist["close"]
        last = float(closes.iloc[-1])
        prev = float(closes.iloc[-2]) if len(closes) > 1 else None
        tiles.append(
            {
                "symbol": symbol,
                "value": round(last, 2),
                "change": round(last - prev, 2) if prev else None,
                "change_pct": round((last / prev - 1) * 100, 2) if prev else None,
                "spark": [round(float(v), 2) for v in closes.tail(SPARKLINE_DAYS)],
                "as_of": hist["date"].iloc[-1].date().isoformat(),
            }
        )

    return tiles, _vix_card(vix_series), {"ok": ok, "failed": failed}


def _vix_card(hist: pd.DataFrame | None) -> dict | None:
    if hist is None or hist.empty:
        return None
    closes = hist["close"]
    last = float(closes.iloc[-1])
    prev = float(closes.iloc[-2]) if len(closes) > 1 else None

    tail = closes.tail(VIX_PERCENTILE_DAYS)
    pctile = round(float((tail < last).mean() * 100), 1) if len(tail) >= 20 else None

    if last < VIX_BANDS["low"]:
        band = "low"
    elif last < VIX_BANDS["moderate"]:
        band = "moderate"
    elif last < VIX_BANDS["elevated"]:
        band = "elevated"
    else:
        band = "high"
    verdict, advice = VIX_VERDICTS[band]

    return {
        "value": round(last, 2),
        "change": round(last - prev, 2) if prev else None,
        "change_pct": round((last / prev - 1) * 100, 2) if prev else None,
        "percentile_250d": pctile,
        "band": band,
        "verdict": verdict,
        "advice": advice,
    }
