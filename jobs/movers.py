"""The two Pulse tables: most active by traded value, and 52-week-high breakouts."""

from __future__ import annotations

import pandas as pd

from jobs.config import (
    BREAKOUT_VOL_MULT,
    BREAKOUT_VOL_WINDOW,
    HIGH_52W_WINDOW,
    MOVERS_ROWS,
)
from jobs.panel import wide
from jobs.sources import symbol_names


def _pct(close, prev) -> float | None:
    if close is None or prev in (None, 0) or pd.isna(close) or pd.isna(prev):
        return None
    return round(float((close / prev - 1) * 100), 2)


def most_active(panel: pd.DataFrame) -> list[dict]:
    """Top symbols by turnover in the cash segment today."""
    if panel.empty:
        return []
    today = panel[panel["date"] == panel["date"].max()]
    if today.empty or "turnover" not in today.columns:
        return []
    names = symbol_names()
    top = today.dropna(subset=["turnover"]).nlargest(MOVERS_ROWS, "turnover")
    return [
        {
            "symbol": r.symbol,
            "name": names.get(r.symbol, r.symbol),
            "ltp": round(float(r.close), 2),
            "change_pct": _pct(r.close, r.prev_close),
            "turnover_cr": round(float(r.turnover) / 1e7, 1),
        }
        for r in top.itertuples()
    ]


def breakouts_52w(panel: pd.DataFrame) -> list[dict]:
    """Closed at/above the trailing 52-week high on above-average volume."""
    if panel.empty:
        return []
    closes = wide(panel, "close")
    volumes = wide(panel, "volume")
    if len(closes) < 30:
        return []

    window = min(HIGH_52W_WINDOW, len(closes))
    prior_high = closes.iloc[:-1].rolling(window, min_periods=window // 2).max().iloc[-1]
    vol_avg = volumes.rolling(BREAKOUT_VOL_WINDOW, min_periods=5).mean().iloc[-1]
    last_close = closes.iloc[-1]
    last_vol = volumes.iloc[-1]

    df = pd.concat(
        [
            last_close.rename("close"),
            prior_high.rename("prior_high"),
            last_vol.rename("vol"),
            vol_avg.rename("vol_avg"),
        ],
        axis=1,
    ).dropna()
    df = df[(df["close"] >= df["prior_high"]) & (df["vol_avg"] > 0)]
    df["vol_ratio"] = df["vol"] / df["vol_avg"]
    df = df[df["vol_ratio"] >= BREAKOUT_VOL_MULT].nlargest(MOVERS_ROWS, "vol_ratio")
    if df.empty:
        return []

    today = panel[panel["date"] == panel["date"].max()].set_index("symbol")
    names = symbol_names()
    out = []
    for sym, r in df.iterrows():
        prev = today["prev_close"].get(sym)
        out.append(
            {
                "symbol": sym,
                "name": names.get(sym, sym),
                "ltp": round(float(r["close"]), 2),
                "change_pct": _pct(r["close"], prev),
                "vol_ratio": round(float(r["vol_ratio"]), 1),
            }
        )
    return out
