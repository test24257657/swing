"""The chat model is told to quote numbers, never compute them — so the numbers
build_context computes are the ones a trader acts on. Pin them."""

from __future__ import annotations

import pytest

from app import store
from app.services.stock_chat import build_context, system_prompt


@pytest.fixture
def fake_store(monkeypatch):
    bars = [
        {"time": f"2026-08-{i + 1:02d}", "open": 100, "high": 101 + i, "low": 90, "close": 100 + i,
         "volume": 1}
        for i in range(30)
    ]  # last close 129, 52w high 130, 52w low 90
    state = {
        **{k: {} for k in store._state},
        "charts": {"ACME": {"symbol": "ACME", "name": "Acme Ltd", "as_of": "2026-08-30", "bars": bars,
                            "technicals": {"rsi_14": 72.1}}},
        "quotes": {"ACME": {"name": "Acme Ltd", "ltp": 129.0, "change_pct": 1.5}},
        "screener": {"rows": [{"symbol": "ACME", "patterns": [{
            "code": "vcp", "stage": "extended", "confidence": 0.8,
            "pivot_price": 120.0, "stop_suggestion": 116.1, "target_suggestion": 154.8,
        }]}]},
        "institutional": {"deals": [
            {"date": "2026-08-20", "symbol": "ACME", "client": "BIG FUND", "side": "BUY", "kind": "Block",
             "qty": 100000, "price": 115.0, "value": 11500000.0, "repeat": False},
            {"date": "2026-08-25", "symbol": "OTHER", "client": "X", "side": "BUY", "kind": "Bulk",
             "qty": 1, "price": 1.0, "value": 1.0, "repeat": False},
        ]},
    }
    monkeypatch.setattr(store, "_state", state)


def test_unknown_symbol_returns_none(fake_store):
    assert build_context("NOPE") is None


def test_pivot_gap_stop_risk_and_reward_to_risk(fake_store):
    text, used = build_context("acme")
    # 129 vs pivot 120 = +7.50% -> past the 5% extended line
    assert "price is +7.50% vs pivot — EXTENDED" in text
    # stop 116.1 vs 129 = -10.00%; target 154.8 vs 129 = +20.00%; R:R = 20/10 = 2.0
    assert "suggested stop ₹116.10 = -10.00% from price" in text
    assert "target ₹154.80 = +20.00% from price" in text
    assert "reward-to-risk from today's price: 2.0" in text
    assert {"price", "technicals", "pattern", "deals"} <= set(used)


def test_move_since_deal_and_other_symbols_excluded(fake_store):
    text, _ = build_context("ACME")
    # 129 vs deal price 115 = +12.17%
    assert "BUY Block deal by BIG FUND — 100,000 shares at ₹115.00" in text
    assert "price has moved +12.17% since that deal price" in text
    assert "OTHER" not in text


def test_price_range_and_returns(fake_store):
    text, _ = build_context("ACME")
    assert "52-week high: ₹130.00 (price is -0.77% from it)" in text
    assert "52-week low: ₹90.00 (price is +43.33% from it)" in text
    # 1 week = 5 sessions back: 129 vs 124 = +4.03%
    assert "Return over 1 week: +4.03%" in text


def test_prompt_embeds_context_and_grounding_rules(fake_store):
    text, _ = build_context("ACME")
    from datetime import date

    prompt = system_prompt(text, date(2026, 8, 31))
    assert "TODAY: 2026-08-31" in prompt
    assert "Use ONLY the data in the STOCK DATA block" in prompt
    assert prompt.rstrip().endswith(text.rstrip())


def test_same_day_buy_and_sell_by_one_client_is_flagged_not_counted(fake_store):
    store._state["institutional"]["deals"] += [
        {"date": "2026-08-28", "symbol": "ACME", "client": "HFT DESK", "side": "BUY", "kind": "Bulk",
         "qty": 50000, "price": 128.0, "value": 64000000.0, "repeat": True},
        {"date": "2026-08-28", "symbol": "ACME", "client": "HFT DESK", "side": "SELL", "kind": "Bulk",
         "qty": 50000, "price": 128.5, "value": 64250000.0, "repeat": True},
    ]
    text, _ = build_context("ACME")
    assert text.count("OFFSETTING") == 2
    # only BIG FUND's buy counts: value 11,500,000 = ₹1.15 cr -> shown to 1 dp
    assert f"Net value of genuine (non-offsetting) deals: ₹{1.15:+,.1f} cr (net buying)" in text
