from __future__ import annotations

from datetime import datetime

import pandas as pd

from jobs.morning_brief import IST, _next_session, checklist, global_tone, nifty_levels


def test_floor_pivots_from_last_session():
    hist = pd.DataFrame({
        "date": pd.to_datetime(["2026-09-17", "2026-09-18"]),
        "high": [101.0, 110.0], "low": [99.0, 100.0], "close": [100.0, 105.0], "open": [100.0, 101.0],
    })
    lv = nifty_levels(hist)
    # P = (110 + 100 + 105) / 3 = 105; R1 = 2P - L = 110; S1 = 2P - H = 100; R2 = P + range = 115
    assert (lv["pivot"], lv["r1"], lv["s1"], lv["r2"], lv["s2"]) == (105.0, 110.0, 100.0, 115.0, 95.0)
    assert lv["session"] == "2026-09-18" and lv["sma_200"] is None  # not enough history → no number


def test_global_tone_is_rule_based():
    cues = [{"_ticker": t, "change_pct": v} for t, v in
            (("^GSPC", 1.0), ("^IXIC", 1.2), ("^N225", 0.8), ("^HSI", 0.5), ("^KS11", 0.6), ("BZ=F", 2.5))]
    t = global_tone(cues)
    assert t["tone"] == "positive" and t["crude_alert"] is True
    assert global_tone([{"_ticker": "^GSPC", "change_pct": -0.2}])["tone"] == "mixed"


def test_session_rolls_after_close_and_skips_weekend_and_holidays():
    fri_morning = datetime(2026, 9, 18, 8, 15, tzinfo=IST)
    fri_evening = datetime(2026, 9, 18, 19, 0, tzinfo=IST)
    assert _next_session(fri_morning, set()).isoformat() == "2026-09-18"
    assert _next_session(fri_evening, set()).isoformat() == "2026-09-21"            # Mon
    assert _next_session(fri_evening, {"2026-09-21"}).isoformat() == "2026-09-22"   # Mon holiday


def test_red_light_leads_the_checklist():
    items = checklist("red", {"tone": "negative", "crude_alert": False}, [], None)
    assert items[0].startswith("Market light is RED")
    assert any("first 15-30 minutes" in i for i in items)


def test_community_filter_drops_predictions_promo_and_offtopic():
    from datetime import date

    from jobs.morning_brief import filter_community

    def yt(title, views, summary=""):
        return {"source": "youtube", "title": title, "url": f"https://youtube.com/{title[:5]}",
                "published_at": "2026-09-17", "engagement": {"views": views}, "summary": summary,
                "relevance_score": 0.5}

    def rd(title, score, comments, sub="IndianStockMarket"):
        return {"source": "reddit", "title": title, "url": f"https://www.reddit.com/r/{sub}/comments/x/{title[:5]}",
                "published_at": "2026-09-17", "engagement": {"score": score, "num_comments": comments},
                "relevance_score": 0.4}

    results = [
        yt("Impact of Fed Rate Hike on Indian Stock Market", 60_000),
        yt("Big Prediction for Nifty! Watch Now", 139_000),                      # prediction
        yt("Market update", 40_000, summary="Start trading: x.in/referral?code=AB"),  # promo link
        yt("Nifty view", 900),                                                   # too few views
        rd("INR down 30%, Nifty up 31%", 675, 83),
        rd("I built a trading platform, paid beta", 0, 7),                       # self-promo
        rd("Best beginner resources to learn the market", 4, 16),               # off-topic
        rd("Old thread about the market", 900, 90) | {"published_at": "2026-09-01"},  # outside 3 days
        rd("Market right now 🫪🙏", 600, 40),                                     # meme, < 4 words
        yt("Fed decision explained for Indian investors", 90_000) | {"url": "javascript:alert(1)"},  # unsafe
    ]
    kept = filter_community(results, date(2026, 9, 18))
    assert [k["title"] for k in kept] == ["Impact of Fed Rate Hike on Indian Stock Market", "INR down 30%, Nifty up 31%"]
    assert kept[1]["where"] == "r/IndianStockMarket" and kept[1]["comments"] == 83
