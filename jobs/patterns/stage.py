"""Breakout-stage classifier — Forming / Confirmed / Extended.

Thresholds (tunable): a breakout is *confirmed* when the close first crossed the pivot
within the last ``CONFIRM_WINDOW`` sessions on volume >= ``CONFIRM_VOL_MULT`` x the 20-day
average; *extended* once the close is more than ``EXTENDED_PCT`` % past the pivot; *forming*
otherwise (pivot not yet crossed, or crossed too long ago without follow-through).
"""

from __future__ import annotations

import pandas as pd

CONFIRM_WINDOW = 3
CONFIRM_VOL_MULT = 1.4
EXTENDED_PCT = 5.0


def classify_stage(
    close: pd.Series,
    volume: pd.Series,
    pivot: float,
    vol_sma_20: float | None,
) -> tuple[str, pd.Timestamp | None, float | None]:
    """Returns (stage, breakout_date, breakout_volume_ratio)."""
    last = float(close.iloc[-1])
    if pivot <= 0:
        return "forming", None, None

    past_pct = (last / pivot - 1.0) * 100.0
    if past_pct >= EXTENDED_PCT:
        return "extended", None, None

    # Find the first session in the recent window where close crossed above the pivot.
    recent = close.tail(CONFIRM_WINDOW + 1)
    crossed_on = None
    prev = None
    for d, c in recent.items():
        if prev is not None and prev <= pivot < c:
            crossed_on = d
        prev = c

    if crossed_on is not None and last >= pivot:
        vr = None
        if vol_sma_20 and vol_sma_20 > 0:
            vr = round(float(volume.loc[crossed_on]) / vol_sma_20, 3)
        if vr is None or vr >= CONFIRM_VOL_MULT:
            return "confirmed", crossed_on, vr
        # crossed but without a volume thrust — treat as still forming
        return "forming", crossed_on, vr

    return "forming", None, None
