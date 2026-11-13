"""
pipeline/ai/gemini.py
Gemini 2.5 Flash API integration.

Mindful usage — 2 scheduled calls/day maximum:
  1. Nightly: batch-grade Top 15 → Top 5 Picks  (7:30 PM IST)
  2. Morning: Market Regime Brief                (8:30 AM IST)

Plus on-demand Stock Thesis with 7-day Neon DB cache (cache miss = API call).
"""

from __future__ import annotations

import json
import logging
import time
import urllib.error
import urllib.request
from datetime import date, datetime, timedelta
from typing import Optional

from pipeline.config import (
    GEMINI_API_KEY,
    GEMINI_MODEL,
    GEMINI_MAX_RETRIES,
    GEMINI_MAX_OUTPUT_TOKENS,
    GEMINI_TOP_N_SHORTLIST,
    GEMINI_TOP_PICKS,
    THESIS_CACHE_DAYS,
)

log = logging.getLogger("pipeline.ai.gemini")

_GEMINI_URL = (
    f"https://generativelanguage.googleapis.com/v1beta/models/"
    f"{GEMINI_MODEL}:generateContent?key={{key}}"
)


def _call_gemini(prompt: str, system: str = "") -> Optional[str]:
    """
    Single Gemini API call with retry on transient errors.
    Returns the text response or None on failure.
    """
    if not GEMINI_API_KEY:
        log.warning("GEMINI_API_KEY not set — skipping AI call")
        return None

    url = _GEMINI_URL.format(key=GEMINI_API_KEY)
    contents = [{"role": "user", "parts": [{"text": prompt}]}]

    payload = {
        "contents": contents,
        "generationConfig": {
            "maxOutputTokens": GEMINI_MAX_OUTPUT_TOKENS,
            "temperature": 0.3,  # Low temp for factual ranking
            "responseMimeType": "application/json",
        },
    }

    if system:
        payload["systemInstruction"] = {"parts": [{"text": system}]}

    body = json.dumps(payload).encode()

    for attempt in range(1, GEMINI_MAX_RETRIES + 1):
        try:
            req = urllib.request.Request(
                url,
                data=body,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = json.loads(resp.read())
                text = (
                    data.get("candidates", [{}])[0]
                        .get("content", {})
                        .get("parts", [{}])[0]
                        .get("text", "")
                )
                return text.strip()

        except urllib.error.HTTPError as e:
            if e.code in (429, 503) and attempt < GEMINI_MAX_RETRIES:
                wait = 10 * attempt
                log.warning("Gemini HTTP %d — retrying in %ds (attempt %d/%d)",
                             e.code, wait, attempt, GEMINI_MAX_RETRIES)
                time.sleep(wait)
            else:
                log.error("Gemini HTTP error %d: %s", e.code, e.read().decode()[:300])
                return None

        except Exception as exc:
            log.error("Gemini call failed (attempt %d): %s", attempt, exc)
            if attempt < GEMINI_MAX_RETRIES:
                time.sleep(5 * attempt)

    return None


# ─────────────────────────────────────────────────────────────────────────────
# CALL 1 — NIGHTLY TOP 5 PICKS
# ─────────────────────────────────────────────────────────────────────────────

SYSTEM_TOP_PICKS = """
You are a senior quantitative analyst specializing in Indian equity momentum trading.
You will receive a JSON list of the top 15 stock setups ranked by a 100-point
Techno-Funda Composite Score. Your job is to select the best 5 as swing picks.

Rules:
- Pick exactly 5 symbols from the provided list. Do not invent symbols.
- For each pick, write a reason in ≤35 words citing ONE specific technical fact
  (stage, RS percentile, VCP tightness, breakout volume) AND ONE fundamental fact
  (EPS QoQ %, ROCE %, FII change pp, bulk buyer name).
- Format your response as valid JSON only — no markdown, no preamble.
- JSON format: {"picks": [{"symbol": "...", "reason": "...", "rank": 1}]}
- rank goes 1 (best) to 5.
"""


def rank_top_picks(shortlist: list[dict]) -> Optional[list[dict]]:
    """
    Send Top 15 setups to Gemini, receive Top 5 ranked picks.

    shortlist: list of dicts with {symbol, composite_score, weinstein_stage,
               rs_composite, vcp_tightness, pattern, eps_qoq, roce, fii_qoq, ...}

    Returns list of {symbol, reason, rank} dicts, or None on failure.
    """
    if not shortlist:
        return None

    prompt_data = json.dumps(shortlist[:GEMINI_TOP_N_SHORTLIST], indent=2)
    prompt = f"""Here are the top {len(shortlist)} swing setups ranked by composite score.
Select the best {GEMINI_TOP_PICKS} as today's Top Swing Picks.

{prompt_data}

Respond with valid JSON only in the format specified in your instructions."""

    log.info("Sending %d setups to Gemini for Top Picks ranking", len(shortlist))
    response = _call_gemini(prompt, system=SYSTEM_TOP_PICKS)

    if not response:
        log.warning("Gemini Top Picks: no response — using rule-based fallback")
        return _rule_based_fallback(shortlist)

    try:
        data = json.loads(response)
        picks = data.get("picks", [])
        if not picks:
            return _rule_based_fallback(shortlist)

        # Validate: all symbols must be in shortlist
        valid_symbols = {s["symbol"] for s in shortlist}
        picks = [p for p in picks if p.get("symbol") in valid_symbols]

        log.info("Gemini returned %d valid picks", len(picks))
        return picks[:GEMINI_TOP_PICKS]

    except (json.JSONDecodeError, KeyError) as exc:
        log.warning("Gemini response parse error: %s — using fallback", exc)
        return _rule_based_fallback(shortlist)


def _rule_based_fallback(shortlist: list[dict]) -> list[dict]:
    """Fallback: return top 5 by composite score with a rule-based label."""
    top5 = sorted(shortlist, key=lambda x: x.get("composite_score", 0), reverse=True)[:5]
    return [
        {
            "symbol": s["symbol"],
            "reason": (
                f"Stage {s.get('weinstein_stage','?')} · "
                f"RS {s.get('rs_composite', 0):.0f} · "
                f"Score {s.get('composite_score', 0):.1f}/100"
            ),
            "rank": i + 1,
            "source": "rules",
        }
        for i, s in enumerate(top5)
    ]


# ─────────────────────────────────────────────────────────────────────────────
# CALL 2 — MORNING BRIEF
# ─────────────────────────────────────────────────────────────────────────────

SYSTEM_MORNING = """
You are a senior Indian equity strategist preparing the pre-market morning brief.
You will receive structured data: global cues, NIFTY levels, sector RRG snapshot,
FII/DII flows, and today's top swing setups.

Rules:
- Write a headline (≤12 words) and exactly 3-4 bullet points.
- Every number you cite must appear verbatim in the data provided.
- Do NOT invent prices, flows, or events.
- End with a one-line action bias: Bullish / Cautious-Bullish / Neutral / Cautious / Bearish.
- Format response as JSON only: {"headline": "...", "bullets": ["..."], "bias": "..."}
"""


def generate_morning_brief(context: dict) -> Optional[dict]:
    """
    Generate the morning market regime brief.

    context: {
        global_cues: {sp500, nasdaq, nikkei, hangseng, brent, gold, usdinr},
        nifty_levels: {spot, pivot, r1, s1, sma50, sma200},
        sector_rrg: {sector: {quadrant, rs_ratio, rs_momentum}},
        fii_10d_net: float,
        dii_10d_net: float,
        top_setups: [{symbol, pattern, composite_score}],
        india_vix: float,
    }

    Returns {"headline": ..., "bullets": [...], "bias": ...} or None.
    """
    prompt = f"""Morning market brief for Indian equities — {date.today().strftime('%d %b %Y')}.

Data:
{json.dumps(context, indent=2)}

Write the morning brief JSON as specified in your instructions."""

    log.info("Generating Morning Brief via Gemini")
    response = _call_gemini(prompt, system=SYSTEM_MORNING)

    if not response:
        return None

    try:
        return json.loads(response)
    except json.JSONDecodeError as exc:
        log.warning("Morning brief parse error: %s", exc)
        # Try to extract JSON from response
        import re
        m = re.search(r'\{.*\}', response, re.DOTALL)
        if m:
            try:
                return json.loads(m.group())
            except Exception:
                pass
        return None


# ─────────────────────────────────────────────────────────────────────────────
# ON-DEMAND STOCK THESIS (7-day Neon DB cache)
# ─────────────────────────────────────────────────────────────────────────────

SYSTEM_THESIS = """
You are a senior Indian equity analyst. You will receive structured data about a stock.
Write a concise investment thesis for a swing trader (1–4 week holding period).

Rules:
- Use ONLY the data provided. Quote specific numbers. Do not invent facts.
- Structure: Verdict | Why | Plan | Risks
- Verdict: one of BUY_SETUP / WATCH / AVOID
- Why: 2–3 sentences on technical + fundamental thesis
- Plan: entry (pivot), stop, target (1:2 minimum R:R)
- Risks: 2 key risks specific to this stock/setup
- Format as JSON: {"verdict": "...", "why": "...", "plan": {...}, "risks": [...]}
- End with: "Source: EOD data. Not investment advice."
"""


def generate_stock_thesis(stock_context: dict) -> Optional[dict]:
    """
    Generate an on-demand stock thesis. Called only on cache miss (>7 days old).

    stock_context: {symbol, close, weinstein_stage, rs_composite, pattern, pivot,
                    stop, composite_score, eps_qoq, roce, fii_qoq, bulk_deals, ...}
    """
    symbol = stock_context.get("symbol", "Unknown")
    prompt = f"""Stock analysis request for {symbol}.

Data:
{json.dumps(stock_context, indent=2)}

Write the investment thesis JSON as specified."""

    log.info("Generating stock thesis for %s via Gemini", symbol)
    response = _call_gemini(prompt, system=SYSTEM_THESIS)

    if not response:
        return None

    try:
        return json.loads(response)
    except json.JSONDecodeError:
        import re
        m = re.search(r'\{.*\}', response, re.DOTALL)
        if m:
            try:
                return json.loads(m.group())
            except Exception:
                pass
        return {"verdict": "WATCH", "why": response[:500], "plan": {}, "risks": []}
