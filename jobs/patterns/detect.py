from __future__ import annotations

import pandas as pd

from jobs.patterns import (
    high_52w_breakout,
    near_pivot,
    trendline_breakout,
    vcp,
)
from jobs.patterns.base import DetectContext, PatternMatch

# order matters only for display; a symbol can match several. ipo_base is deliberately
# absent: it only applies to stocks listed within the year, so it runs over that
# universe in jobs/ipos.py and surfaces on the IPO screen instead of the screener.
DETECTORS = (
    ("vcp", vcp.detect),
    ("high_52w_breakout", high_52w_breakout.detect),
    ("trendline_breakout", trendline_breakout.detect),
    ("near_pivot", near_pivot.detect),
)

# Don't emit a signal below this confidence — better a missing pattern than a wrong one.
MIN_CONFIDENCE = 0.35


def detect_all(df: pd.DataFrame, ctx: DetectContext) -> list[PatternMatch]:
    """Run every detector on one symbol's adjusted OHLCV frame.

    ``df`` is date-indexed, ascending, columns ``high``/``low``/``close``/``volume``.
    Returns the matches that clear ``MIN_CONFIDENCE``.
    """
    if df.empty:
        return []
    out: list[PatternMatch] = []
    for _code, fn in DETECTORS:
        try:
            m = fn(df, ctx)
        except Exception:  # noqa: BLE001 - one bad detector must not lose the others
            m = None
        if m is not None and m.confidence >= MIN_CONFIDENCE:
            out.append(m)

    # near_pivot is redundant when VCP already fired on the same pivot.
    codes = {m.pattern_code for m in out}
    if "vcp" in codes:
        out = [m for m in out if m.pattern_code != "near_pivot"]
    return out
