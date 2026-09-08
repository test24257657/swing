"""Turn one symbol's price history into indicator rows.

Pure-ish: takes DataFrames in, returns a list of dicts ready to upsert into
``daily_indicators``. The job (``app/ingestion/jobs/compute_indicators.py``) does the I/O.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from app.indicators.core import (
    distance_pct,
    ema,
    rel_volume,
    rolling_return,
    sma,
    trend_label,
    wilder_atr,
    wilder_rsi,
)
from app.models.daily_indicator import INDICATOR_SET_VERSION

TRADING_DAYS_52W = 252


def compute_symbol(
    bars: pd.DataFrame,
    sector_index_close: pd.Series | None,
    *,
    since: pd.Timestamp | None = None,
) -> list[dict]:
    """
    ``bars`` columns: date (index), open, high, low, close, volume, delivery_pct,
    adj_factor. ``sector_index_close`` is the symbol's sector index close, indexed by date
    (may be None). Rows are emitted for dates >= ``since`` (default: all).
    """
    if bars.empty:
        return []
    b = bars.sort_index()
    adj_close = b["close"] * b["adj_factor"]
    adj_high = b["high"] * b["adj_factor"]
    adj_low = b["low"] * b["adj_factor"]

    out = pd.DataFrame(index=b.index)
    out["sma_20"] = sma(adj_close, 20)
    out["sma_50"] = sma(adj_close, 50)
    out["sma_200"] = sma(adj_close, 200)
    out["ema_20"] = ema(adj_close, 20)
    out["ema_50"] = ema(adj_close, 50)
    out["above_sma_20"] = adj_close > out["sma_20"]
    out["above_sma_50"] = adj_close > out["sma_50"]
    out["above_sma_200"] = adj_close > out["sma_200"]

    out["rsi_14"] = wilder_rsi(adj_close, 14)
    out["atr_14"] = wilder_atr(adj_high, adj_low, adj_close, 14)
    out["atr_pct"] = out["atr_14"] / adj_close * 100.0

    out["vol_sma_20"] = b["volume"].shift(1).rolling(20, min_periods=20).mean()
    out["rel_volume"] = rel_volume(b["volume"], 20)

    win = min(TRADING_DAYS_52W, len(b))
    out["high_52w"] = adj_close.rolling(win, min_periods=20).max()
    out["low_52w"] = adj_close.rolling(win, min_periods=20).min()
    out["dist_52w_high_pct"] = distance_pct(adj_close, out["high_52w"])
    out["dist_52w_low_pct"] = distance_pct(adj_close, out["low_52w"])

    out["ret_1d"] = rolling_return(adj_close, 1)
    out["ret_5d"] = rolling_return(adj_close, 5)
    out["ret_20d"] = rolling_return(adj_close, 20)
    out["ret_60d"] = rolling_return(adj_close, 60)
    out["ret_120d"] = rolling_return(adj_close, 120)

    if sector_index_close is not None and not sector_index_close.empty:
        idx = sector_index_close.reindex(b.index).ffill()
        idx_ret_20 = rolling_return(idx, 20)
        out["rs_vs_sector_1m"] = out["ret_20d"] - idx_ret_20
    else:
        out["rs_vs_sector_1m"] = np.nan

    if "delivery_pct" in b.columns:
        dpct = b["delivery_pct"].astype(float)
        out["delivery_pct_sma_20"] = dpct.rolling(20, min_periods=5).mean()
    else:
        dpct = pd.Series(np.nan, index=b.index)
        out["delivery_pct_sma_20"] = np.nan

    rows: list[dict] = []
    dates = out.index if since is None else out.index[out.index >= since]
    for d in dates:
        r = out.loc[d]
        # delivery trend from the 10 sessions up to and including d
        window = dpct.loc[:d].tail(10)
        rows.append(
            {
                "date": d.date() if hasattr(d, "date") else d,
                **{
                    k: _clean(r[k])
                    for k in (
                        "sma_20",
                        "sma_50",
                        "sma_200",
                        "ema_20",
                        "ema_50",
                        "rsi_14",
                        "atr_14",
                        "atr_pct",
                        "vol_sma_20",
                        "rel_volume",
                        "high_52w",
                        "low_52w",
                        "dist_52w_high_pct",
                        "dist_52w_low_pct",
                        "ret_1d",
                        "ret_5d",
                        "ret_20d",
                        "ret_60d",
                        "ret_120d",
                        "rs_vs_sector_1m",
                        "delivery_pct_sma_20",
                    )
                },
                "above_sma_20": _bool(r["above_sma_20"], r["sma_20"]),
                "above_sma_50": _bool(r["above_sma_50"], r["sma_50"]),
                "above_sma_200": _bool(r["above_sma_200"], r["sma_200"]),
                "delivery_trend": trend_label(window, 10) if window.notna().sum() >= 3 else None,
                "indicator_set_version": INDICATOR_SET_VERSION,
            }
        )
    return rows


def _clean(v) -> float | None:
    if v is None or (isinstance(v, float) and (np.isnan(v) or np.isinf(v))):
        return None
    try:
        f = float(v)
        return None if (np.isnan(f) or np.isinf(f)) else round(f, 4)
    except (TypeError, ValueError):
        return None


def _bool(v, guard) -> bool | None:
    # only meaningful once the underlying MA exists
    if guard is None or (isinstance(guard, float) and np.isnan(guard)):
        return None
    return bool(v)
