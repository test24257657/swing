"""Golden tests for the indicator engine.

RSI is reconciled against the StockCharts / Wilder worked example
(https://school.stockcharts.com/doku.php?id=technical_indicators:relative_strength_index_rsi),
which is the same definition TradingView uses. A wrong RSI here would be traded on, so the
tolerance is tight.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from jobs.indicators import (
    distance_pct,
    rel_volume,
    rolling_return,
    sma,
    trend_label,
    wilder_atr,
    wilder_rsi,
)

# StockCharts RSI worked example — closing prices.
RSI_CLOSES = [
    44.3389,
    44.0902,
    44.1497,
    43.6124,
    44.3278,
    44.8264,
    45.0955,
    45.4245,
    45.8433,
    46.0826,
    45.8931,
    46.0328,
    45.6140,
    46.2820,
    46.2820,
    46.0028,
    46.0328,
    46.4116,
    46.2222,
    45.6439,
    46.2122,
    46.5155,
    46.7053,
    46.4116,
    46.2521,
    46.2820,
    46.1725,
    45.7712,
    46.0028,
    45.8931,
    45.6140,
    46.2820,
    47.4116,
    47.5310,
    47.7508,
    47.3805,
    47.6404,
    47.6805,
    46.6725,
    45.8628,
    46.6805,
    47.3904,
    47.6805,
    46.3387,
    46.6805,
]
# Published RSI-14 values from the StockCharts table, aligned to the close at the same
# index (the first RSI is at index 14 — 14 price changes need 15 closes).
RSI_EXPECTED = {14: 70.53, 15: 66.32, 16: 66.55, 17: 69.41, 18: 66.35, 19: 57.97, 20: 62.93}


def test_wilder_rsi_matches_stockcharts():
    close = pd.Series(RSI_CLOSES)
    rsi = wilder_rsi(close, 14)
    assert rsi.iloc[:14].isna().all(), "RSI must be NaN before a full window"
    for idx, expected in RSI_EXPECTED.items():
        assert rsi.iloc[idx] == pytest_approx(expected, abs=0.35), f"RSI[{idx}]={rsi.iloc[idx]}"


def test_sma_window_and_nan_prefix():
    s = pd.Series([1, 2, 3, 4, 5], dtype=float)
    out = sma(s, 3)
    assert out.iloc[:2].isna().all()
    assert out.iloc[2] == 2.0
    assert out.iloc[4] == 4.0


def test_wilder_atr_first_value_is_mean_true_range():
    # With no gaps, TR == high - low. ATR-3 first value == mean of first 3 ranges.
    high = pd.Series([10, 11, 12, 13, 14], dtype=float)
    low = pd.Series([9, 9, 10, 11, 12], dtype=float)
    close = pd.Series([9.5, 10.5, 11.5, 12.5, 13.5], dtype=float)
    atr = wilder_atr(high, low, close, 3)
    assert atr.iloc[:2].isna().all()
    # TR = [1, 2, 2, 2, 2]; seed = mean(1,2,2) = 1.6667
    assert atr.iloc[2] == pytest_approx(5 / 3, abs=1e-6)
    assert atr.iloc[3] == pytest_approx((5 / 3 * 2 + 2) / 3, abs=1e-6)


def test_rolling_return_percent():
    close = pd.Series([100, 105, 110, 99], dtype=float)
    r = rolling_return(close, 1)
    assert r.iloc[1] == pytest_approx(5.0)
    assert r.iloc[3] == pytest_approx(-10.0)


def test_rel_volume_excludes_today():
    vol = pd.Series([100, 100, 100, 100, 300], dtype=float)
    rv = rel_volume(vol, 4)
    # day 5: today 300 vs avg of prior 4 (all 100) -> 3.0
    assert rv.iloc[4] == pytest_approx(3.0)


def test_distance_pct_sign():
    val = pd.Series([99.0])
    ref = pd.Series([100.0])
    assert distance_pct(val, ref).iloc[0] == pytest_approx(-1.0)


def test_trend_label():
    assert trend_label(pd.Series(np.arange(10, dtype=float)), 10) == "rising"
    assert trend_label(pd.Series(np.arange(10, 0, -1, dtype=float)), 10) == "falling"
    assert trend_label(pd.Series([5.0] * 10), 10) == "flat"


# tiny local approx helper so the file has no hard pytest.approx import ordering issue
def pytest_approx(expected, abs=1e-6):  # noqa: A002
    import pytest

    return pytest.approx(expected, abs=abs)
