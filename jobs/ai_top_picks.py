"""AI top 5 — the best swing setups of the night, technicals *and* fundamentals.

Two stages, on purpose:

1. **Rules decide who is eligible.** Out of the AI-narrative universe, a stock only
   reaches the shortlist if it is in an uptrend, not stretched, not already extended
   past its pivot, profitable, and (where comparable quarters exist) growing. These
   are hard gates in Python — an LLM never gets to "like" a stock in a downtrend.
2. **AI picks the best 5 from that shortlist** and says why, weighing the signals
   together the way a fixed score can't. Every number shown on the card (pivot, stop,
   target, growth) comes from our data, never from the model's reply.

If Gemini is unavailable the card still fills from the rule ranking and says so
(``source: "rules"``) rather than going blank or pretending it was AI.
"""

from __future__ import annotations

import json
import logging
from datetime import date

import pandas as pd

from jobs.cache import safe
from jobs.charts import technicals as compute_technicals
from jobs.gemini import generate_json

log = logging.getLogger("jobs.ai_top_picks")

TOP_N = 5
SHORTLIST_SIZE = 15
MAX_DIST_20DMA_PCT = 10.0  # further above the 20-day average than this = stretched, a chase
RSI_MIN, RSI_MAX = 45.0, 75.0  # below: no momentum; above: overheated
EXTENDED_PCT = 5.0  # same line as jobs/patterns/stage.py
# QoQ growth is only meaningful between *adjacent* quarters. The fundamentals feed
# can skip a quarter, and "Q3 vs Q1" labelled QoQ would be a wrong number.
MAX_QUARTER_GAP_DAYS = 100
STAGE_POINTS = {"confirmed": 3.0, "forming": 2.0}


def _growth(fund: dict | None) -> dict | None:
    """Latest quarter's revenue/profit growth vs the quarter directly before it."""
    quarters = (fund or {}).get("quarters") or []
    if len(quarters) < 2:
        return None
    prev, last = quarters[-2], quarters[-1]
    try:
        gap = (date.fromisoformat(last["period_end"]) - date.fromisoformat(prev["period_end"])).days
    except (KeyError, TypeError, ValueError):
        return None
    if gap > MAX_QUARTER_GAP_DAYS:
        return None
    return {
        "quarter": last.get("label"),
        "revenue_cr": last.get("revenue_cr"),
        "net_income_cr": last.get("net_income_cr"),
        "revenue_qoq_pct": last.get("revenue_qoq_pct"),
        "net_income_qoq_pct": last.get("net_income_qoq_pct"),
    }


def evaluate(symbol: str, t: dict | None, pattern: dict | None, ltp: float | None, fund: dict | None) -> dict | None:
    """Hard gates + a transparent score. None = not eligible. Pure, so it's testable."""
    if not t or ltp is None:
        return None
    d20, d50, d200, rsi = t.get("dist_20dma_pct"), t.get("dist_50dma_pct"), t.get("dist_200dma_pct"), t.get("rsi_14")
    if None in (d20, d50, d200, rsi):
        return None
    # --- technical gates ---
    if d50 <= 0 or d200 <= 0:
        return None  # not in an uptrend
    if d20 > MAX_DIST_20DMA_PCT:
        return None  # stretched — buying here is chasing
    if not (RSI_MIN <= rsi <= RSI_MAX):
        return None
    gap_pct = None
    if pattern:
        if pattern.get("stage") == "extended":
            return None
        pivot = pattern.get("pivot_price")
        if pivot:
            gap_pct = round((ltp / pivot - 1.0) * 100.0, 2)
            if gap_pct > EXTENDED_PCT:
                return None
    # --- fundamental gates ---
    g = _growth(fund)
    if g is None or g.get("net_income_cr") is None or g["net_income_cr"] <= 0:
        return None  # no comparable filed quarter, or loss-making
    rev_g, prof_g = g.get("revenue_qoq_pct"), g.get("net_income_qoq_pct")
    if rev_g is not None and prof_g is not None and rev_g < 0 and prof_g < 0:
        return None  # both shrinking

    score = 0.0
    if pattern:
        score += STAGE_POINTS.get(pattern.get("stage"), 0.0) + 2.0 * float(pattern.get("confidence") or 0)
    score += min(max(rev_g or 0.0, -20.0), 40.0) / 10.0  # capped so one freak quarter can't dominate
    score += min(max(prof_g or 0.0, -20.0), 60.0) / 15.0
    score += min(float(t.get("rel_volume_20d") or 0.0), 3.0) / 2.0
    score += 1.0 if d200 > 10 else 0.0  # well-established long-term trend
    return {
        "symbol": symbol,
        "score": round(score, 3),
        "ltp": ltp,
        "technicals": {k: t.get(k) for k in ("rsi_14", "rel_volume_20d", "dist_20dma_pct", "dist_50dma_pct", "dist_200dma_pct")},
        "pattern": (
            {k: pattern.get(k) for k in ("code", "stage", "pivot_price", "stop_suggestion", "target_suggestion")}
            | {"gap_to_pivot_pct": gap_pct}
            if pattern
            else None
        ),
        "fundamentals": g,
    }


