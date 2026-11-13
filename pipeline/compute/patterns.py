"""
pipeline/compute/patterns.py
Pattern detection engine: VCP, Pocket Pivot, 52WH Breakout, 21EMA Pullback, IPO Base.

All detectors are pure functions over OHLCV DataFrames.
Returns one PatternSignal dict per match.
"""

from __future__ import annotations

import logging
from datetime import date
from typing import Optional

import polars as pl

from pipeline.config import (
    VCP_LOOKBACK_DAYS,
    VCP_MIN_CONTRACTIONS,
    VCP_CONTRACTION_RATIO,
    VCP_PIVOT_BUFFER,
    VCP_STOP_ATR_MULT,
    VCP_SCORE_TIGHT_THRESHOLD,
    VCP_SCORE_LOOSE_THRESHOLD,
    POCKET_PIVOT_LOOKBACK,
    POCKET_PIVOT_MIN_VOL_MULT,
    BREAKOUT_52WH_VOL_MULT,
    PULLBACK_21EMA_MAX_PCT,
)

log = logging.getLogger("pipeline.compute.patterns")


def detect_all_patterns(
    df: pl.DataFrame,
    universe_isins: set[str],
) -> list[dict]:
    """
    Run all pattern detectors against the full universe.

    Args:
        df: OHLCV + indicators DataFrame, sorted (isin, date), 2yr history
        universe_isins: set of ISINs in the clean universe

    Returns:
        List of PatternSignal dicts for today's detected patterns.
    """
    signals = []
    today = df["date"].max()

    for isin in universe_isins:
        stock_df = (
            df.filter(pl.col("isin") == isin)
              .sort("date")
        )

        if len(stock_df) < 60:
            continue

        latest = stock_df.tail(1).to_dicts()[0]
        sym = latest.get("symbol")
        rvol_val = float(latest.get("rvol") or 1.0)
        deliv_val = float(latest.get("delivery_pct") or 0.0)
        rs_val = int(latest.get("rs_composite") or latest.get("rs3m") or 50)

        # Run each detector
        for detector in [
            detect_vcp,
            detect_pocket_pivot,
            detect_52wh_breakout,
            detect_21ema_pullback,
            detect_ipo_base,
        ]:
            signal = detector(stock_df, latest, today)
            if signal:
                if sym:
                    signal["symbol"] = sym
                if "rvol" not in signal:
                    signal["rvol"] = rvol_val
                if "deliveryPct" not in signal:
                    signal["deliveryPct"] = deliv_val
                if "rsRating" not in signal:
                    signal["rsRating"] = rs_val
                signals.append(signal)

    log.info("Pattern detection: %d signals found across %d stocks",
             len(signals), len(universe_isins))
    return signals


