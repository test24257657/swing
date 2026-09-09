"""Market breadth — how many stocks are participating, not just where the index closed."""

from __future__ import annotations

import pandas as pd

from jobs.config import BREADTH_DMA_FAST, BREADTH_DMA_SLOW, HIGH_52W_WINDOW
from jobs.indicators import sma
from jobs.panel import wide


def compute(panel: pd.DataFrame) -> dict | None:
    if panel.empty:
        return None
    latest = panel["date"].max()
    today = panel[panel["date"] == latest]
    if today.empty:
        return None

    chg = today["close"] - today["prev_close"]
    valid = chg.notna()
    advances = int((chg[valid] > 0).sum())
    declines = int((chg[valid] < 0).sum())
    unchanged = int((chg[valid] == 0).sum())
    traded = int(valid.sum())

    closes = wide(panel, "close")
    pct_fast = _pct_above(closes, BREADTH_DMA_FAST)
    pct_slow = _pct_above(closes, BREADTH_DMA_SLOW)

    highs = wide(panel, "high")
    lows = wide(panel, "low")
    window = min(HIGH_52W_WINDOW, len(closes))
    new_highs = new_lows = None
    if window >= 20:
        rolling_high = highs.rolling(window, min_periods=window // 2).max().iloc[-1]
        rolling_low = lows.rolling(window, min_periods=window // 2).min().iloc[-1]
        last = closes.iloc[-1]
        new_highs = int((last >= rolling_high * 0.999).sum())
        new_lows = int((last <= rolling_low * 1.001).sum())

    return {
        "date": pd.Timestamp(latest).date().isoformat(),
        "advances": advances,
        "declines": declines,
        "unchanged": unchanged,
        "traded": traded,
        "ad_ratio": round(advances / declines, 2) if declines else None,
        "pct_above_50dma": pct_fast,
        "pct_above_200dma": pct_slow,
        "new_52w_highs": new_highs,
        "new_52w_lows": new_lows,
    }


def _pct_above(closes: pd.DataFrame, window: int) -> float | None:
    if len(closes) < window:
        return None
    avg = closes.apply(lambda s: sma(s.dropna(), window).reindex(s.index).iloc[-1])
    last = closes.iloc[-1]
    both = pd.concat([last.rename("c"), avg.rename("a")], axis=1).dropna()
    if both.empty:
        return None
    return round(float((both["c"] > both["a"]).mean() * 100), 2)
