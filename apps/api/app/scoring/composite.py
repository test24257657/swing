"""Composite score.

Weights are from the design's Stock Detail tooltip: momentum 35, delivery quality 25,
relative strength 20, earnings trend 20. Each sub-score is 0–100; the composite is the
weighted mean over the sub-scores that have data, renormalised.

**This is version 1 and is not yet validated.** The backtest harness
(``app/backtest/``) must show it beats buying NIFTY 500 over 2–3 years before it is
treated as anything more than a sort key. Until then the API flags scores as unvalidated.

All ranking here is *cross-sectional* — a stock is scored relative to the rest of the
universe on the same day — so scores must be recomputed for the whole universe at once.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from app.models.screener_score import SCORE_VERSION, WEIGHTS

VERDICT_BANDS = [(80.0, "V.Good"), (60.0, "Good"), (45.0, "Avg"), (0.0, "Poor")]


def verdict_for(score: float) -> str:
    for threshold, label in VERDICT_BANDS:
        if score >= threshold:
            return label
    return "Poor"


def _pct_rank(s: pd.Series) -> pd.Series:
    """Cross-sectional percentile rank in [0, 100]. NaNs stay NaN."""
    return s.rank(pct=True) * 100.0


def _rsi_band_score(rsi: pd.Series) -> pd.Series:
    """Healthy momentum RSI sits ~55–70. Reward that band, taper toward the extremes."""
    out = pd.Series(np.nan, index=rsi.index)
    out = out.mask(rsi.notna(), 50.0)
    out = out.mask((rsi >= 55) & (rsi <= 70), 100.0)
    out = out.mask((rsi >= 50) & (rsi < 55), 80.0)
    out = out.mask((rsi > 70) & (rsi <= 78), 70.0)
    out = out.mask((rsi > 78), 35.0)
    out = out.mask((rsi >= 45) & (rsi < 50), 55.0)
    out = out.mask((rsi < 45), 25.0)
    return out


def _ma_stack_score(df: pd.DataFrame) -> pd.Series:
    cols = ["above_sma_20", "above_sma_50", "above_sma_200"]
    present = df[cols].notna().any(axis=1)
    stacked = df[cols].fillna(False).astype(int).sum(axis=1) / 3.0 * 100.0
    return stacked.where(present, np.nan)


def momentum_sub(df: pd.DataFrame) -> pd.Series:
    ret_blend = 0.5 * df["ret_60d"].fillna(0) + 0.3 * df["ret_20d"].fillna(0) + 0.2 * df["ret_120d"].fillna(0)
    ret_blend = ret_blend.where(df[["ret_20d", "ret_60d"]].notna().any(axis=1), np.nan)
    parts = pd.concat(
        [_pct_rank(ret_blend), _ma_stack_score(df), _rsi_band_score(df["rsi_14"])],
        axis=1,
    )
    weights = np.array([0.5, 0.3, 0.2])
    return _weighted_rowmean(parts, weights)


def delivery_sub(df: pd.DataFrame) -> pd.Series:
    base = _pct_rank(df["delivery_pct_sma_20"])
    trend_bonus = df["delivery_trend"].map({"rising": 12.0, "flat": 0.0, "falling": -12.0})
    relvol = df["rel_volume"].clip(0, 3) / 3.0 * 100.0
    parts = pd.concat([base, relvol], axis=1)
    core = _weighted_rowmean(parts, np.array([0.75, 0.25]))
    return (core + trend_bonus.fillna(0)).clip(0, 100)


def relative_strength_sub(df: pd.DataFrame) -> pd.Series:
    return _pct_rank(df["rs_vs_sector_1m"])


def earnings_sub(net_profit_qoq: pd.Series) -> pd.Series:
    """`net_profit_qoq` = mean QoQ net-profit growth % over the last up-to-4 quarters.
    Map: <= −10% → 0, 0% → 50, >= +25% → 100 (clamped, linear between)."""
    x = net_profit_qoq
    scaled = np.where(
        x <= -10,
        0.0,
        np.where(x >= 25, 100.0, (x + 10) / 35 * 100.0),
    )
    return pd.Series(scaled, index=x.index).where(x.notna(), np.nan)


def _weighted_rowmean(parts: pd.DataFrame, weights: np.ndarray) -> pd.Series:
    vals = parts.to_numpy(dtype=float)
    w = np.where(np.isnan(vals), 0.0, weights)
    wsum = w.sum(axis=1)
    num = np.nansum(np.where(np.isnan(vals), 0.0, vals) * w, axis=1)
    out = np.where(wsum > 0, num / wsum, np.nan)
    return pd.Series(out, index=parts.index)


def score_cross_section(df: pd.DataFrame) -> pd.DataFrame:
    """
    ``df`` is indexed by symbol_id with the latest indicator columns plus an optional
    ``net_profit_qoq`` column. Returns a frame with the four sub-scores, the composite,
    verdict, inputs_present and weights.
    """
    subs = pd.DataFrame(index=df.index)
    subs["momentum_score"] = momentum_sub(df)
    subs["delivery_quality_score"] = delivery_sub(df)
    subs["relative_strength_score"] = relative_strength_sub(df)
    subs["earnings_trend_score"] = (
        earnings_sub(df["net_profit_qoq"])
        if "net_profit_qoq" in df.columns
        else pd.Series(np.nan, index=df.index)
    )

    w = np.array(
        [
            WEIGHTS["momentum"],
            WEIGHTS["delivery_quality"],
            WEIGHTS["relative_strength"],
            WEIGHTS["earnings_trend"],
        ]
    )
    vals = subs.to_numpy(dtype=float)
    mask = ~np.isnan(vals)
    wm = np.where(mask, w, 0.0)
    wsum = wm.sum(axis=1)
    composite = np.where(
        wsum > 0,
        np.nansum(np.where(mask, vals, 0.0) * wm, axis=1) / wsum,
        np.nan,
    )
    subs["inputs_present"] = mask.sum(axis=1)
    subs["composite_score"] = np.round(composite, 2)
    subs = subs.dropna(subset=["composite_score"])
    subs["verdict"] = subs["composite_score"].map(verdict_for)
    subs["weights"] = [dict(WEIGHTS)] * len(subs)
    subs["score_version"] = SCORE_VERSION
    return subs
