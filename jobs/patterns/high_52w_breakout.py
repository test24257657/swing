from __future__ import annotations

import pandas as pd

from jobs.patterns.base import DetectContext, PatternMatch, clamp01
from jobs.patterns.stage import classify_stage

# tunables
NEAR_PCT = 2.0  # within this % below the 52w high counts as "forming"
LOOKBACK_52W = 252
MIN_HISTORY = 60


def detect(df: pd.DataFrame, ctx: DetectContext) -> PatternMatch | None:
    """Close at/above the trailing 52-week high (or within NEAR_PCT below it)."""
    if len(df) < MIN_HISTORY:
        return None
    close = df["close"]
    last = float(close.iloc[-1])

    prior = close.iloc[:-1].tail(LOOKBACK_52W)
    if prior.empty:
        return None
    prior_high = float(prior.max())
    if prior_high <= 0:
        return None

    gap_pct = (last / prior_high - 1.0) * 100.0
    if gap_pct < -NEAR_PCT:
        return None  # not close enough to the high

    stage, breakout_date, vol_ratio = classify_stage(close, df["volume"], prior_high, ctx.vol_sma_20)

    # Confidence: reward a genuine volume thrust and a close above the high;
    # penalise being extended.
    conf = 0.45
    if last >= prior_high:
        conf += 0.15
    if vol_ratio is not None:
        conf += clamp01((vol_ratio - 1.0) / 1.5) * 0.3
    if stage == "extended":
        conf -= 0.15
    conf = clamp01(conf)

    stop = None
    swing_low = float(df["low"].tail(15).min())
    if swing_low < last:
        stop = round(swing_low, 2)
    target = round(prior_high * 1.20, 2)

    return PatternMatch(
        pattern_code="high_52w_breakout",
        stage=stage,
        confidence=round(conf, 4),
        pivot_price=round(prior_high, 2),
        stop_suggestion=stop,
        target_suggestion=target,
        breakout_date=breakout_date.date() if breakout_date is not None else None,
        breakout_volume_ratio=vol_ratio,
        meta={"gap_to_high_pct": round(gap_pct, 2), "prior_52w_high": round(prior_high, 2)},
    )