def detect_vcp(
    df: pl.DataFrame,
    latest: dict,
    today,
) -> Optional[dict]:
    """
    Detect Volatility Contraction Pattern (VCP) — Mark Minervini.

    Requires:
    1. Stage 2 stock (close > sma150 > sma200, sma200_slope > 0)
    2. At least VCP_MIN_CONTRACTIONS tightening contractions in last 60 days
    3. Each contraction range < 75% of prior
    4. Volume drying up in each contraction

    Returns PatternSignal dict or None.
    """
    if latest.get("weinstein_stage") not in ("2A", "2B"):
        return None

    # Window: last 60 trading days
    window = df.tail(VCP_LOOKBACK_DAYS)
    if len(window) < 20:
        return None

    closes = window["close"].to_list()
    highs = window["high"].to_list()
    lows = window["low"].to_list()
    volumes = window["volume"].to_list()

    # Find local swing highs and lows (simple pivot detection)
    contractions = _find_contractions(highs, lows, closes)

    if len(contractions) < VCP_MIN_CONTRACTIONS:
        return None

    # Check tightening: each contraction range < 75% of prior
    for i in range(1, len(contractions)):
        if contractions[i]["range_pct"] >= contractions[i-1]["range_pct"] * VCP_CONTRACTION_RATIO:
            return None  # Not tightening

    latest_contraction = contractions[-1]
    latest_range_pct = latest_contraction["range_pct"]

    # VCP score: how tight is the latest contraction?
    if latest_range_pct <= VCP_SCORE_TIGHT_THRESHOLD:
        vcp_score = 10.0
    elif latest_range_pct <= VCP_SCORE_LOOSE_THRESHOLD:
        vcp_score = 10.0 * (1 - (latest_range_pct - VCP_SCORE_TIGHT_THRESHOLD) / (
            VCP_SCORE_LOOSE_THRESHOLD - VCP_SCORE_TIGHT_THRESHOLD
        ))
    else:
        vcp_score = 0.0

    if vcp_score == 0.0:
        return None

    # Entry / risk levels
    pivot = latest_contraction["high"] * (1 + VCP_PIVOT_BUFFER)
    atr = latest.get("atr14") or (latest["close"] * 0.03)
    stop = latest_contraction["low"] - atr * VCP_STOP_ATR_MULT
    t1 = round(pivot + 2.0 * (pivot - stop), 2)
    t2 = round(pivot + 3.5 * (pivot - stop), 2)
    risk_pct = round((pivot - stop) / max(pivot, 0.01) * 100, 2)

    # Setup score contribution (max 25 pts for VCP alone)
    setup_score = min(vcp_score, 10.0)

    return {
        "isin": latest["isin"],
        "date": today,
        "pattern": "VCP",
        "setupType": "VCP",
        "pivot": round(pivot, 2),
        "pivotPrice": round(pivot, 2),
        "stop": round(stop, 2),
        "stopLossPrice": round(stop, 2),
        "target": t1,
        "target1Price": t1,
        "target2Price": t2,
        "riskPct": risk_pct,
        "risk_reward": round((t1 - pivot) / max(pivot - stop, 0.01), 2),
        "vcp_tightness": round(latest_range_pct * 100, 2),
        "vcp_contractions": len(contractions),
        "setup_score": round(setup_score, 2),
    }


def detect_pocket_pivot(
    df: pl.DataFrame,
    latest: dict,
    today,
) -> Optional[dict]:
    """
    Detect Pocket Pivot (William O'Neil / Gil Morales).

    A Pocket Pivot is:
    1. Stock in uptrend (Stage 2)
    2. Today's volume > maximum down-day volume in last 10 sessions
    3. Stock above its 10-day EMA or 50-day SMA
    """
    if latest.get("weinstein_stage") not in ("2A", "2B"):
        return None

    # Must be up day
    window = df.tail(11)
    if len(window) < 11:
        return None

    prev_closes = window["close"].to_list()
    volumes = window["volume"].to_list()

    # Is today an up day?
    if prev_closes[-1] <= prev_closes[-2]:
        return None

    today_vol = volumes[-1]

    # Max down-day volume in last 10 sessions (excluding today)
    down_vols = []
    for i in range(len(volumes) - 1):
        if i > 0 and prev_closes[i] < prev_closes[i-1]:
            down_vols.append(volumes[i])

    if not down_vols:
        return None

    max_down_vol = max(down_vols)

    if today_vol < max_down_vol * POCKET_PIVOT_MIN_VOL_MULT:
        return None

    # Must be near EMA10 or SMA50 (not extended)
    close = latest["close"]
    ema10 = latest.get("ema10")
    sma50 = latest.get("sma50")

    if ema10 and close > ema10 * 1.05:
        return None  # Too extended above EMA10

    vol_ratio = today_vol / max_down_vol
    setup_score = min(7.5, 5.0 + 2.5 * (vol_ratio - 1))
    pivot = close
    stop = close * 0.93  # 7% below entry
    t1 = round(pivot + 2.0 * (pivot - stop), 2)
    t2 = round(pivot + 3.5 * (pivot - stop), 2)
    risk_pct = round((pivot - stop) / max(pivot, 0.01) * 100, 2)

    return {
        "isin": latest["isin"],
        "date": today,
        "pattern": "POCKET_PIVOT",
        "setupType": "POCKET_PIVOT",
        "pivot": round(pivot, 2),
        "pivotPrice": round(pivot, 2),
        "stop": round(stop, 2),
        "stopLossPrice": round(stop, 2),
        "target": t1,
        "target1Price": t1,
        "target2Price": t2,
        "riskPct": risk_pct,
        "risk_reward": 2.0,
        "pocket_pivot_vol": round(vol_ratio, 2),
        "setup_score": round(setup_score, 2),
    }


