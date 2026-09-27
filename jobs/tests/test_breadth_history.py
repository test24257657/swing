from __future__ import annotations

import numpy as np
import pandas as pd

from jobs.breadth import history


def _closes(rows: dict[str, list[float]]) -> pd.DataFrame:
    n = len(next(iter(rows.values())))
    return pd.DataFrame(rows, index=pd.bdate_range("2026-01-01", periods=n))


def test_pct_advancing_counts_only_symbols_with_both_sessions():
    closes = _closes({
        "UP": [10.0, 11.0, 12.0],
        "DOWN": [10.0, 9.0, 8.0],
        "NEW": [np.nan, np.nan, 5.0],  # listed today: no prior close, must not count
    })
    rows = history(closes, sessions=3)
    # the first session has no prior close to compare against — dropped, not shown as 0%
    assert [r["date"] for r in rows] == ["2026-01-02", "2026-01-05"]
    assert rows[0]["pct_advancing"] == 50.0 and rows[0]["traded"] == 2
    assert rows[1]["pct_advancing"] == 50.0 and rows[1]["traded"] == 2  # NEW still excluded


def test_pct_above_50dma_is_none_until_there_is_a_50dma():
    closes = _closes({"A": list(np.linspace(100, 200, 60)), "B": list(np.linspace(200, 100, 60))})
    rows = history(closes, sessions=60)
    assert rows[0]["pct_above_50dma"] is None  # fewer than 50 sessions of history
    assert rows[-1]["pct_above_50dma"] == 50.0  # one rising, one falling


def test_series_is_capped_to_the_requested_sessions():
    closes = _closes({"A": [float(i) for i in range(1, 101)]})
    assert len(history(closes, sessions=10)) == 10
