"""Support / resistance detection.

Swing highs and lows over a lookback window are clustered into horizontal levels; each
level is scored by how many times price has touched it (touch count) and how recent
those touches are. Returns a handful of the strongest levels, split into support (below
the last close) and resistance (above).
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from app.patterns.base import swing_points


@dataclass
class SRLevel:
    price: float
    kind: str  # support | resistance
    touches: int
    strength: float  # 0..1


def detect_sr(
    df: pd.DataFrame,
    *,
    lookback: int = 160,
    swing_window: int = 3,
    cluster_pct: float = 1.2,
    max_levels: int = 4,
) -> list[SRLevel]:
    """``df`` is date-indexed with ``high``/``low``/``close`` (already adjusted)."""
    if len(df) < 30:
        return []
    d = df.tail(lookback)
    last = float(d["close"].iloc[-1])

    highs_mask, lows_mask = swing_points(d["high"], swing_window)
    _, lows_mask_l = swing_points(d["low"], swing_window)
    pivots: list[tuple[float, int]] = []  # (price, bar_index_from_end)
    n = len(d)
    for i, is_h in enumerate(highs_mask.to_numpy()):
        if is_h:
            pivots.append((float(d["high"].iloc[i]), n - 1 - i))
    for i, is_l in enumerate(lows_mask_l.to_numpy()):
        if is_l:
            pivots.append((float(d["low"].iloc[i]), n - 1 - i))
    if not pivots:
        return []

    tol = last * cluster_pct / 100.0
    pivots.sort(key=lambda p: p[0])
    clusters: list[list[tuple[float, int]]] = [[pivots[0]]]
    for price, age in pivots[1:]:
        if price - clusters[-1][-1][0] <= tol:
            clusters[-1].append((price, age))
        else:
            clusters.append([(price, age)])

    levels: list[SRLevel] = []
    for c in clusters:
        prices = [p for p, _ in c]
        ages = [a for _, a in c]
        level_price = float(np.mean(prices))
        touches = len(c)
        recency = 1.0 - min(ages) / max(n, 1)  # a recent touch matters more
        strength = min(1.0, (touches / 5.0) * 0.7 + recency * 0.3)
        levels.append(
            SRLevel(
                price=round(level_price, 2),
                kind="support" if level_price < last else "resistance",
                touches=touches,
                strength=round(strength, 3),
            )
        )

    levels.sort(key=lambda x: (-x.strength, -x.touches))
    support = [lv for lv in levels if lv.kind == "support"][: max_levels // 2 + 1]
    resistance = [lv for lv in levels if lv.kind == "resistance"][: max_levels // 2 + 1]
    out = sorted(support + resistance, key=lambda x: x.price)
    return out[:max_levels]
