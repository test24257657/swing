"""Shared pattern-detection primitives.

Detectors are pure: they take an adjusted OHLCV frame (date index, columns
``high``/``low``/``close``/``volume``) plus a small context dict, and return a
``PatternMatch | None``. No I/O. Every detector is covered by synthetic golden tests
(``tests/test_patterns.py``) because a mislabelled pattern is traded on.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date

import numpy as np
import pandas as pd


@dataclass
class PatternMatch:
    pattern_code: str
    stage: str  # forming | confirmed | extended
    confidence: float  # 0..1, deliberately conservative
    pivot_price: float | None = None
    stop_suggestion: float | None = None
    target_suggestion: float | None = None
    base_start_date: date | None = None
    base_weeks: float | None = None
    breakout_date: date | None = None
    breakout_volume_ratio: float | None = None
    meta: dict = field(default_factory=dict)


@dataclass
class DetectContext:
    """Latest-day scalars the detectors reuse, precomputed by the job."""

    listing_date: date | None
    vol_sma_20: float | None
    high_52w: float | None
    atr_14: float | None
    # Minervini trend-template inputs. All optional: when they're missing the template
    # check is skipped rather than failing a symbol for want of history (a 6-month-old
    # listing has no 200-day SMA, but can still form a legitimate IPO base).
    sma_50: float | None = None
    sma_150: float | None = None
    sma_200: float | None = None
    sma_200_month_ago: float | None = None  # same SMA ~22 sessions back, for its slope
    low_52w: float | None = None


def trend_template(last_close: float, ctx: DetectContext) -> tuple[bool, dict]:
    """Mark Minervini's Trend Template — the stage-2 uptrend filter that has to be true
    *before* a contraction pattern means anything. A tightening base inside a downtrend
    is not a VCP, it is a stock on its way down pausing to breathe.

    Returns (passes, detail) where `detail` names each leg so a near-miss is debuggable
    from the artifact rather than only from a rerun.

    Any leg whose inputs are missing is treated as passing — see DetectContext.
    """
    checks = {
        # price above the three long averages
        "above_sma_50": ctx.sma_50 is None or last_close > ctx.sma_50,
        "above_sma_150": ctx.sma_150 is None or last_close > ctx.sma_150,
        "above_sma_200": ctx.sma_200 is None or last_close > ctx.sma_200,
        # and the averages themselves stacked in order
        "sma_50_above_150": ctx.sma_50 is None or ctx.sma_150 is None or ctx.sma_50 > ctx.sma_150,
        "sma_150_above_200": ctx.sma_150 is None or ctx.sma_200 is None or ctx.sma_150 > ctx.sma_200,
        # 200-day sloping up over roughly the last month
        "sma_200_rising": ctx.sma_200 is None or ctx.sma_200_month_ago is None or ctx.sma_200 > ctx.sma_200_month_ago,
        # well off the 52-week low, and not far from the 52-week high
        "above_52w_low": ctx.low_52w is None or ctx.low_52w <= 0 or last_close >= ctx.low_52w * 1.25,
        "near_52w_high": ctx.high_52w is None or ctx.high_52w <= 0 or last_close >= ctx.high_52w * 0.75,
    }
    return all(checks.values()), checks


def swing_points(series: pd.Series, window: int = 3) -> tuple[pd.Series, pd.Series]:
    """Local maxima and minima: a point that is the extreme within +/- ``window`` bars.
    Returns (peaks, troughs) as boolean Series aligned to ``series``."""
    n = len(series)
    peaks = np.zeros(n, dtype=bool)
    troughs = np.zeros(n, dtype=bool)
    v = series.to_numpy(dtype=float)
    for i in range(window, n - window):
        seg = v[i - window : i + window + 1]
        if v[i] == seg.max() and (seg.argmax() == window):
            peaks[i] = True
        if v[i] == seg.min() and (seg.argmin() == window):
            troughs[i] = True
    return pd.Series(peaks, index=series.index), pd.Series(troughs, index=series.index)


def contraction_legs(high: pd.Series, low: pd.Series, lookback: int = 80) -> list[dict]:
    """Peak -> subsequent-trough pullbacks over the last ``lookback`` sessions, oldest
    first. Each leg: {peak_i, trough_i, peak, trough, depth_pct}."""
    h = high.tail(lookback)
    lo = low.tail(lookback).reindex(h.index)
    peaks, troughs = swing_points(h, window=3)

    legs: list[dict] = []
    peak_idx = [i for i, p in enumerate(peaks.to_numpy()) if p]
    trough_pos = [i for i, t in enumerate(troughs.to_numpy()) if t]
    for pi in peak_idx:
        following = [ti for ti in trough_pos if ti > pi]
        if not following:
            continue
        ti = following[0]
        peak_v = float(h.iloc[pi])
        trough_v = float(lo.iloc[ti])
        if peak_v <= 0:
            continue
        legs.append(
            {
                "peak_date": h.index[pi],
                "trough_date": h.index[ti],
                "peak": peak_v,
                "trough": trough_v,
                "depth_pct": round((peak_v - trough_v) / peak_v * 100.0, 2),
            }
        )
    return legs


def clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))


def pct_from(price: float, ref: float) -> float:
    return (price / ref - 1.0) * 100.0 if ref else 0.0