def _digest(c: dict, summary: str | None) -> str:
    t, p, g = c["technicals"], c["pattern"], c["fundamentals"]
    tech = (
        f"  technicals: RSI {t['rsi_14']}, volume {t['rel_volume_20d']}x avg, vs 20/50/200-day avg "
        f"{t['dist_20dma_pct']}% / {t['dist_50dma_pct']}% / {t['dist_200dma_pct']}%"
    )
    setup = (
        (
            f"  setup: {p['code']} ({p['stage']}), {p['gap_to_pivot_pct']}% vs pivot ₹{p['pivot_price']}, "
            f"stop ₹{p['stop_suggestion']}, target ₹{p['target_suggestion']}"
        )
        if p
        else "  setup: no rule-based pattern"
    )
    results = (
        f"  results {g['quarter']}: revenue ₹{g['revenue_cr']} cr ({g['revenue_qoq_pct']}% QoQ), "
        f"net profit ₹{g['net_income_cr']} cr ({g['net_income_qoq_pct']}% QoQ)"
    )
    lines = [f"{c['symbol']} (price ₹{c['ltp']}):", tech, setup, results]
    if summary:
        lines.append(f"  nightly AI read: {summary}")
    return "\n".join(lines)


@safe(default=None, label="AI top picks")
def _ask_ai(shortlist: list[dict], summaries: dict[str, str]) -> list[dict] | None:
    numbered = "\n\n".join(f"{i + 1}. {_digest(c, summaries.get(c['symbol']))}" for i, c in enumerate(shortlist))
    prompt = (
        "You are a disciplined swing-trading analyst for Indian equities. Every stock below has ALREADY passed "
        "strict filters: uptrend (above its 50 and 200-day averages), not stretched, not extended past its "
        "breakout level, profitable, and not shrinking. Your job: pick the "
        f"{TOP_N} with the best COMBINED case for a 2-6 week swing trade.\n\n"
        "Judge each on, in order of weight:\n"
        "1. Setup quality — a confirmed or forming pattern close to its pivot beats no pattern; "
        "a tight stop and reachable target beat a wide stop.\n"
        "2. Fundamentals — revenue AND profit growing together beats one of the two; bigger, cleaner growth wins.\n"
        "3. Confirmation — volume above average on the move; RSI 55-70 is healthy momentum.\n"
        "4. Trend health — solidly above the 200-day average, not hugging the 50-day.\n"
        "Prefer quality over excitement; avoid a stock whose only strength is one freak quarter.\n\n"
        "RULES: use only the numbers given, never invent any. Choose ONLY symbols from the list. "
        "The reason must cite at least one technical AND one fundamental number, in plain English a beginner "
        "understands, max 35 words.\n\n"
        'Return ONLY a JSON array, best first, exactly this shape: [{"symbol": "<symbol>", "reason": "<max 35 words>"}]'
        f"\n\nStocks:\n{numbered}"
    )
    text = generate_json(prompt, cache_namespace="ai_top_picks")
    if text is None:
        return None
    parsed = json.loads(text)
    return parsed if isinstance(parsed, list) else None


def build(
    panel: pd.DataFrame,
    symbols: list[str],
    screener_payload: dict,
    fund_payloads: dict[str, dict],
    ai_payloads: dict[str, dict],
    names: dict[str, str],
    business_date: date,
) -> tuple[dict, dict]:
    patterns = {r["symbol"]: r["patterns"][0] for r in screener_payload.get("rows", []) if r.get("patterns")}
    by_symbol = {s: g.sort_values("date") for s, g in panel[panel["symbol"].isin(symbols)].groupby("symbol")}

    candidates = []
    for symbol in dict.fromkeys(symbols):
        g = by_symbol.get(symbol)
        if g is None or g.empty:
            continue
        # Only stocks the nightly AI read itself called bullish — the rules add to that
        # opinion, they don't overrule it.
        if (ai_payloads.get(symbol) or {}).get("verdict") != "bullish" and ai_payloads:
            continue
        c = evaluate(symbol, compute_technicals(g), patterns.get(symbol), float(g["close"].iloc[-1]), fund_payloads.get(symbol))
        if c:
            candidates.append(c)
    candidates.sort(key=lambda c: c["score"], reverse=True)
    shortlist = candidates[:SHORTLIST_SIZE]
    by_sym = {c["symbol"]: c for c in shortlist}

    summaries = {s: p.get("summary", "") for s, p in ai_payloads.items()}
    picks: list[dict] = []
    source = "rules"
    reply = _ask_ai(shortlist, summaries) if shortlist else None
    if reply:
        for item in reply:
            sym = str((item or {}).get("symbol", "")).strip().upper() if isinstance(item, dict) else ""
            if sym in by_sym and all(p["symbol"] != sym for p in picks):  # model can't add a stock that failed the gates
                picks.append({**by_sym[sym], "reason": str(item.get("reason", "")).strip()[:300]})
            if len(picks) == TOP_N:
                break
        if picks:
            source = "ai"
    if not picks:
        picks = [{**c, "reason": None} for c in shortlist[:TOP_N]]

    for i, p in enumerate(picks):
        p["rank"] = i + 1
        p["name"] = names.get(p["symbol"], p["symbol"])
        p.pop("score", None)

    payload = {
        "as_of": business_date.isoformat(),
        "source": source,
        "universe": len(list(dict.fromkeys(symbols))),
        "eligible": len(candidates),
        "picks": picks,
    }
    stats = {"ok": bool(picks), "source": source, "eligible": len(candidates), "picks": len(picks)}
    log.info("ai_top_picks: %s picks (%s) from %s eligible", len(picks), source, len(candidates))
    return payload, stats
