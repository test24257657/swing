"""Descending-trendline breakout.

The setup: a stock makes a series of *lower* swing highs — each rally stopped a bit
sooner than the last, tracing a falling ceiling — and then closes decisively above that
ceiling on volume. The pivot is the trendline's value *today*, not a fixed horizontal
price, which is what separates this from the 52-week/near-pivot detectors: those look
for a flat resistance, this one looks for a sloping one.

Deliberately requires at least three touches. Two points define any line at all, so a
two-touch "trendline" is drawn through noise as often as through real resistance — the
third touch is what makes it a level the market actually respected.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from jobs.patterns.base import DetectContext, PatternMatch, clamp01, swing_points
from jobs.patterns.stage import CONFIRM_VOL_MULT, CONFIRM_WINDOW

LOOKBACK = 90
MIN_TOUCHES = 3
TOUCH_TOLERANCE_PCT = 2.0  # a swing high within this % of the line counts as touching it
MIN_SLOPE_PCT_PER_SESSION = -0.02  # the line must actually fall, not drift sideways
# ...but not fall off a cliff either. A ceiling dropping faster than this over 40+
# sessions is a collapse (>14% across the span); clipping its edge is not the setup.
MAX_SLOPE_PCT_PER_SESSION = -0.35
# The touches have to span a real stretch of time. Three swing highs inside ~20 bars is
# a squiggle, and noise supplies those endlessly — measured at ~12% false positives on
# random walks before this constraint, ~2% after.
MIN_TOUCH_SPAN_SESSIONS = 40
MAX_ABOVE_PIVOT_PCT = 10.0  # already far through it — too late to call it a breakout
MIN_OFF_LOW_PCT = 5.0  # price must be this far off the window's low — see detect()
# The ceiling must have still been intact this recently. Above it for longer than this
# and the break is old news, whatever today's volume looks like.
RECENT_BREAK_WINDOW = 15
# The confirming bar has to be a real bar. High volume with a +0.1% close is
# distribution, not a breakout, and it is the main way noise sneaks past a pure
# volume test.
MIN_THRUST_PCT = 2.0


def _fit_descending_line(highs: pd.Series) -> tuple[float, float, list[int]] | None:
    """Least-squares line through the *resistance* swing highs, kept only if it slopes
    down and the highs sit on it rather than scattered around it. Returns (slope,
    intercept, touch positions) with x measured in sessions from the window start.

    The points are chosen by anchoring on the highest swing high and then walking
    forward keeping only successively lower highs. Fitting every swing high instead
    would let the post-breakout rally into the fit — and that new high drags the line
    up and erases the pattern exactly when it has just succeeded, which is the last
    moment you want it to disappear.
    """
    peaks, _ = swing_points(highs, window=3)
    peak_pos = [i for i, p in enumerate(peaks.to_numpy()) if p]
    if len(peak_pos) < MIN_TOUCHES:
        return None

    vals = highs.to_numpy(dtype=float)
    anchor = max(peak_pos, key=lambda i: vals[i])
    kept = [anchor]
    for i in peak_pos:
        if i > anchor and vals[i] < vals[kept[-1]]:
            kept.append(i)
    if len(kept) < MIN_TOUCHES:
        return None

    x = np.array(kept, dtype=float)
    y = vals[kept]
    slope, intercept = np.polyfit(x, y, 1)

    # Normalise the slope against price so the threshold means the same thing for a
    # ₹50 stock and a ₹5,000 one.
    mean_price = float(np.mean(y))
    if mean_price <= 0:
        return None
    slope_pct = slope / mean_price * 100.0
    if slope_pct > MIN_SLOPE_PCT_PER_SESSION:
        return None  # flat or rising — that's a horizontal resistance, not this pattern
    if slope_pct < MAX_SLOPE_PCT_PER_SESSION:
        return None  # falling too steeply to be a ceiling worth breaking

    fitted = slope * x + intercept
    residual_pct = np.abs(y - fitted) / mean_price * 100.0
    touches = [kept[i] for i in range(len(kept)) if residual_pct[i] <= TOUCH_TOLERANCE_PCT]
    if len(touches) < MIN_TOUCHES:
        return None
    if touches[-1] - touches[0] < MIN_TOUCH_SPAN_SESSIONS:
        return None
    return float(slope), float(intercept), touches


def _classify_sloping(
    window: pd.DataFrame,
    slope: float,
    intercept: float,
    vol_sma_20: float | None,
) -> tuple[str, pd.Timestamp | None, float | None]:
    """stage.py's classifier assumes a flat pivot: it compares every close against one
    number. A falling trendline has a different value every session, and a stock can
    break out by standing still while the ceiling descends onto it. So the cross is
    evaluated bar by bar against the line's own value at that bar."""
    closes = window["close"].to_numpy(dtype=float)
    line = slope * np.arange(len(window), dtype=float) + intercept
    above = closes > line

    if not above[-1]:
        return "forming", None, None

    # No "extended" branch here on purpose. stage.py's 5% is calibrated for a flat
    # pivot; a decisive thrust through a *sloping* line clears 5% on the breakout bar
    # itself, so reusing that threshold would label every genuine break as already
    # missed. How far past is too far is MAX_ABOVE_PIVOT_PCT's job, in detect().

    # A falling line is often crossed gradually — price drifts sideways while the
    # ceiling descends onto it — and the decisive thrust comes later. So "crossed in the
    # last N bars", which works for a flat pivot, misses the real thing here. What
    # actually defines a fresh trendline break is: the ceiling was still intact recently,
    # price is above it now, and there is conviction behind the move.
    if all(above[-RECENT_BREAK_WINDOW:]):
        return "forming", None, None  # already above it for weeks — not a fresh break

    thrust_at, thrust_vr = None, None
    if vol_sma_20 and vol_sma_20 > 0:
        for i in range(len(window) - CONFIRM_WINDOW, len(window)):
            if i <= 0:
                continue
            vr = float(window["volume"].iloc[i]) / vol_sma_20
            gain_pct = (closes[i] / closes[i - 1] - 1.0) * 100.0 if closes[i - 1] > 0 else 0.0
            if vr >= CONFIRM_VOL_MULT and gain_pct >= MIN_THRUST_PCT:
                thrust_at, thrust_vr = i, round(vr, 3)
                break
    if thrust_at is None:
        return "forming", None, None
    return "confirmed", window.index[thrust_at], thrust_vr


