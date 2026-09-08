from __future__ import annotations

import pandas as pd

from app.patterns.base import DetectContext, PatternMatch, clamp01, contraction_legs
from app.patterns.stage import classify_stage

LOOKBACK = 80
MIN_CONTRACTIONS = 2
MAX_LAST_DEPTH = 12.0  # last pullback should be tight
MIN_FIRST_DEPTH = 8.0  # first pullback should be meaningfully wider
NEAR_PIVOT_PCT = 8.0  # price should be within this % of the pivot
DEPTH_TOLERANCE = 1.5  # a later leg may be up to this many points deeper and still "contracting"


def detect(df: pd.DataFrame, ctx: DetectContext) -> PatternMatch | None:
    """Volatility Contraction Pattern — 2+ pullbacks, each ~shallower than the last,
    volume drying up, price coiled near the base high (the pivot)."""
    if len(df) < LOOKBACK:
        return None
    legs = contraction_legs(df["high"], df["low"], LOOKBACK)
    if len(legs) < MIN_CONTRACTIONS:
        return None

    # Keep the last up-to-4 legs and require broadly decreasing depth.
    legs = legs[-4:]
    depths = [leg["depth_pct"] for leg in legs]
    contracting = all(depths[i + 1] <= depths[i] + DEPTH_TOLERANCE for i in range(len(depths) - 1))
    if not contracting:
        return None
    if depths[0] < MIN_FIRST_DEPTH or depths[-1] > MAX_LAST_DEPTH or depths[-1] < 1.0:
        return None

    pivot = max(leg["peak"] for leg in legs)
    last = float(df["close"].iloc[-1])
    if pivot <= 0:
        return None
    gap_pct = (last / pivot - 1.0) * 100.0
    if gap_pct < -NEAR_PIVOT_PCT or gap_pct > 15.0:
        return None

    # Volume contraction: avg volume during the last leg vs the first leg's window.
    vol_ratio = _leg_volume_ratio(df, legs)

    conf = 0.4
    conf += clamp01((len(legs) - 2) / 2) * 0.15
    conf += clamp01((MAX_LAST_DEPTH - depths[-1]) / MAX_LAST_DEPTH) * 0.2
    if vol_ratio is not None and vol_ratio < 1.0:
        conf += clamp01(1.0 - vol_ratio) * 0.25
    conf = clamp01(conf)

    stage, breakout_date, brk_vol = classify_stage(df["close"], df["volume"], pivot, ctx.vol_sma_20)
    atr = ctx.atr_14 or (last * 0.02)

    return PatternMatch(
        pattern_code="vcp",
        stage=stage,
        confidence=round(conf, 4),
        pivot_price=round(pivot, 2),
        stop_suggestion=round(min(legs[-1]["trough"], last - 1.5 * atr), 2),
        target_suggestion=round(pivot * 1.25, 2),
        base_start_date=legs[0]["peak_date"].date(),
        base_weeks=round((df.index[-1] - legs[0]["peak_date"]).days / 7.0, 2),
        breakout_date=breakout_date.date() if breakout_date is not None else None,
        breakout_volume_ratio=brk_vol,
        meta={
            "contractions": [
                {"depth_pct": leg["depth_pct"], "trough_date": leg["trough_date"].strftime("%Y-%m-%d")}
                for leg in legs
            ],
            "leg_volume_ratio": vol_ratio,
            "gap_to_pivot_pct": round(gap_pct, 2),
        },
    )


def _leg_volume_ratio(df: pd.DataFrame, legs: list[dict]) -> float | None:
    try:
        first = df.loc[legs[0]["peak_date"] : legs[0]["trough_date"], "volume"]
        last = df.loc[legs[-1]["peak_date"] : legs[-1]["trough_date"], "volume"]
        if first.mean() > 0 and len(last):
            return round(float(last.mean() / first.mean()), 3)
    except (KeyError, ZeroDivisionError):
        pass
    return None