def detect_52wh_breakout(
    df: pl.DataFrame,
    latest: dict,
    today,
) -> Optional[dict]:
    """
    Detect 52-Week High Breakout with volume confirmation.

    Requires:
    1. Today's close >= 52-week high (or within 0.5% — on the day of breakout)
    2. Volume >= 1.5× 20-day average
    3. Stage 2 stock
    """
    close = latest.get("close", 0)
    high52w = latest.get("high52w")
    rvol = latest.get("rvol", 0)
    stage = latest.get("weinstein_stage", "")

    if not high52w or not rvol:
        return None

    if stage not in ("2A", "2B"):
        return None

    # Close must be at or above 52w high (breakout day)
    if close < high52w * 0.995:
        return None

    if rvol < BREAKOUT_52WH_VOL_MULT:
        return None

    atr = latest.get("atr14") or (close * 0.03)
    pivot = close  # Enter at the close on breakout day
    stop = close - 2 * atr
    t1 = round(pivot + 2.0 * (pivot - stop), 2)
    t2 = round(pivot + 3.5 * (pivot - stop), 2)
    risk_pct = round((pivot - stop) / max(pivot, 0.01) * 100, 2)

    setup_score = min(12.5, 7.5 + 5.0 * (rvol - BREAKOUT_52WH_VOL_MULT))

    return {
        "isin": latest["isin"],
        "date": today,
        "pattern": "52W_BREAKOUT",
        "setupType": "52W_BREAKOUT",
        "pivot": round(pivot, 2),
        "pivotPrice": round(pivot, 2),
        "stop": round(stop, 2),
        "stopLossPrice": round(stop, 2),
        "target": t1,
        "target1Price": t1,
        "target2Price": t2,
        "riskPct": risk_pct,
        "risk_reward": 2.0,
        "breakout_vol": round(rvol, 2),
        "setup_score": round(setup_score, 2),
    }


def detect_21ema_pullback(
    df: pl.DataFrame,
    latest: dict,
    today,
) -> Optional[dict]:
    """
    Detect 21 EMA Pullback — stock in confirmed Stage 2B pullback to rising 21 EMA.

    Requires:
    1. Stage 2B (close > sma50 > sma150 > sma200, sma200 rising)
    2. Close within PULLBACK_21EMA_MAX_PCT (3%) below the 21 EMA
    3. EMA21 is rising (positive slope)
    """
    stage = latest.get("weinstein_stage", "")
    if stage != "2B":
        return None

    close = latest.get("close", 0)
    ema21 = latest.get("ema21")
    if not ema21 or close <= 0:
        return None

    # Close must be near (within 3% below) the 21 EMA
    pct_from_ema = (close - ema21) / ema21
    if pct_from_ema < -PULLBACK_21EMA_MAX_PCT or pct_from_ema > 0.02:
        return None  # Too far below or already extended above

    # Check EMA21 slope (rising)
    window = df.tail(5)
    if len(window) < 5:
        return None
    ema_vals = window["ema21"].drop_nulls().to_list()
    if len(ema_vals) < 3 or ema_vals[-1] <= ema_vals[-3]:
        return None  # EMA not rising

    atr = latest.get("atr14") or (close * 0.03)
    pivot = ema21 * 1.01  # Entry slightly above EMA21
    stop = ema21 * 0.93  # 7% below EMA21
    t1 = round(pivot + 2.0 * (pivot - stop), 2)
    t2 = round(pivot + 3.5 * (pivot - stop), 2)
    risk_pct = round((pivot - stop) / max(pivot, 0.01) * 100, 2)

    setup_score = 8.0 + max(0, 4.0 * (PULLBACK_21EMA_MAX_PCT - abs(pct_from_ema)) / PULLBACK_21EMA_MAX_PCT)

    return {
        "isin": latest["isin"],
        "date": today,
        "pattern": "PULLBACK_21EMA",
        "setupType": "PULLBACK_21EMA",
        "pivot": round(pivot, 2),
        "pivotPrice": round(pivot, 2),
        "stop": round(stop, 2),
        "stopLossPrice": round(stop, 2),
        "target": t1,
        "target1Price": t1,
        "target2Price": t2,
        "riskPct": risk_pct,
        "risk_reward": 2.0,
        "pullback_depth": round(pct_from_ema * 100, 2),
        "setup_score": round(min(12.0, setup_score), 2),
    }


