"""The rule gates decide which stocks the AI may even consider — pin each one."""

from __future__ import annotations

from jobs.ai_top_picks import _growth, evaluate

GOOD_T = {"rsi_14": 62.0, "rel_volume_20d": 1.5, "dist_20dma_pct": 4.0, "dist_50dma_pct": 10.0, "dist_200dma_pct": 25.0}
GOOD_FUND = {"quarters": [
    {"label": "Q4 FY26", "period_end": "2026-03-31", "revenue_cr": 100.0, "net_income_cr": 10.0},
    {"label": "Q1 FY27", "period_end": "2026-06-30", "revenue_cr": 115.0, "net_income_cr": 13.0,
     "revenue_qoq_pct": 15.0, "net_income_qoq_pct": 30.0},
]}
PATTERN = {"code": "vcp", "stage": "forming", "confidence": 0.7, "pivot_price": 100.0,
           "stop_suggestion": 94.0, "target_suggestion": 120.0}


def test_clean_setup_is_eligible_with_our_numbers():
    c = evaluate("X", GOOD_T, PATTERN, 98.0, GOOD_FUND)
    assert c is not None
    assert c["pattern"]["gap_to_pivot_pct"] == -2.0
    assert c["fundamentals"]["revenue_qoq_pct"] == 15.0


def test_downtrend_is_rejected():
    assert evaluate("X", {**GOOD_T, "dist_200dma_pct": -3.0}, PATTERN, 98.0, GOOD_FUND) is None
    assert evaluate("X", {**GOOD_T, "dist_50dma_pct": -1.0}, PATTERN, 98.0, GOOD_FUND) is None


def test_stretched_or_overheated_is_rejected():
    assert evaluate("X", {**GOOD_T, "dist_20dma_pct": 12.0}, PATTERN, 98.0, GOOD_FUND) is None
    assert evaluate("X", {**GOOD_T, "rsi_14": 78.0}, PATTERN, 98.0, GOOD_FUND) is None


def test_extended_past_pivot_is_rejected():
    assert evaluate("X", GOOD_T, PATTERN, 106.0, GOOD_FUND) is None  # +6% past pivot
    assert evaluate("X", GOOD_T, {**PATTERN, "stage": "extended"}, 101.0, GOOD_FUND) is None


def test_loss_making_or_shrinking_is_rejected():
    loss = {"quarters": [GOOD_FUND["quarters"][0], {**GOOD_FUND["quarters"][1], "net_income_cr": -2.0}]}
    shrink = {"quarters": [GOOD_FUND["quarters"][0],
                           {**GOOD_FUND["quarters"][1], "revenue_qoq_pct": -5.0, "net_income_qoq_pct": -8.0}]}
    assert evaluate("X", GOOD_T, PATTERN, 98.0, loss) is None
    assert evaluate("X", GOOD_T, PATTERN, 98.0, shrink) is None


def test_growth_ignores_non_adjacent_quarters():
    # Q1 then Q3 (a quarter missing) — "QoQ" between them would be a wrong number
    gap = {"quarters": [{**GOOD_FUND["quarters"][0], "period_end": "2025-12-31"},
                        {**GOOD_FUND["quarters"][1], "period_end": "2026-06-30"}]}
    assert _growth(gap) is None
    assert evaluate("X", GOOD_T, PATTERN, 98.0, gap) is None
