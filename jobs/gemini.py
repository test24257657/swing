"""Shared Gemini REST helper — the same call jobs/news.py already makes, factored out
so the AI stock narrative and weekly outlook jobs don't each reimplement the request +
disk-cache dance.

Paced against the free-tier Flash limits (assumed ~15 requests/minute, ~1,500/day as
of writing — https://ai.google.dev/gemini-api/docs/rate-limits; real testing hit 429s
sooner than that, so GEMINI_MIN_INTERVAL_SECONDS is more conservative than the naive
calculation). A cache hit never counts against the pace: only a real network call is
throttled, so a rerun on the same day's data is instant.

Two independent API keys (GEMINI_API_KEY, GEMINI_API_KEY_FALLBACK) can be configured —
a 429 rotates to the next key rather than just backing off on the one that's already
exhausted, since a separate key has its own separate quota. Only the second key
onward is a true fallback; if just one is set, behavior is identical to before.
"""

from __future__ import annotations

import logging
import os
import time

import httpx

from jobs.cache import raw_path
from jobs.config import (
    GEMINI_MAX_RETRIES,
    GEMINI_MIN_INTERVAL_SECONDS,
    GEMINI_MODEL,
    HTTP_TIMEOUT,
)

log = logging.getLogger("jobs.gemini")

_last_call_at = 0.0


def api_key() -> str | None:
    """The primary key — kept for anything that only ever wants one (none of this
    module's own code calls it; api_keys() is what generate_json() actually uses)."""
    return os.environ.get("GEMINI_API_KEY") or None


def api_keys() -> list[str]:
    keys = [os.environ.get("GEMINI_API_KEY"), os.environ.get("GEMINI_API_KEY_FALLBACK")]
    return [k for k in keys if k]


def _pace() -> None:
    """Sleep just enough to stay under the assumed RPM cap. A module-level timestamp
    is enough here — jobs run single-process, single-threaded."""
    global _last_call_at
    wait = GEMINI_MIN_INTERVAL_SECONDS - (time.monotonic() - _last_call_at)
    if wait > 0:
        time.sleep(wait)
    _last_call_at = time.monotonic()


def generate_json(prompt: str, cache_namespace: str) -> str | None:
    """POST one prompt, forcing JSON output. Cached to disk keyed on the prompt text
    itself (stable across reruns, unlike Python's per-process `hash()`) — a rerun on
    the same data never re-bills Gemini. On a 429, rotates to the next configured key
    (if any) before backing off, and honours `Retry-After` when the server sends one.
    Returns the raw JSON text, or None on any failure (network, non-2xx after
    retries, no key configured) — callers degrade to a default, never raise."""
    keys = api_keys()
    if not keys:
        log.warning("no GEMINI_API_KEY configured — %s skipped", cache_namespace)
        return None

    cache = raw_path(cache_namespace, prompt, suffix=".json")
    if cache.exists() and cache.stat().st_size > 0:
        return cache.read_text()

    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseMimeType": "application/json"},
    }

    for attempt in range(GEMINI_MAX_RETRIES):
        key = keys[attempt % len(keys)]
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={key}"
        _pace()
        try:
            r = httpx.post(url, json=body, timeout=max(HTTP_TIMEOUT, 60))
            # 429 (quota) and 5xx (Google's own transient server errors, e.g. 503) are
            # both worth retrying — anything else (400 bad request, 403 forbidden, ...)
            # will never succeed on a retry, so fail fast instead.
            if r.status_code == 429 or r.status_code >= 500:
                if r.status_code == 429 and len(keys) > 1:
                    log.warning("gemini 429 (%s), attempt %s/%s — trying the next key", cache_namespace, attempt + 1, GEMINI_MAX_RETRIES)
                else:
                    retry_after = float(r.headers.get("retry-after", 2**attempt * 5))
                    log.warning(
                        "gemini %s (%s), attempt %s/%s — backing off %.0fs",
                        r.status_code, cache_namespace, attempt + 1, GEMINI_MAX_RETRIES, retry_after,
                    )
                    time.sleep(retry_after)
                continue
            r.raise_for_status()
            text = r.json()["candidates"][0]["content"]["parts"][0]["text"]
        except Exception as exc:  # noqa: BLE001 - degrade, record, move on
            log.warning("gemini call failed (%s): %s", cache_namespace, exc)
            return None
        cache.write_text(text)
        return text

    log.warning("gemini call gave up after %s retries across %s key(s) (%s)", GEMINI_MAX_RETRIES, len(keys), cache_namespace)
    return None
