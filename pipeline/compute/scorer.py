"""
pipeline/compute/scorer.py
100-Point Techno-Funda Composite Score engine.

Pillar A — Technical & RS (35 pts)
Pillar B — Setup & Volume/Delivery (25 pts)
Pillar C — Fundamentals & Smart Money (40 pts)

All functions are pure — input dicts, output score dicts.
"""

from __future__ import annotations

from datetime import date, datetime
import logging
from typing import Any, Optional

import polars as pl

from pipeline.config import (
    SCORE_RS_MAX,
    SCORE_STAGE_MAP,
    SCORE_ADR_BANDS,
    SCORE_RRG_MAP,
    SCORE_VCP_BANDS,
    SCORE_UPVOL_BANDS,
    SCORE_RVOL_BANDS,
    SCORE_DELIVERY_MULT,
    SCORE_DELIVERY_MILD,
    SCORE_EPS_QOQ_BANDS,
    SCORE_REV_QOQ_BANDS,
    SCORE_ROCE_BANDS,
    SCORE_DE_BANDS,
    SCORE_FII_QOQ_BANDS,
    SCORE_PLEDGE_BANDS,
    SCORE_BULK_DAYS_30,
    SCORE_BULK_DAYS_60,
)

log = logging.getLogger("pipeline.compute.scorer")


def score_all(
    technical_df: pl.DataFrame,
    fundamental_df: pl.DataFrame,
    pattern_df: pl.DataFrame,
    institutional_df: pl.DataFrame,
) -> pl.DataFrame:
    """
    Compute the 100-pt composite score for every stock in the universe.

    Args:
        technical_df: LatestTechnical-equivalent rows (one per stock, today)
        fundamental_df: Fundamental rows (one per stock, latest weekly update)
        pattern_df: Today's pattern signals
        institutional_df: Last 60 days of bulk/block/SAST activity

    Returns:
        DataFrame with: isin, technical_score, setup_score, fundamental_score, composite_score
    """
    log.info("Scoring %d stocks", len(technical_df))

    results = []
    tech_dicts = technical_df.to_dicts()
    fund_dict = {
        row["isin"]: row
        for row in fundamental_df.to_dicts()
    } if len(fundamental_df) > 0 else {}

    # Aggregate pattern signals per stock (best setup score)
    pattern_by_isin: dict[str, float] = {}
    if len(pattern_df) > 0:
        for row in pattern_df.to_dicts():
            isin = row["isin"]
            score = float(row.get("setup_score", 0))
            pattern_by_isin[isin] = max(pattern_by_isin.get(isin, 0), score)

    # Aggregate institutional activity per stock
    inst_by_isin: dict[str, dict] = {}
    if len(institutional_df) > 0:
        for row in institutional_df.to_dicts():
            isin = row.get("isin")
            if not isin:
                continue
            if isin not in inst_by_isin:
                inst_by_isin[isin] = {"days_30": False, "days_60": False, "has_buy": False}
            deal_date = row.get("tradeDate") or row.get("date")
            is_buy = (row.get("action") == "BUY") or str(row.get("kind", "")).endswith("BUY")
            if is_buy and deal_date:
                inst_by_isin[isin]["has_buy"] = True
                try:
                    if isinstance(deal_date, str):
                        deal_date = datetime.strptime(deal_date[:10], "%Y-%m-%d").date()
                    elif isinstance(deal_date, datetime):
                        deal_date = deal_date.date()
                    days_diff = (date.today() - deal_date).days
                    if days_diff <= 30:
                        inst_by_isin[isin]["days_30"] = True
                    if days_diff <= 60:
                        inst_by_isin[isin]["days_60"] = True
                except Exception:
                    inst_by_isin[isin]["days_30"] = True

    for row in tech_dicts:
        isin = row["isin"]
        fund = fund_dict.get(isin, {})
        inst = inst_by_isin.get(isin, {})
        pattern_score = pattern_by_isin.get(isin, 0.0)

        a = score_pillar_a(row)
        b = score_pillar_b(row, pattern_score)
        c = score_pillar_c(fund, inst)

        composite = round(a["total"] + b["total"] + c["total"], 1)

        results.append({
            "isin": isin,
            "technical_score": a["total"],
            "setup_score": b["total"],
            "fundamental_score": c["total"],
            "composite_score": composite,
            # Sub-scores for transparency
            "rs_score": a["rs"],
            "stage_score": a["stage"],
            "adr_score": a["adr"],
            "rrg_score": a["rrg"],
            "vcp_score": b["vcp"],
            "upvol_score": b["upvol"],
            "rvol_score": b["rvol"],
            "delivery_score": b["delivery"],
            "eps_score": c["eps"],
            "rev_score": c["revenue"],
            "roce_score": c["roce"],
            "de_score": c["de"],
            "fii_score": c["fii"],
            "pledge_score": c["pledge"],
            "bulk_score": c["bulk"],
        })

    result_df = pl.DataFrame(results)
    log.info(
        "Scoring complete. Composite score range: %.1f – %.1f",
        result_df["composite_score"].min(),
        result_df["composite_score"].max(),
    )

    return result_df


