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
from jobs.patterns.trendline_breakout import detect as detect_trendline
from jobs.patterns.vcp import detect as detect_vcp

# A context whose trend-template legs all pass, and one that clearly fails: price below
# every average, averages inverted, 200-day rolling over. Used to pin that the VCP gate
# is actually load-bearing rather than decorative.
UPTREND = {
    "sma_50": 95.0,
    "sma_150": 90.0,
    "sma_200": 85.0,
    "sma_200_month_ago": 80.0,
    "low_52w": 60.0,
    "high_52w": 105.0,
}
DOWNTREND = {
    "sma_50": 120.0,
    "sma_150": 130.0,
    "sma_200": 140.0,
    "sma_200_month_ago": 150.0,
    "low_52w": 90.0,
    "high_52w": 200.0,
}


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


def _vcp_shaped_series() -> tuple[list[float], list[float]]:
    """The exact contracting-pullback shape the VCP detector is built to find."""
    seg = (
        list(np.linspace(80, 100, 10))
        + list(np.linspace(100, 86, 6))  # -14%
        + list(np.linspace(86, 100, 8))
        + list(np.linspace(100, 93, 5))  # -7%
        + list(np.linspace(93, 100, 6))
        + list(np.linspace(100, 97, 4))  # -3%
        + list(np.linspace(97, 99, 3))
    )
    close = [80.0] * (85 - len(seg)) + seg
    vol = [2_000_000.0] * (len(close) - 15) + [900_000.0] * 15
    return close, vol


def test_vcp_rejected_in_downtrend_despite_perfect_contractions():
    """The whole point of the trend gate: this is a textbook contraction shape, and it
    must still be refused when the stock is under all its averages with the 200-day
    rolling over. Contracting pullbacks in a downtrend are a pause, not a VCP."""
    close, vol = _vcp_shaped_series()
    assert detect_vcp(_frame(close, vol), _ctx(**DOWNTREND)) is None


def test_vcp_fires_on_same_shape_in_uptrend():
    """Same series, healthy trend context — the gate must not block a real setup."""
    close, vol = _vcp_shaped_series()
    m = detect_vcp(_frame(close, vol), _ctx(**UPTREND))
    assert m is not None and m.pattern_code == "vcp"
    assert all(m.meta["trend_template"].values())


def test_vcp_rejected_when_only_the_200dma_slope_fails():
    """One failing leg is enough — a stacked-but-rolling-over 200-day is the classic
    late-stage trap the template exists to catch."""
    close, vol = _vcp_shaped_series()
    ctx = _ctx(**{**UPTREND, "sma_200_month_ago": 90.0})  # 200-day now falling
    assert detect_vcp(_frame(close, vol), ctx) is None


# ---- trendline breakout ---------------------------------------------------------------


def _descending_highs() -> tuple[list[float], list[float]]:
    """Three rallies, each turned back lower than the last — a falling ceiling — with
    price drifting under it and then thrusting through on volume in the last two
    sessions. The break is deliberately *fresh*: the detector only reports breaks the
    ceiling was still containing recently, which is the point of a nightly screener."""
    close = (
        [88.0] * 8
        + list(np.linspace(88, 120, 12))  # rally into the anchor high
        + list(np.linspace(120, 101, 10))
        + list(np.linspace(101, 114, 12))  # second, lower
        + list(np.linspace(114, 100, 10))
        + list(np.linspace(100, 108, 12))  # third, lower again
        + list(np.linspace(108, 99, 10))
        + list(np.linspace(99, 102, 19))  # coiling under the descending line
        + [104.0, 107.0]  # the break, on volume
    )
    vol = [1_000_000.0] * (len(close) - 2) + [2_600_000.0, 2_200_000.0]
    return close, vol


def test_trendline_breakout_fires_on_descending_resistance():
    close, vol = _descending_highs()
    m = detect_trendline(_frame(close, vol), _ctx())
    assert m is not None and m.pattern_code == "trendline_breakout"
    assert m.stage == "confirmed"
    assert m.meta["touches"] >= 3
    assert m.meta["slope_pct_per_session"] < 0  # the ceiling really was falling


