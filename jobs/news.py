"""News — NSE corporate announcements, filtered to a relevant subset and classified by
likely swing-trading impact + a one-line summary via Gemini.

Classification is the one thing in this pipeline that costs money and can be wrong in a
way that's hard to verify mechanically (unlike an indicator, there's no reference value
to reconcile against) — so every batch is wrapped in `safe()` and a failed/missing
classification degrades to `"impact": "neutral"` with no summary, never a crashed run
or a fabricated number.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import date, datetime, timedelta

import httpx

from jobs.cache import raw_path, safe
from jobs.config import (
    GEMINI_BATCH_SIZE,
    GEMINI_MODEL,
    NEWS_EXCLUDE_CATEGORIES,
    NEWS_HEADLINE_MAX_CHARS,
    NEWS_LOOKBACK_DAYS,
)
from jobs.sources import announcements, symbol_names

log = logging.getLogger("jobs.news")

IMPACTS = ("very_positive", "positive", "neutral", "negative", "very_negative")


def _parse_dt(raw: dict) -> tuple[str, str] | None:
    """`an_dt` is like '12-Sep-2026 16:43:23' -> ('2026-09-12', '16:43')."""
    s = raw.get("an_dt") or raw.get("exchdisstime")
    if not s:
        return None
    try:
        parsed = datetime.strptime(s.strip(), "%d-%b-%Y %H:%M:%S")  # noqa: DTZ007 - NSE's own IST wall clock, no tz in the source
    except ValueError:
        return None
    return parsed.date().isoformat(), parsed.strftime("%H:%M")


def _relevant(raw: dict, universe: set[str]) -> bool:
    symbol = str(raw.get("symbol") or "").strip().upper()
    category = str(raw.get("desc") or "").strip()
    return bool(symbol) and symbol in universe and category not in NEWS_EXCLUDE_CATEGORIES


def _fetch_filtered(symbols: list[str], days: int) -> list[dict]:
    universe = set(symbols)
    end = date.today()  # noqa: DTZ011
    start = end - timedelta(days=days)
    raw = announcements(start, end)

    names = symbol_names()
    items: list[dict] = []
    for r in raw:
        if not _relevant(r, universe):
            continue
        parsed = _parse_dt(r)
        if parsed is None:
            continue
        d, t = parsed
        symbol = str(r["symbol"]).strip().upper()
        headline = str(r.get("attchmntText") or r.get("desc") or "").strip()[:NEWS_HEADLINE_MAX_CHARS]
        items.append(
            {
                "symbol": symbol,
                "name": names.get(symbol, symbol),
                "date": d,
                "time": t,
                "category": str(r.get("desc") or "").strip(),
                "headline": headline,
                "filing_url": r.get("attchmntFile"),
            }
        )
    # newest first
    items.sort(key=lambda x: (x["date"], x["time"]), reverse=True)
    return items


def _gemini_key() -> str | None:
    return os.environ.get("GEMINI_API_KEY") or None


@safe(default=None, label="gemini classification batch")
def _classify_batch(batch: list[dict], api_key: str) -> list[dict] | None:
    numbered = "\n".join(f"{i + 1}. [{it['symbol']}] {it['category']}: {it['headline']}" for i, it in enumerate(batch))
    prompt = (
        "Classify each NSE corporate announcement below by its likely short-term "
        "(swing-trading, 3-15 day) share-price impact, and give a one-line plain-English "
        "summary a retail trader with no jargon background could understand.\n\n"
        'Return ONLY a JSON array, one object per input item in the same order: '
        '{"impact": "very_positive"|"positive"|"neutral"|"negative"|"very_negative", '
        '"summary": "<one line, under 20 words, plain English>"}.\n\n'
        f"Announcements:\n{numbered}"
    )
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={api_key}"
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseMimeType": "application/json"},
    }
    # raw_path hashes the key itself (sha1) — pass the real content, not a `hash()`
    # builtin result, which is randomized per-process and would never hit on a rerun.
    cache = raw_path("gemini", numbered, suffix=".json")
    if cache.exists() and cache.stat().st_size > 0:
        text = cache.read_text()
    else:
        r = httpx.post(url, json=body, timeout=60)
        r.raise_for_status()
        text = r.json()["candidates"][0]["content"]["parts"][0]["text"]
        cache.write_text(text)

    parsed = json.loads(text)
    if not isinstance(parsed, list) or len(parsed) != len(batch):
        return None
    out = []
    for p in parsed:
        impact = p.get("impact") if isinstance(p, dict) else None
        out.append(
            {
                "impact": impact if impact in IMPACTS else "neutral",
                "summary": str(p.get("summary", "")).strip()[:200] if isinstance(p, dict) else "",
            }
        )
    return out


def _classify(items: list[dict]) -> tuple[list[dict], int]:
    api_key = _gemini_key()
    if not api_key:
        log.warning("GEMINI_API_KEY not set — news items ship unclassified (neutral, no summary)")
        for it in items:
            it["impact"] = "neutral"
            it["summary"] = ""
        return items, 0

    classified = 0
    for i in range(0, len(items), GEMINI_BATCH_SIZE):
        batch = items[i : i + GEMINI_BATCH_SIZE]
        result = _classify_batch(batch, api_key)
        if result is None:
            for it in batch:
                it["impact"] = "neutral"
                it["summary"] = ""
            continue
        for it, r in zip(batch, result, strict=True):
            it["impact"] = r["impact"]
            it["summary"] = r["summary"]
        classified += len(batch)
    return items, classified


def build(symbols: list[str], days: int = NEWS_LOOKBACK_DAYS) -> tuple[dict, dict]:
    items = _fetch_filtered(symbols, days)
    items, classified = _classify(items)

    counts = dict.fromkeys(IMPACTS, 0)
    for it in items:
        counts[it["impact"]] = counts.get(it["impact"], 0) + 1

    payload = {
        "as_of": date.today().isoformat(),  # noqa: DTZ011
        "items": items,
        "counts": counts,
    }
    stats = {
        "ok": True,
        "fetched": len(items),
        "classified": classified,
        "gemini_configured": bool(_gemini_key()),
    }
    log.info("news: %s items, %s classified by gemini", len(items), classified)
    return payload, stats
