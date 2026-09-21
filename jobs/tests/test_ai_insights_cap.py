"""The per-stock AI read is the only per-symbol Gemini cost — pin the cap."""

from __future__ import annotations

from unittest.mock import patch

import pandas as pd

from jobs import ai_insights
from jobs.config import AI_INSIGHT_BATCH_SIZE, AI_INSIGHT_MAX_SYMBOLS


class _Client:
    def close(self):
        return None


def _build(symbols: list[str]):
    panel = pd.DataFrame({"symbol": symbols, "date": pd.Timestamp("2026-09-18"), "close": 1.0})
    with (
        patch.object(ai_insights, "_digest_symbol", lambda s, *a, **k: f"{s}: technicals"),
        patch.object(ai_insights, "financial_results_client", _Client),
        patch.object(
            ai_insights, "_classify_batch",
            lambda batch: {s: {"verdict": "neutral", "summary": ""} for s, _ in batch},
        ),
    ):
        return ai_insights.build(panel, symbols, {"rows": []}, {"items": []})


def test_caps_at_the_configured_symbol_count():
    _, stats = _build([f"SYM{i}" for i in range(400)])
    assert stats["universe"] == 400
    assert stats["scoped"] == AI_INSIGHT_MAX_SYMBOLS == 150
    assert stats["gemini_calls"] == -(-AI_INSIGHT_MAX_SYMBOLS // AI_INSIGHT_BATCH_SIZE) == 10


def test_keeps_priority_order_and_does_not_pad_a_small_universe():
    symbols = [f"SYM{i}" for i in range(20)]
    payloads, stats = _build(symbols)
    assert stats["scoped"] == 20 and stats["gemini_calls"] == 2
    assert "SYM0" in payloads and "SYM19" in payloads  # nothing dropped below the cap
