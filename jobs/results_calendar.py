"""Results calendar — a ±30-day window of quarterly result dates, whole market.

Upcoming board meetings (NSE's own "Financial Results" purpose filings) are shown
unconditionally — there's nothing to judge yet. Already-happened ones are graded: the
real filed XBRL figures (never yfinance, never guessed — same source as
jobs/ai_insights.py / jobs/filing_verify.py) are compared quarter-over-quarter and
Gemini judges good vs not-good from those real numbers. Only "good" results stay on
the calendar; a bad result or a filing that hasn't landed yet are both hidden, per
the explicit ask: the calendar is a "what to watch," not a scoreboard of misses.
"""

from __future__ import annotations

import json
import logging
from datetime import date, datetime, timedelta

from jobs.cache import safe
from jobs.config import (
    RESULTS_CALENDAR_BATCH_SIZE,
    RESULTS_CALENDAR_FUTURE_DAYS,
    RESULTS_CALENDAR_PAST_DAYS,
)
from jobs.gemini import generate_json
from jobs.sources import (
    board_meetings,
    financial_results,
    financial_results_client,
    xbrl_financials,
)

log = logging.getLogger("jobs.results_calendar")


def _parse_bm_date(raw: str) -> date | None:
    try:
        return datetime.strptime(raw.strip(), "%d-%b-%Y").date()  # noqa: DTZ007 - NSE's own wall-clock date, no tz in the source
    except ValueError:
        return None


def _quarterly_filings(symbol: str, client) -> list[dict]:
    rows = financial_results(symbol, client=client)
    return sorted(
        (
            r
            for r in rows
            if r.get("consolidated") == "Consolidated"
            and r.get("period") == "Quarterly"
            and r.get("xbrl")
            and r["xbrl"] != "-"  # NSE's own placeholder for "no XBRL attached", not a missing field
        ),
        key=lambda r: r.get("toDate", ""),
        reverse=True,
    )


def _judge_digest(symbol: str, name: str, filings: list[dict], client) -> str | None:
    if not filings:
        return None
    latest = filings[0]
    xbrl = xbrl_financials(latest["xbrl"], client=client)
    if xbrl is None or xbrl.get("revenue") is None:
        return None
    prev_xbrl = None
    if len(filings) > 1:
        prev_xbrl = xbrl_financials(filings[1]["xbrl"], client=client)

    revenue_cr = round(xbrl["revenue"] / 1e7, 1)
    profit_cr = round(xbrl["net_profit"] / 1e7, 1) if xbrl.get("net_profit") is not None else None
    line = f"{symbol} ({name}) — {latest.get('relatingTo')}: revenue {revenue_cr} cr, net profit {profit_cr} cr, EPS {xbrl.get('eps')}"
    if prev_xbrl and prev_xbrl.get("revenue"):
        prev_revenue_cr = round(prev_xbrl["revenue"] / 1e7, 1)
        prev_profit_cr = round(prev_xbrl["net_profit"] / 1e7, 1) if prev_xbrl.get("net_profit") is not None else None
        line += f" | previous quarter: revenue {prev_revenue_cr} cr, net profit {prev_profit_cr} cr"
    return line


@safe(default=None, label="results calendar judge batch")
def _judge_batch(digests: list[tuple[str, str]]) -> dict[str, dict] | None:
    numbered = "\n".join(f"{i + 1}. {text}" for i, (_, text) in enumerate(digests))
    prompt = (
        "For each stock's just-filed quarterly result below (real figures from the official NSE filing), judge "
        "whether it's a genuinely good result — revenue and profit growth, not just one of the two, and weigh "
        "the comparison to the previous quarter when given. Be conservative: only call it 'good' if a swing "
        "trader would actually be encouraged by it.\n\n"
        f"Results:\n{numbered}\n\n"
        'Return ONLY a JSON array, one object per stock in the same order: '
        '{"good": true|false, "rationale": "<one sentence, plain English>"}.'
    )
    text = generate_json(prompt, cache_namespace="results_calendar")
    if text is None:
        return None
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        return None
    if not isinstance(parsed, list) or len(parsed) != len(digests):
        return None
    return {
        symbol: {"good": bool(item.get("good")), "rationale": str(item.get("rationale", "")).strip()[:300]}
        for (symbol, _), item in zip(digests, parsed, strict=True)
        if isinstance(item, dict)
    }


def build(business_date: date) -> tuple[dict, dict]:
    start = business_date - timedelta(days=RESULTS_CALENDAR_PAST_DAYS)
    end = business_date + timedelta(days=RESULTS_CALENDAR_FUTURE_DAYS)
    raw = board_meetings(start, end)
    results_only = [r for r in raw if "Financial Results" in (r.get("bm_purpose") or "")]

    upcoming: list[dict] = []
    past_candidates: list[tuple[str, str, date]] = []
    for r in results_only:
        d = _parse_bm_date(r.get("bm_date", ""))
        if d is None:
            continue
        symbol = str(r.get("bm_symbol") or "").strip().upper()
        name = str(r.get("sm_name") or symbol).strip()
        if not symbol:
            continue
        if d > business_date:
            upcoming.append({"symbol": symbol, "name": name, "date": d.isoformat(), "status": "upcoming"})
        else:
            past_candidates.append((symbol, name, d))

    digests: list[tuple[str, str]] = []
    meta_by_symbol: dict[str, tuple[str, date]] = {}
    client = financial_results_client()
    try:
        for symbol, name, d in past_candidates:
            filings = _quarterly_filings(symbol, client)
            text = _judge_digest(symbol, name, filings, client)
            if text:
                digests.append((symbol, text))
                meta_by_symbol[symbol] = (name, d)
    finally:
        client.close()

    good: list[dict] = []
    for i in range(0, len(digests), RESULTS_CALENDAR_BATCH_SIZE):
        batch = digests[i : i + RESULTS_CALENDAR_BATCH_SIZE]
        result = _judge_batch(batch)
        if result is None:
            continue
        for symbol, verdict in result.items():
            if verdict["good"] and symbol in meta_by_symbol:
                name, d = meta_by_symbol[symbol]
                good.append(
                    {
                        "symbol": symbol,
                        "name": name,
                        "date": d.isoformat(),
                        "status": "good",
                        "rationale": verdict["rationale"],
                    }
                )

    payload = {
        "as_of": business_date.isoformat(),
        "window": {"from": start.isoformat(), "to": end.isoformat()},
        "entries": upcoming + good,
    }
    stats = {
        "ok": True,
        "upcoming": len(upcoming),
        "past_candidates": len(past_candidates),
        "judged": len(digests),
        "good": len(good),
    }
    log.info("results calendar: %s upcoming, %s of %s judged results were good", len(upcoming), len(good), len(digests))
    return payload, stats
