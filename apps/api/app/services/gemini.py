"""Minimal Gemini client for the API's one request-path AI feature (stock chat).

stdlib urllib on purpose: the API's deploy dependencies stay light (see pyproject),
and this is a single POST. Tries the primary key, then the fallback on a quota (429)
or a transient Google-side (5xx) error. Never raises — returns None and the router
turns that into a clear 503.
"""

from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request

from app.config import settings

log = logging.getLogger("swing.gemini")

TIMEOUT_SECONDS = 45
URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"


def api_keys() -> list[str]:
    return [k for k in (settings.gemini_api_key, settings.gemini_api_key_fallback) if k]


def is_configured() -> bool:
    return bool(api_keys())


def chat(system: str, turns: list[dict], temperature: float = 0.3) -> str | None:
    """`turns` = [{"role": "user"|"model", "text": "..."}], oldest first, ending on the
    user's question. Returns the model's reply text, or None if every key failed."""
    body = json.dumps(
        {
            "system_instruction": {"parts": [{"text": system}]},
            "contents": [{"role": t["role"], "parts": [{"text": t["text"]}]} for t in turns],
            # Low temperature: this answers from supplied numbers, it is not creative writing.
            # 8192: 3.x models spend part of this budget on internal reasoning before the
            # visible answer; 1500 cut answers off mid-"Plan".
            "generationConfig": {"temperature": temperature, "maxOutputTokens": 8192},
        }
    ).encode()

    for i, key in enumerate(api_keys()):
        req = urllib.request.Request(
            URL.format(model=settings.gemini_model, key=key),
            data=body,
            headers={"content-type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT_SECONDS) as res:
                payload = json.loads(res.read())
        except urllib.error.HTTPError as exc:
            retryable = exc.code == 429 or exc.code >= 500
            log.warning("gemini chat HTTP %s on key #%s (retryable=%s)", exc.code, i + 1, retryable)
            if retryable:
                continue
            return None
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            log.warning("gemini chat failed on key #%s: %s", i + 1, exc)
            continue

        try:
            parts = payload["candidates"][0]["content"]["parts"]
            text = "".join(p.get("text", "") for p in parts).strip()
        except (KeyError, IndexError, TypeError):
            log.warning("gemini chat: no text in response (finish=%s)", _finish_reason(payload))
            return None
        if _finish_reason(payload) == "MAX_TOKENS":
            log.warning("gemini chat: answer truncated at the token limit")
        return text or None
    return None


def _finish_reason(payload: dict) -> str | None:
    try:
        return payload["candidates"][0].get("finishReason")
    except (KeyError, IndexError, TypeError, AttributeError):
        return None