def detect(df: pd.DataFrame, ctx: DetectContext) -> PatternMatch | None:
    if len(df) < LOOKBACK:
        return None

    window = df.tail(LOOKBACK)
    highs = window["high"]
    fit = _fit_descending_line(highs)
    if fit is None:
        return None
    slope, intercept, touches = fit

    # The line's value at the latest bar is the pivot — it declines every session, so a
    # stock can break out by rising *or* simply by the ceiling coming down to meet it.
    last_x = len(window) - 1
    pivot = slope * last_x + intercept
    if pivot <= 0:
        return None

    last = float(window["close"].iloc[-1])
    gap_pct = (last / pivot - 1.0) * 100.0
    # Require the break to have actually happened. Allowing "coiled just below" here
    # made every declining random walk match: lower highs are trivially present in any
    # downtrend, so without a real break this fires on noise. Coiling under a *flat*
    # resistance is what near_pivot is for.
    if gap_pct < 0 or gap_pct > MAX_ABOVE_PIVOT_PCT:
        return None

    # And the stock must be off its floor. A stock still pinned to the window low has
    # broken a falling line only because the line finally caught up with the decline —
    # that is not a reversal, it is the downtrend continuing at a gentler angle.
    window_low = float(window["low"].min())
    if window_low > 0 and last < window_low * (1.0 + MIN_OFF_LOW_PCT / 100.0):
        return None

    stage, breakout_date, vol_ratio = _classify_sloping(window, slope, intercept, ctx.vol_sma_20)

    # Only a volume-confirmed break is emitted. Every classic formulation of this setup
    # (O'Neil, Minervini) treats volume as what separates a real break from price
    # drifting across a line it was always going to meet — and measured on random walks,
    # accepting unconfirmed breaks is what took the false-positive rate from ~2% to ~7%.
    # The cost is honest: a genuine break whose volume arrives a day late is missed.
    if stage != "confirmed":
        return None

    conf = 0.4
    conf += clamp01((len(touches) - MIN_TOUCHES) / 2) * 0.15  # more touches, more real
    if last >= pivot:
        conf += 0.15
    if vol_ratio is not None:
        conf += clamp01((vol_ratio - 1.0) / 1.5) * 0.25
    conf = clamp01(conf)

    atr = ctx.atr_14 or (last * 0.02)
    swing_low = float(window["low"].tail(15).min())

    return PatternMatch(
        pattern_code="trendline_breakout",
        stage=stage,
        confidence=round(conf, 4),
        pivot_price=round(pivot, 2),
        stop_suggestion=round(min(swing_low, last - 1.5 * atr), 2),
        target_suggestion=round(pivot * 1.20, 2),
        base_start_date=window.index[touches[0]].date(),
        base_weeks=round((last_x - touches[0]) / 5.0, 2),
        breakout_date=breakout_date.date() if breakout_date is not None else None,
        breakout_volume_ratio=vol_ratio,
        meta={
            "touches": len(touches),
            "slope_pct_per_session": round(slope / last * 100.0, 4) if last else None,
            "gap_to_pivot_pct": round(gap_pct, 2),
            "first_touch_date": window.index[touches[0]].strftime("%Y-%m-%d"),
        },
    )