def test_trendline_breakout_needs_volume_behind_the_break():
    """Same break, no volume — must stay silent. An unconfirmed cross of a falling line
    is the single largest false-positive source measured on random walks."""
    close, _ = _descending_highs()
    flat_vol = [1_000_000.0] * len(close)
    assert detect_trendline(_frame(close, flat_vol), _ctx()) is None


def test_trendline_breakout_silent_on_flat_resistance():
    """A horizontal ceiling is the 52-week/near-pivot detectors' job — this one must not
    also claim it, or every flat base double-counts as two patterns."""
    close = (
        list(np.linspace(90, 110, 12))
        + list(np.linspace(110, 101, 10))
        + list(np.linspace(101, 110, 12))
        + list(np.linspace(110, 102, 10))
        + list(np.linspace(102, 110, 12))
        + list(np.linspace(110, 104, 10))
        + list(np.linspace(104, 109, 30))
    )
    assert detect_trendline(_frame(close), _ctx()) is None


def test_trendline_breakout_silent_on_random_walk():
    rng = np.random.default_rng(7)
    close = list(100 + np.cumsum(rng.normal(0, 1.2, 100)))
    assert detect_trendline(_frame(close), _ctx()) is None


def test_trendline_breakout_silent_when_still_pinned_to_the_lows():
    """A falling line eventually catches up with any decline, so 'price crossed it'
    while the stock sits on its own lows is the downtrend continuing at a gentler
    angle — not a reversal. This was a real false positive before the floor check."""
    close = (
        list(np.linspace(120, 104, 25))  # steady grind down
        + list(np.linspace(104, 96, 25))
        + list(np.linspace(96, 88, 25))
        + list(np.linspace(88, 84, 20))  # still making lows, no thrust off the floor
    )
    assert detect_trendline(_frame(close), _ctx()) is None


def test_trendline_breakout_random_walk_false_positive_rate_is_low():
    """Across many random walks the detector should almost never fire. Lower highs are
    trivially present in noise, so this is the honest guard against the pattern being
    pareidolia — it pins the rate rather than trusting one lucky seed."""
    fired = 0
    for seed in range(60):
        rng = np.random.default_rng(seed)
        close = list(100 + np.cumsum(rng.normal(0, 1.2, 100)))
        if detect_trendline(_frame(close), _ctx()) is not None:
            fired += 1
    assert fired <= 3, f"fired on {fired}/60 random walks — detector is finding noise"


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


def test_ipo_base_silent_once_past_the_first_trading_year():
    """After ~250 sessions the stock has ordinary chart history — its bases are normal
    bases, and calling them 'IPO bases' was the loosest part of the old rule."""
    listing = date(2025, 1, 1)
    close = list(100 + 4 * np.sin(np.linspace(0, 40, 300)))
    assert detect_ipo(_frame(close, start="2025-01-01"), _ctx(listing_date=listing)) is None


def test_ipo_base_breakout_needs_2x_volume_not_1_5x():
    """First-base breakouts fail often on thin volume, so this detector demands a
    bigger thrust (2x) than the shared 1.4x default. 1.5x must read as still forming."""
    listing = date(2025, 1, 1)
    base = list(100 + 3 * np.sin(np.linspace(0, 8, 45)))
    close = base + [108.0]  # pushes through the base high
    vol = [1_000_000.0] * len(base) + [1_500_000.0]  # 1.5x — enough for other patterns
    m = detect_ipo(_frame(close, vol, start="2025-01-01"), _ctx(listing_date=listing))
    assert m is not None and m.stage == "forming"

    vol_strong = [1_000_000.0] * len(base) + [2_400_000.0]  # 2.4x — a real thrust
    m2 = detect_ipo(_frame(close, vol_strong, start="2025-01-01"), _ctx(listing_date=listing))
    assert m2 is not None and m2.stage == "confirmed"


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