def detect_ipo_base(
    df: pl.DataFrame,
    latest: dict,
    today,
) -> Optional[dict]:
    """
    Detect IPO Base breakout — stock less than 2 years old with a tight consolidation.

    An IPO base:
    1. Stock listed < 2 years ago (limited history in our parquet)
    2. Has formed a base (range < 20% from pivot)
    3. Volume is compressing in the base
    """
    if len(df) > 400:
        return None  # Too much history — not an IPO base

    if len(df) < 20:
        return None

    # Base: last 30-60 days
    base_window = df.tail(min(60, len(df)))
    base_high = base_window["high"].max()
    base_low = base_window["low"].min()

    if base_high <= 0 or base_low <= 0:
        return None

    base_range_pct = (base_high - base_low) / base_low

    # IPO base must be < 25% wide
    if base_range_pct > 0.25:
        return None

    close = latest.get("close", 0)

    pivot = base_high * 1.02
    stop = base_low * 0.97
    t1 = round(pivot + 2.0 * (pivot - stop), 2)
    t2 = round(pivot + 3.5 * (pivot - stop), 2)
    risk_pct = round((pivot - stop) / max(pivot, 0.01) * 100, 2)

    setup_score = 8.0 * (1 - base_range_pct / 0.25) + 4.0  # Tighter base = higher score

    return {
        "isin": latest["isin"],
        "date": today,
        "pattern": "IPO_BASE",
        "setupType": "IPO_BASE",
        "pivot": round(pivot, 2),
        "pivotPrice": round(pivot, 2),
        "stop": round(stop, 2),
        "stopLossPrice": round(stop, 2),
        "target": t1,
        "target1Price": t1,
        "target2Price": t2,
        "riskPct": risk_pct,
        "risk_reward": 2.0,
        "vcp_tightness": round(base_range_pct * 100, 2),
        "setup_score": round(min(12.0, setup_score), 2),
    }


def _find_contractions(
    highs: list[float],
    lows: list[float],
    closes: list[float],
    min_bars: int = 5,
) -> list[dict]:
    """
    Find successive price contractions in a window.
    A contraction is a local peak-to-trough range.
    Returns list of dicts with {high, low, range_pct}.
    """
    if len(highs) < min_bars * 2:
        return []

    n = len(highs)
    contractions = []

    # Simple swing high/low detection (3-bar pivot)
    swing_highs = []
    swing_lows = []

    for i in range(2, n - 2):
        if highs[i] >= highs[i-1] and highs[i] >= highs[i+1] and highs[i] >= highs[i-2]:
            swing_highs.append((i, highs[i]))
        if lows[i] <= lows[i-1] and lows[i] <= lows[i+1] and lows[i] <= lows[i-2]:
            swing_lows.append((i, lows[i]))

    # Match swing high → swing low pairs
    sh_idx = 0
    sl_idx = 0
    while sh_idx < len(swing_highs) and sl_idx < len(swing_lows):
        sh_pos, sh_val = swing_highs[sh_idx]
        sl_pos, sl_val = swing_lows[sl_idx]

        if sl_pos > sh_pos:
            # Found a high→low pair (contraction)
            range_pct = (sh_val - sl_val) / sl_val
            contractions.append({
                "high": sh_val,
                "low": sl_val,
                "range_pct": range_pct,
            })
            sh_idx += 1
            sl_idx += 1
        elif sl_pos <= sh_pos:
            sl_idx += 1
        else:
            sh_idx += 1

    return contractions
