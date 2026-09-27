"""Market breadth — how many stocks are participating, not just where the index closed."""

from __future__ import annotations

import pandas as pd

from jobs.config import (
    BREADTH_DMA_FAST,
    BREADTH_DMA_SLOW,
    BREADTH_HISTORY_SESSIONS,
    HIGH_52W_WINDOW,
)
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
        "series": history(closes),
    }


def history(closes: pd.DataFrame, sessions: int = BREADTH_HISTORY_SESSIONS) -> list[dict]:
    """Breadth per session, not just today: the count alone can't show whether
    participation is improving or thinning, which is the actual read.

    `pct_advancing` is measured against the previous *session in the panel* rather than
    the bhavcopy's prev_close — the same number for every real session, and defined for
    history rows where we never stored prev_close."""
    if len(closes) < 2:
        return []
    prev = closes.shift()
    both = closes.notna() & prev.notna()
    traded = both.sum(axis=1)
    advancing = ((closes > prev) & both).sum(axis=1)

    fast = closes.rolling(BREADTH_DMA_FAST).mean()
    comparable = closes.notna() & fast.notna()
    above = ((closes > fast) & comparable).sum(axis=1)
    comparable_n = comparable.sum(axis=1)

    out = []
    for d in closes.index[-sessions:]:
        n = int(traded.loc[d])
        if n == 0:
            continue
        cn = int(comparable_n.loc[d])
        out.append(
            {
                "date": pd.Timestamp(d).date().isoformat(),
                "pct_advancing": round(float(advancing.loc[d]) / n * 100, 2),
                "pct_above_50dma": round(float(above.loc[d]) / cn * 100, 2) if cn else None,
                "traded": n,
            }
        )
    return out


def _pct_above(closes: pd.DataFrame, window: int) -> float | None:
    if len(closes) < window:
        return None
    avg = closes.apply(lambda s: sma(s.dropna(), window).reindex(s.index).iloc[-1])
    last = closes.iloc[-1]
    both = pd.concat([last.rename("c"), avg.rename("a")], axis=1).dropna()
    if both.empty:
        return None
    return round(float((both["c"] > both["a"]).mean() * 100), 2)
