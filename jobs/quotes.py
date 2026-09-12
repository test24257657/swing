"""Whole-panel EOD quote lookup — every actively-traded symbol, not just the ones with
a chart artifact (movers/screener matches/tiles). Needed for the watchlist: a user can
add any NSE symbol, not only ones Pulse or the Screener happened to surface.

One small entry per symbol (~60 bytes) — ~2,700 symbols is still well under 200 KB.
"""

from __future__ import annotations

import pandas as pd


def build(panel: pd.DataFrame, names: dict[str, str]) -> dict[str, dict]:
    if panel.empty:
        return {}
    latest = panel["date"].max()
    today = panel[panel["date"] == latest]

    quotes: dict[str, dict] = {}
    for _, row in today.iterrows():
        symbol = row["symbol"]
        close = row["close"]
        prev_close = row.get("prev_close")
        if pd.isna(close):
            continue
        change_pct = (
            round((float(close) / float(prev_close) - 1.0) * 100.0, 2)
            if prev_close is not None and pd.notna(prev_close) and prev_close
            else None
        )
        quotes[symbol] = {
            "name": names.get(symbol, symbol),
            "ltp": round(float(close), 2),
            "change_pct": change_pct,
        }
    return quotes
