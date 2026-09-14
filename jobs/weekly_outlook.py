"""Weekly AI market outlook — one Gemini call a week (Friday close), synthesizing
market breadth, volatility, FII/DII flows, sector rotation and the broad indices into
one "which way does the market lean next week" call, with a mem0-backed memory of its
own past calls so it can grade itself before making a new one.

Deliberately scoped to the market-wide picture only — breadth/volatility/flows/
sectors/indices — not news or institutional deals: those move day to day and are
already surfaced daily on their own screens (News, Institutional). Folding them into
a once-a-week call would make the call stale by Tuesday.

Once-a-week, not nightly: the whole point is a call that holds for the coming week,
and it keeps both the Gemini and mem0 usage trivially small on a free tier (one call
each, once a week — not per-symbol, not nightly).
"""

from __future__ import annotations

import json
import logging
from datetime import date, timedelta

from jobs.gemini import generate_json
from jobs.memory import recall, remember

log = logging.getLogger("jobs.weekly_outlook")


def _week_of(business_date: date) -> str:
    return (business_date - timedelta(days=business_date.weekday())).isoformat()


def _breadth_digest(breadth_card: dict | None) -> str:
    if not breadth_card:
        return "no data"
    return (
        f"{breadth_card.get('advances')} advancing / {breadth_card.get('declines')} declining "
        f"of {breadth_card.get('traded')} traded; {breadth_card.get('pct_above_50dma')}% of the panel above its 50-day average, "
        f"{breadth_card.get('pct_above_200dma')}% above its 200-day average; "
        f"{breadth_card.get('new_52w_highs')} new 52w highs vs {breadth_card.get('new_52w_lows')} new 52w lows"
    )


def _vix_digest(vix: dict | None) -> str:
    if not vix:
        return "no data"
    return f"INDIA VIX {vix.get('value')} ({vix.get('band')} band, {vix.get('percentile_250d')}th percentile of the last year)"


def _flows_digest(flow_card: dict | None) -> str:
    if not flow_card or not flow_card.get("series"):
        return "no data"
    last3 = flow_card["series"][-3:]
    return "\n".join(f"- {r['date']}: FII net {r.get('fii_net')} cr, DII net {r.get('dii_net')} cr" for r in last3)


def _sector_digest(sectors_payload: dict) -> str:
    rows = sorted(
        (sectors_payload or {}).get("sectors", []),
        key=lambda s: (s.get("return_1m") if s.get("return_1m") is not None else -999),
        reverse=True,
    )
    top, bottom = rows[:3], rows[-3:]
    lines = [f"- {s['name']}: 1M {s.get('return_1m')}%, rank delta {s.get('rank_delta')}" for s in top]
    lines += [f"- {s['name']}: 1M {s.get('return_1m')}%, rank delta {s.get('rank_delta')} (laggard)" for s in bottom]
    return "\n".join(lines) or "no data"


def _indices_digest(indices_payload: dict) -> str:
    rows = [r for r in (indices_payload or {}).get("indices", []) if r.get("category") == "broad"]
    return "\n".join(f"- {r['symbol']}: {r.get('change_pct')}%" for r in rows) or "no data"


def build(
    business_date: date,
    breadth_card: dict | None,
    vix: dict | None,
    flow_card: dict | None,
    sectors_payload: dict,
    indices_payload: dict,
) -> tuple[dict | None, dict]:
    week_of = _week_of(business_date)
    memories = recall(f"weekly market outlook calls before {week_of}")

    prompt = (
        "You are reviewing one week of the Indian equity market (NSE) — breadth, volatility, "
        "FII/DII flows, sector rotation, and the broad indices — to produce a market-wide lean "
        "for the coming week for a swing trader. This is about market direction, not stock picks. "
        "Be concrete and concise — read once and acted on, not a report.\n\n"
        f"Market breadth:\n{_breadth_digest(breadth_card)}\n\n"
        f"Volatility:\n{_vix_digest(vix)}\n\n"
        f"FII/DII net flows, last 3 sessions:\n{_flows_digest(flow_card)}\n\n"
        f"Sector rotation (leaders and laggards by 1-month return):\n{_sector_digest(sectors_payload)}\n\n"
        f"Broad-market indices, today's change:\n{_indices_digest(indices_payload)}\n\n"
        + (
            "Your own past weekly calls (most recent first) — before making this week's call, "
            "briefly grade whether last week's call held up, in one sentence:\n"
            + "\n".join(f"- {m}" for m in memories)
            + "\n\n"
            if memories
            else "You have no prior calls on record — this is the first one.\n\n"
        )
        + 'Return ONLY a JSON object: {"market_view": {"direction": "bullish"|"bearish"|"neutral", '
        '"rationale": "<2-3 sentences, plain English, weighing breadth/volatility/flows together"}, '
        '"sector_pick": {"name": "<leading sector>", "rationale": "<one sentence>"}, '
        '"confidence": "high"|"medium"|"low", '
        '"last_week_review": "<one sentence grading last week'
        "'"
        's call, or null if there was none>"}'
    )

    text = generate_json(prompt, cache_namespace="weekly_outlook")
    if text is None:
        return None, {"ok": False, "reason": "gemini_unavailable"}

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        log.warning("weekly outlook: gemini returned non-JSON")
        return None, {"ok": False, "reason": "bad_json"}

    payload = {
        "week_of": week_of,
        "generated_at": business_date.isoformat(),
        "market_view": parsed.get("market_view"),
        "sector_pick": parsed.get("sector_pick"),
        "confidence": parsed.get("confidence"),
        "last_week_review": parsed.get("last_week_review"),
        "memory_used": bool(memories),
    }

    summary = (
        f"Week of {week_of}: market view {payload['market_view']}, sector pick {payload['sector_pick']}, "
        f"confidence {payload['confidence']}."
    )
    remember(summary)

    log.info("weekly outlook: view=%s sector=%s memory_used=%s", payload["market_view"], payload["sector_pick"], payload["memory_used"])
    return payload, {"ok": True, "memory_used": payload["memory_used"]}