def score_pillar_a(row: dict) -> dict:
    """
    Pillar A — Technical & Relative Strength (35 pts max).

    Returns dict with individual component scores and total.
    """
    # RS Composite (15 pts) — percentile 1-99, scaled to 0-15
    rs_composite = row.get("rs_composite", 0) or 0
    rs_score = round(min(SCORE_RS_MAX, rs_composite / 99 * SCORE_RS_MAX), 2)

    # Weinstein Stage (10 pts)
    stage = row.get("weinstein_stage", "")
    stage_score = float(SCORE_STAGE_MAP.get(stage, 0))

    # ADR% (5 pts)
    adr = row.get("adr") or 0
    adr_score = _band_score(adr, SCORE_ADR_BANDS)

    # Sector RRG Quadrant (5 pts)
    rrg_quadrant = row.get("rrg_quadrant", "")
    rrg_score = float(SCORE_RRG_MAP.get(rrg_quadrant, 0))

    total = rs_score + stage_score + adr_score + rrg_score

    return {
        "total": round(min(35.0, total), 2),
        "rs": rs_score,
        "stage": stage_score,
        "adr": adr_score,
        "rrg": rrg_score,
    }


def score_pillar_b(row: dict, pattern_score: float) -> dict:
    """
    Pillar B — Setup & Volume/Delivery (25 pts max).

    pattern_score: pre-computed best pattern setup score (0-10 for VCP component).
    Returns dict with individual component scores and total.
    """
    # VCP Tightness (10 pts) — uses pre-computed pattern score
    vcp_score = min(10.0, pattern_score)

    # Up/Down Volume Ratio 10d (5 pts)
    upvol = row.get("up_down_vol_ratio") or 0
    upvol_score = _band_score(upvol, SCORE_UPVOL_BANDS)

    # RVOL (5 pts)
    rvol = row.get("rvol") or 0
    rvol_score = _band_score(rvol, SCORE_RVOL_BANDS)

    # Delivery % spike (5 pts)
    delivery_pct = row.get("delivery_pct") or 0
    delivery_avg = row.get("delivery_avg20d") or 0
    delivery_score = 0.0
    if delivery_avg > 0 and delivery_pct > 0:
        delivery_ratio = delivery_pct / delivery_avg
        if delivery_ratio >= SCORE_DELIVERY_MULT:
            delivery_score = 5.0
        elif delivery_ratio >= SCORE_DELIVERY_MILD:
            delivery_score = 3.0

    total = vcp_score + upvol_score + rvol_score + delivery_score

    return {
        "total": round(min(25.0, total), 2),
        "vcp": vcp_score,
        "upvol": upvol_score,
        "rvol": rvol_score,
        "delivery": delivery_score,
    }


def score_pillar_c(fund: dict, inst: dict) -> dict:
    """
    Pillar C — Fundamentals & Smart Money (40 pts max).

    fund: Fundamental row dict (or empty dict)
    inst: Aggregated institutional activity dict
    Returns dict with individual component scores and total.
    """
    # EPS QoQ acceleration (8 pts)
    eps_qoq = fund.get("eps_qoq") or 0
    eps_score = _band_score(eps_qoq / 100.0, SCORE_EPS_QOQ_BANDS)

    # Revenue QoQ acceleration (6 pts)
    rev_qoq = fund.get("revenue_qoq") or 0
    rev_score = _band_score(rev_qoq / 100.0, SCORE_REV_QOQ_BANDS)

    # ROCE (6 pts)
    roce = fund.get("roce") or 0
    roce_score = _band_score(roce / 100, SCORE_ROCE_BANDS)  # stored as %, compare as ratio

    # Debt/Equity (4 pts) — lower is better
    de = fund.get("debt_equity")
    if de is None:
        de_score = 2.0  # unknown — give middle score
    else:
        de_score = _de_score(de)

    # FII QoQ accumulation (6 pts) — percentage-point change
    fii_qoq = fund.get("fii_qoq") or 0
    fii_score = _band_score(fii_qoq, SCORE_FII_QOQ_BANDS)

    # Promoter Pledge (4 pts) — lower is better
    pledge = fund.get("promoter_pledge")
    if pledge is None:
        pledge_score = 2.0  # unknown — give middle score
    else:
        pledge_score = _pledge_score(pledge)

    # Bulk/Block/SAST buying (6 pts)
    has_buy_30d = inst.get("days_30", False)
    has_buy_60d = inst.get("has_buy", False)
    if has_buy_30d:
        bulk_score = float(SCORE_BULK_DAYS_30)
    elif has_buy_60d:
        bulk_score = float(SCORE_BULK_DAYS_60)
    else:
        bulk_score = 0.0

    total = eps_score + rev_score + roce_score + de_score + fii_score + pledge_score + bulk_score

    return {
        "total": round(min(40.0, total), 2),
        "eps": eps_score,
        "revenue": rev_score,
        "roce": roce_score,
        "de": de_score,
        "fii": fii_score,
        "pledge": pledge_score,
        "bulk": bulk_score,
    }


def _band_score(value: float, bands: list[tuple]) -> float:
    """
    Score a value against threshold bands.
    bands: [(threshold, points), ...] in descending threshold order.
    Returns points for the first band where value >= threshold.
    """
    for threshold, pts in sorted(bands, key=lambda x: -x[0]):
        if value >= threshold:
            return float(pts)
    return 0.0


def _de_score(de: float) -> float:
    """Score Debt/Equity ratio (lower is better)."""
    for threshold, pts in [(0.3, 4), (0.5, 3), (1.0, 2)]:
        if de <= threshold:
            return float(pts)
    return 0.0


def _pledge_score(pledge: float) -> float:
    """Score Promoter Pledge % (lower is better)."""
    if pledge <= 0:
        return 4.0
    elif pledge < 5:
        return 3.0
    elif pledge < 10:
        return 2.0
    else:
        return 0.0


def get_top_n(scored_df: pl.DataFrame, n: int = 15) -> pl.DataFrame:
    """Return the top N stocks by composite score."""
    return (
        scored_df
        .sort("composite_score", descending=True)
        .head(n)
    )
