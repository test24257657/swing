"""Synthetic golden tests for the pattern detectors.

Real-chart precision/recall (hand-labelling ~100 charts) is a separate gate that needs
ingested data. These tests pin the detector *logic* against hand-built series that
clearly should or should not trigger — so a retune that breaks the intent fails here.
"""

from __future__ import annotations

from datetime import date

import numpy as np
import pandas as pd

from jobs.patterns.base import DetectContext
from jobs.patterns.detect import detect_all
from jobs.patterns.high_52w_breakout import detect as detect_52w
from jobs.patterns.ipo_base import detect as detect_ipo
from jobs.patterns.near_pivot import detect as detect_near
from jobs.patterns.stage import classify_stage
from jobs.patterns.vcp import detect as detect_vcp


def _frame(close: list[float], vol: list[float] | None = None, start="2025-01-01") -> pd.DataFrame:
    idx = pd.bdate_range(start=start, periods=len(close))
    c = np.array(close, dtype=float)
    vol = vol if vol is not None else [1_000_000.0] * len(close)
    return pd.DataFrame(
        {
            "high": c * 1.01,
            "low": c * 0.99,
            "close": c,
            "volume": np.array(vol, dtype=float),
        },
        index=idx,
    )


def _ctx(**kw) -> DetectContext:
    base = {"listing_date": None, "vol_sma_20": 1_000_000.0, "high_52w": None, "atr_14": 5.0}
    base.update(kw)
    return DetectContext(**base)


# ---- 52-week high breakout -------------------------------------------------------------


def test_52w_breakout_confirmed_on_volume():
    # long flat base at 100, then one session thrusts above it on 2.5x volume
    close = [100.0] * 251 + [104.0]
    vol = [1_000_000.0] * 251 + [2_500_000.0]
    m = detect_52w(_frame(close, vol), _ctx(vol_sma_20=1_000_000.0))
    assert m is not None and m.pattern_code == "high_52w_breakout"
    assert m.stage == "confirmed"
    assert m.pivot_price == 100.0
    assert (m.breakout_volume_ratio or 0) >= 1.4


def test_52w_breakout_silent_in_midrange():
    close = list(100 + 5 * np.sin(np.linspace(0, 12, 260)))  # oscillating, never a new high late
    assert detect_52w(_frame(close), _ctx()) is None


# ---- near pivot -----------------------------------------------------------------------


def test_near_pivot_fires_below_tested_resistance():
    # three touches of ~110 resistance, currently at 108 (not through)
    close = (
        list(np.linspace(95, 110, 12))
        + list(np.linspace(110, 101, 10))
        + list(np.linspace(101, 110, 10))
        + list(np.linspace(110, 103, 8))
        + list(np.linspace(103, 108, 6))
    )
    m = detect_near(_frame(close), _ctx())
    assert m is not None and m.pattern_code == "near_pivot"
    assert m.stage == "forming"
    assert 109 <= (m.pivot_price or 0) <= 112


def test_near_pivot_silent_when_already_broken_out():
    close = list(np.linspace(95, 110, 20)) + list(np.linspace(110, 101, 10)) + list(np.linspace(101, 130, 20))
    assert detect_near(_frame(close), _ctx()) is None


# ---- VCP ----------------------------------------------------------------------------


def test_vcp_fires_on_decreasing_pullbacks():
    seg = (
        list(np.linspace(80, 100, 10))  # run up
        + list(np.linspace(100, 86, 6))  # -14%
        + list(np.linspace(86, 100, 8))
        + list(np.linspace(100, 93, 5))  # -7%
        + list(np.linspace(93, 100, 6))
        + list(np.linspace(100, 97, 4))  # -3%
        + list(np.linspace(97, 99, 3))
    )
    close = [80.0] * (85 - len(seg)) + seg
    vol = [2_000_000.0] * (len(close) - 15) + [900_000.0] * 15  # volume drying into the pivot
    m = detect_vcp(_frame(close, vol), _ctx())
    assert m is not None and m.pattern_code == "vcp"
    assert len(m.meta["contractions"]) >= 2
    assert m.meta["contractions"][-1]["depth_pct"] <= m.meta["contractions"][0]["depth_pct"] + 1.5


def test_vcp_silent_on_random_walk():
    rng = np.random.default_rng(42)
    close = list(100 + np.cumsum(rng.normal(0, 1.5, 90)))
    assert detect_vcp(_frame(close), _ctx()) is None


# ---- IPO base ----------------------------------------------------------------------


def test_ipo_base_fires_for_recent_listing_tight_range():
    listing = date(2025, 1, 1)
    close = list(100 + 4 * np.sin(np.linspace(0, 8, 40)))  # tight ~8% band
    m = detect_ipo(_frame(close, start="2025-01-01"), _ctx(listing_date=listing))
    assert m is not None and m.pattern_code == "ipo_base"
    assert m.base_weeks >= 4


def test_ipo_base_silent_for_old_listing():
    listing = date(2018, 1, 1)
    close = list(100 + 4 * np.sin(np.linspace(0, 8, 40)))
    assert detect_ipo(_frame(close), _ctx(listing_date=listing)) is None


# ---- stage classifier -------------------------------------------------------------


def test_stage_extended_when_far_past_pivot():
    close = pd.Series([100.0] * 5 + [108.0])  # 8% past a pivot of 100
    stage, _, _ = classify_stage(close, pd.Series([1e6] * 6), pivot=100.0, vol_sma_20=1e6)
    assert stage == "extended"


def test_stage_forming_when_not_crossed():
    close = pd.Series([95.0, 96.0, 97.0, 98.0])
    stage, bd, _ = classify_stage(close, pd.Series([1e6] * 4), pivot=100.0, vol_sma_20=1e6)
    assert stage == "forming" and bd is None


# ---- orchestrator ---------------------------------------------------------------


def test_detect_all_filters_low_confidence_and_dedupes():
    close = [100.0] * 240 + list(np.linspace(100, 118, 12))
    vol = [1_000_000.0] * 249 + [2_500_000.0] * 3
    matches = detect_all(_frame(close, vol), _ctx())
    assert all(m.confidence >= 0.35 for m in matches)
    codes = {m.pattern_code for m in matches}
    assert not ("vcp" in codes and "near_pivot" in codes)
