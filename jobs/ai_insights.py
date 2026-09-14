"""AI stock narrative — one short, plain-English read per symbol synthesizing
technicals, the setup-pattern match, the fundamentals trend (from the official NSE
XBRL filing, never guessed), and recent news into a single paragraph a trader can
read once and act on, instead of eyeballing six separate cards themselves.

Runs across the whole traded market, not just the "interesting universe" fundamentals/
F&O use — technicals are computed directly off the in-memory panel (no new full-
history artifact per symbol, which would bloat the committed out/ directory), and
fundamentals come from jobs/sources.py's NSE XBRL path (cached per symbol per day,
one shared HTTP session for the whole run) rather than yfinance, which stays scoped
to its existing ~350-symbol use on the chart detail page.

This is explicitly a second opinion alongside — not a replacement for — the existing
rule-based `technicalVerdict()` on the chart page: that one is deterministic and
always available; this one can read across data types a fixed rule can't (e.g. "RSI
oversold, but a profit-warning news item two days ago"), at the cost of occasionally
being wrong the way any LLM output can be.
"""

from __future__ import annotations

import json
import logging

import pandas as pd

from jobs.cache import safe
from jobs.charts import technicals as compute_technicals
from jobs.config import AI_INSIGHT_BATCH_SIZE, AI_INSIGHT_MIN_ROWS
from jobs.gemini import generate_json
from jobs.sources import financial_results, financial_results_client, xbrl_financials

log = logging.getLogger("jobs.ai_insights")

VERDICTS = ("bullish", "neutral", "bearish")


def _fundamentals_digest(symbol: str, client) -> str | None:
    rows = financial_results(symbol, client=client)
    candidates = [r for r in rows if r.get("consolidated") == "Consolidated" and r.get("period") == "Quarterly" and r.get("xbrl")]
    if not candidates:
        return None
    latest = candidates[0]  # financial_results() returns newest first
    xbrl = xbrl_financials(latest["xbrl"], client=client)
    if not xbrl:
        return None
    return (
        f"latest filed quarter ({latest.get('relatingTo')}, {latest.get('financialYear')}): "
        f"revenue {xbrl.get('revenue')}, net profit {xbrl.get('net_profit')}, EPS {xbrl.get('eps')}"
    )


def _digest_symbol(symbol: str, sub_df: pd.DataFrame, pattern: dict | None, news_items: list[dict], client) -> str | None:
    if len(sub_df) < AI_INSIGHT_MIN_ROWS:
        return None
    t = compute_technicals(sub_df.sort_values("date"))
    if t is None:
        return None

    lines = [
        f"{symbol}:",
        f"RSI {t.get('rsi_14')}, ATR% {t.get('atr_pct')}, rel. volume {t.get('rel_volume_20d')}x",
        f"vs 20/50/200 DMA: {t.get('dist_20dma_pct')}% / {t.get('dist_50dma_pct')}% / {t.get('dist_200dma_pct')}%",
    ]
    if pattern:
        lines.append(f"setup pattern: {pattern['code']} ({pattern['stage']})")
    fund = _fundamentals_digest(symbol, client)
    if fund:
        lines.append(fund)
    if news_items:
        lines.append(f"recent news: {news_items[0]['headline']} (impact: {news_items[0]['impact']})")
    return "\n".join(lines)


@safe(default=None, label="AI insight batch")
def _classify_batch(digests: list[tuple[str, str]]) -> dict[str, dict] | None:
    numbered = "\n\n".join(f"{i + 1}. {text}" for i, (_, text) in enumerate(digests))
    prompt = (
        "For each stock below (technicals, setup pattern if any, latest filed quarter's revenue/profit/EPS if "
        "known, most recent relevant news), write a short plain-English read for a swing trader — what the data "
        "together suggests, in 40-70 words, no jargon a beginner wouldn't know. Weigh all the signals together; "
        "don't just restate the numbers. If a stock has no fundamentals line below, don't mention fundamentals "
        "for it — only use what's actually given.\n\n"
        'Return ONLY a JSON array, one object per stock in the same order: '
        '{"verdict": "bullish"|"neutral"|"bearish", "summary": "<40-70 words>"}.\n\n'
        f"Stocks:\n{numbered}"
    )
    text = generate_json(prompt, cache_namespace="ai_insights")
    if text is None:
        return None
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        return None
    if not isinstance(parsed, list) or len(parsed) != len(digests):
        return None

    out: dict[str, dict] = {}
    for (symbol, _), item in zip(digests, parsed, strict=True):
        verdict = item.get("verdict") if isinstance(item, dict) else None
        out[symbol] = {
            "verdict": verdict if verdict in VERDICTS else "neutral",
            "summary": str(item.get("summary", "")).strip()[:600] if isinstance(item, dict) else "",
        }
    return out


def build(panel: pd.DataFrame, symbols: list[str], screener_payload: dict, news_payload: dict) -> tuple[dict[str, dict], dict]:
    """`symbols` — every symbol that actually traded the latest session (the whole
    market, not a scoped subset). `panel` — the full rolling OHLCV panel already in
    memory in jobs/run_nightly.py; technicals are computed directly from it."""
    patterns_by_symbol = {
        r["symbol"]: r["patterns"][0] for r in screener_payload.get("rows", []) if r.get("patterns")
    }
    news_by_symbol: dict[str, list[dict]] = {}
    for item in news_payload.get("items", []):
        news_by_symbol.setdefault(item["symbol"], []).append(item)

    panel_by_symbol = {sym: g for sym, g in panel[panel["symbol"].isin(symbols)].groupby("symbol")}

    digests: list[tuple[str, str]] = []
    client = financial_results_client()
    try:
        for symbol in dict.fromkeys(symbols):
            sub_df = panel_by_symbol.get(symbol)
            if sub_df is None:
                continue
            text = _digest_symbol(symbol, sub_df, patterns_by_symbol.get(symbol), news_by_symbol.get(symbol, []), client)
            if text:
                digests.append((symbol, text))
    finally:
        client.close()

    payloads: dict[str, dict] = {}
    for i in range(0, len(digests), AI_INSIGHT_BATCH_SIZE):
        batch = digests[i : i + AI_INSIGHT_BATCH_SIZE]
        result = _classify_batch(batch)
        if result is None:
            continue
        for symbol, data in result.items():
            payloads[symbol] = {"symbol": symbol, **data}

    stats = {"ok": bool(payloads), "eligible": len(digests), "written": len(payloads)}
    log.info("ai_insights: %s of %s eligible symbols (whole market)", len(payloads), len(digests))
    return payloads, stats
