from __future__ import annotations

from datetime import date

from jobs.notify import evening_message, morning_message

SCAN = {
    "market": {"light": "red", "label": "Stay defensive", "advice": "Avoid new buys."},
    "ready": [{"symbol": "NRL", "ltp": 134.0, "pivot": 134.84, "gap_to_pivot_pct": -0.64, "rs": 98, "dry_up": True}],
    "rs_leaders": [{"symbol": "TBZ", "rs": 99}],
}
SCREENER = {
    "rows": [
        {"symbol": "TBZ", "ltp": 412.0, "change_pct": 4.2, "patterns": [
            {"code": "high_52w_breakout", "stage": "confirmed", "breakout_date": "2026-09-18",
             "pivot_price": 398.0, "stop_suggestion": 385.0, "breakout_volume_ratio": 2.1}]},
        {"symbol": "OLD", "ltp": 10.0, "change_pct": 1.0, "patterns": [
            {"code": "vcp", "stage": "confirmed", "breakout_date": "2026-09-11", "pivot_price": 9.0}]},
        {"symbol": "FORMING", "ltp": 50.0, "change_pct": 0.5, "patterns": [
            {"code": "vcp", "stage": "forming", "breakout_date": None, "pivot_price": 52.0}]},
    ]
}


def test_evening_lists_only_todays_confirmed_breakouts():
    msg = evening_message(date(2026, 9, 18), SCAN, SCREENER, [])
    assert "TBZ" in msg and "2.1× vol" in msg and "RS 99" in msg
    assert "OLD" not in msg  # broke out a week ago
    assert "FORMING" not in msg  # not confirmed
    assert "NRL" in msg and "dry-up" in msg
    assert "Market light is red" in msg


def test_evening_includes_watchlist_hits_and_escapes_html():
    hits = [{"symbol": "A&B<x>", "kind": "price_above", "threshold": 100.0, "price": 101.5}]
    msg = evening_message(date(2026, 9, 18), SCAN, SCREENER, hits)
    assert "<b>A&amp;B&lt;x&gt;</b> rose above ₹100.00 (hit ₹101.50)" in msg


def test_evening_silent_when_nothing_happened():
    assert evening_message(date(2026, 9, 18), {"market": SCAN["market"]}, {"rows": []}, []) is None


def test_morning_message_carries_cues_levels_and_checklist():
    brief = {
        "for_session": "2026-09-21",
        "global_cues": [
            {"label": "S&P 500", "change_pct": 0.05, "group": "US", "value": 1, "as_of": "x"},
            {"label": "Brent crude", "change_pct": -4.76, "group": "Macro", "value": 1, "as_of": "x"},
        ],
        "global_tone": {"tone": "positive"},
        "nifty": {"close": 23346.4, "r1": 23394.83, "pivot": 23340.72, "s1": 23292.28},
        "focus": [{"symbol": "TBZ"}, {"symbol": "NRL"}],
        "events": ["2 companies report results today."],
        "checklist": ["Market light is RED — no new buys."],
        "ai": {"headline": "Positive Asian cues", "points": ["Kospi +2.66%"]},
    }
    msg = morning_message(brief)
    assert "Morning brief · 2026-09-21" in msg
    assert "S&amp;P 500 +0.05%" in msg and "Brent crude -4.76%" in msg
    assert "R1 23,394.83" in msg and "pivot 23,340.72" in msg
    assert "TBZ, NRL" in msg and "report results today" in msg
    assert morning_message({}) is None
