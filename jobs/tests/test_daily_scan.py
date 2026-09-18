from __future__ import annotations

import numpy as np
import pandas as pd

from jobs.daily_scan import distribution_days, regime, rs_ratings, trend_template_mask


def _frame(cols: dict[str, np.ndarray]) -> pd.DataFrame:
    n = len(next(iter(cols.values())))
    return pd.DataFrame(cols, index=pd.bdate_range("2025-01-01", periods=n))


def test_rs_rating_orders_by_weighted_return_and_skips_short_history():
    n = 260
    close = _frame({
        "LEADER": np.linspace(100, 300, n),   # +200%
        "MIDDLE": np.linspace(100, 130, n),   # +30%
        "LAGGARD": np.linspace(100, 60, n),   # -40%
        "NEWBIE": np.r_[np.full(n - 50, np.nan), np.linspace(100, 500, 50)],  # 50 sessions only
    })
    rs = rs_ratings(close)
    assert "NEWBIE" not in rs.index  # < RS_MIN_SESSIONS of history is not rated
    assert rs["LEADER"] > rs["MIDDLE"] > rs["LAGGARD"]
    assert rs["LEADER"] == 99 and rs["LAGGARD"] >= 1


def test_trend_template_passes_uptrend_fails_downtrend():
    n = 260
    close = _frame({"UP": np.linspace(100, 250, n), "DOWN": np.linspace(250, 100, n)})
    m = trend_template_mask(close)
    assert bool(m["UP"]) and not bool(m["DOWN"])


def test_distribution_day_needs_a_real_drop_on_higher_volume():
    idx = pd.bdate_range("2026-01-01", periods=5)
    close = pd.Series([100, 99.5, 99.45, 100, 99.0], index=idx)  # -0.5%, -0.05%, +, -1%
    vol = pd.Series([10, 20, 30, 40, 30], index=idx)             # up, up, up, DOWN
    # day2: -0.5% on higher vol = distribution; day3: -0.05% too small; day5: lower vol
    assert distribution_days(close, vol) == 1


def test_regime_lights():
    up = pd.Series(np.linspace(100, 200, 220))
    down = pd.Series(np.linspace(200, 100, 220))
    assert regime(up, 1, 65.0)["light"] == "green"
    assert regime(down, 1, 65.0)["light"] == "red"          # below the 200-day
    assert regime(up, 6, 40.0)["light"] == "yellow"         # uptrend, but distribution + thin breadth
    assert regime(up, 1, 20.0)["light"] == "red"            # breadth collapse overrides
