from __future__ import annotations

import pandas as pd

from jobs.patterns.base import DetectContext, PatternMatch, clamp01, swing_points

BASE_LOOKBACK = 45
NEAR_PCT = 3.0  # within this % below the pivot, not yet crossed
MIN_TOUCHES = 2  # the pivot must have been tested at least twice


def detect(df: pd.DataFrame, ctx: DetectContext) -> PatternMatch | None:
    """Price coiled just below a well-tested resistance (the base high), not yet through
    it. Always 'forming' — it is a watch, not an entry."""
    if len(df) < BASE_LOOKBACK:
        return None
    high = df["high"].tail(BASE_LOOKBACK)
    close = df["close"]
    last = float(close.iloc[-1])

    peaks, _ = swing_points(high, window=2)
    peak_vals = high[peaks]
    if len(peak_vals) < MIN_TOUCHES:
        return None

    pivot = float(peak_vals.max())
    if pivot <= 0 or last >= pivot:
        return None

    gap_pct = (last / pivot - 1.0) * 100.0
    if gap_pct < -NEAR_PCT:
        return None

    # how many swing highs sit within 1.5% of the pivot -> "touches"
    touches = int((peak_vals >= pivot * 0.985).sum())
    if touches < MIN_TOUCHES:
        return None

    conf = clamp01(0.35 + (1 - abs(gap_pct) / NEAR_PCT) * 0.25 + min(touches, 4) / 4 * 0.2)

    atr = ctx.atr_14 or (last * 0.02)
    return PatternMatch(
        pattern_code="near_pivot",
        stage="forming",
        confidence=round(conf, 4),
        pivot_price=round(pivot, 2),
        stop_suggestion=round(last - 1.5 * atr, 2),
        target_suggestion=round(pivot * 1.15, 2),
        meta={"gap_to_pivot_pct": round(gap_pct, 2), "pivot_touches": touches},
    )
