"""Pure indicator functions.

Every function takes and returns pandas objects and has no I/O. These are the definitions
the whole product trades on, so they are covered by golden tests
(``tests/test_indicators.py``) reconciled against published reference values.

Conventions:
  * input series are indexed by date, ascending, already adjusted for corporate actions;
  * RSI and ATR use **Wilder's** smoothing seeded with the simple average of the first
    ``window`` values — the TradingView / StockCharts definition, not an EWM-from-start;
  * a value is ``NaN`` until it has a full lookback window.
"""

from __future__ import annotations

import numpy as np
import pandas as pd


def _wilder_smooth(values: pd.Series, window: int) -> pd.Series:
    """Wilder's running average.

    Seed = simple average of the first ``window`` non-NaN observations, placed at the
    index where the ``window``-th one occurs (so a leading NaN from ``.diff()`` shifts the
    first output by one, matching StockCharts / TradingView). Then
    ``avg = (avg_prev * (window - 1) + x) / window``.
    """
    v = values.to_numpy(dtype=float)
    out = np.full(len(v), np.nan)

    valid = np.where(~np.isnan(v))[0]
    if len(valid) < window:
        return pd.Series(out, index=values.index)

    seed_idx = valid[window - 1]
    prev = float(np.mean(v[valid[:window]]))
    out[seed_idx] = prev
    for i in range(seed_idx + 1, len(v)):
        x = v[i]
        if np.isnan(x):
            out[i] = prev
            continue
        prev = (prev * (window - 1) + x) / window
        out[i] = prev
    return pd.Series(out, index=values.index)


def sma(series: pd.Series, window: int) -> pd.Series:
    return series.rolling(window=window, min_periods=window).mean()


def ema(series: pd.Series, window: int) -> pd.Series:
    # `adjust=False` gives the recursive EMA charting tools use.
    return series.ewm(span=window, adjust=False, min_periods=window).mean()


def wilder_rsi(close: pd.Series, window: int = 14) -> pd.Series:
    delta = close.diff()
    gain = delta.clip(lower=0.0)
    loss = -delta.clip(upper=0.0)

    avg_gain = _wilder_smooth(gain, window)
    avg_loss = _wilder_smooth(loss, window)

    rs = avg_gain / avg_loss
    rsi = 100.0 - (100.0 / (1.0 + rs))
    rsi = rsi.where(avg_loss != 0, other=100.0)  # no losses in window -> RSI 100
    rsi = rsi.where(avg_gain.notna() & avg_loss.notna(), other=np.nan)
    return rsi


def true_range(high: pd.Series, low: pd.Series, close: pd.Series) -> pd.Series:
    prev_close = close.shift(1)
    return pd.concat(
        [(high - low), (high - prev_close).abs(), (low - prev_close).abs()],
        axis=1,
    ).max(axis=1)


def wilder_atr(high: pd.Series, low: pd.Series, close: pd.Series, window: int = 14) -> pd.Series:
    return _wilder_smooth(true_range(high, low, close), window)


def rolling_return(close: pd.Series, window: int) -> pd.Series:
    """Percent change over ``window`` sessions, in percent (e.g. 4.2 for +4.2%)."""
    return (close / close.shift(window) - 1.0) * 100.0


def rel_volume(volume: pd.Series, window: int = 20) -> pd.Series:
    """Volume as a multiple of its trailing ``window``-session average (excluding today)."""
    avg = volume.shift(1).rolling(window=window, min_periods=window).mean()
    return volume / avg


def distance_pct(value: pd.Series, reference: pd.Series) -> pd.Series:
    """Signed percent of ``value`` relative to ``reference`` (e.g. −1.1 for 1.1% below)."""
    return (value / reference - 1.0) * 100.0


def trend_label(series: pd.Series, window: int = 10, flat_band: float = 0.15) -> str:
    """Classify the slope of the last ``window`` points as rising / flat / falling.

    ``flat_band`` is the per-session slope (in the series' own units) below which the
    trend is called flat. For delivery % over 10 sessions, 0.15 %/session ≈ 1.5 pts.
    """
    tail = series.dropna().tail(window)
    if len(tail) < max(3, window // 2):
        return "flat"
    x = np.arange(len(tail), dtype=float)
    slope = np.polyfit(x, tail.to_numpy(dtype=float), 1)[0]
    if slope > flat_band:
        return "rising"
    if slope < -flat_band:
        return "falling"
    return "flat"
