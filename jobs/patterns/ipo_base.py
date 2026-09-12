from __future__ import annotations

from datetime import timedelta

import pandas as pd

from jobs.patterns.base import DetectContext, PatternMatch, clamp01
from jobs.patterns.stage import classify_stage

MAX_AGE_DAYS = 730  # "recently listed" — within ~2 years
MIN_BASE_SESSIONS = 20  # 4+ weeks
MAX_BASE_RANGE_PCT = 35.0  # high-to-low range of the base
NEAR_PIVOT_PCT = 10.0


def detect(df: pd.DataFrame, ctx: DetectContext) -> PatternMatch | None:
    """First base after listing: a 4+ week sideways range with the post-listing high as
    resistance, on a symbol listed within the last ~2 years."""
    if ctx.listing_date is None or len(df) < MIN_BASE_SESSIONS + 5:
        return None
    last_date = df.index[-1].date()
    if (last_date - ctx.listing_date) > timedelta(days=MAX_AGE_DAYS):
        return None

    # Base = everything from a few sessions after listing to now.
    since_listing = df[df.index.date >= ctx.listing_date]
    if len(since_listing) < MIN_BASE_SESSIONS + 5:
        return None
    base = since_listing.iloc[5:]  # skip the noisy first week

    hi = float(base["high"].max())
    lo = float(base["low"].min())
    if lo <= 0:
        return None
    range_pct = (hi - lo) / lo * 100.0
    if range_pct > MAX_BASE_RANGE_PCT:
        return None  # too loose to be a base

    last = float(df["close"].iloc[-1])
    pivot = hi
    gap_pct = (last / pivot - 1.0) * 100.0
    if gap_pct < -NEAR_PIVOT_PCT or gap_pct > 15.0:
        return None

    stage, breakout_date, brk_vol = classify_stage(df["close"], df["volume"], pivot, ctx.vol_sma_20)
    weeks = len(base) / 5.0

    conf = clamp01(
        0.35
        + clamp01((MAX_BASE_RANGE_PCT - range_pct) / MAX_BASE_RANGE_PCT) * 0.25
        + clamp01((weeks - 4) / 12) * 0.2
    )
    atr = ctx.atr_14 or (last * 0.03)

    return PatternMatch(
        pattern_code="ipo_base",
        stage=stage,
        confidence=round(conf, 4),
        pivot_price=round(pivot, 2),
        stop_suggestion=round(max(lo, last - 1.5 * atr), 2),
        target_suggestion=round(pivot * 1.25, 2),
        base_start_date=base.index[0].date(),
        base_weeks=round(weeks, 2),
        breakout_date=breakout_date.date() if breakout_date is not None else None,
        breakout_volume_ratio=brk_vol,
        meta={
            "listing_date": ctx.listing_date.isoformat(),
            "base_range_pct": round(range_pct, 2),
            "gap_to_pivot_pct": round(gap_pct, 2),
        },
    )
