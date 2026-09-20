"""Telegram push — the only outbound channel in the pipeline.

One function, deliberately dumb: format elsewhere, send here. Missing token or chat
id = silently off (same as every other optional integration), so a fork without
Telegram configured runs exactly as before. Never raises into the job.
"""

from __future__ import annotations

import json
import logging
import os
import urllib.error
import urllib.parse
import urllib.request

from jobs.cache import safe

log = logging.getLogger("jobs.telegram")

API = "https://api.telegram.org/bot{token}/sendMessage"
MAX_CHARS = 4000  # Telegram's hard cap is 4096; leave room for the continuation marker
TIMEOUT_S = 20


def configured() -> bool:
    return bool(os.environ.get("TELEGRAM_BOT_TOKEN") and os.environ.get("TELEGRAM_CHAT_ID"))


def _chunks(text: str) -> list[str]:
    """Split on blank lines so a message never breaks mid-stock."""
    if len(text) <= MAX_CHARS:
        return [text]
    out, cur = [], ""
    for block in text.split("\n\n"):
        if len(cur) + len(block) + 2 > MAX_CHARS and cur:
            out.append(cur.rstrip())
            cur = ""
        cur += block + "\n\n"
    if cur.strip():
        out.append(cur.rstrip())
    return out


@safe(default=False, label="telegram send")
def send(text: str) -> bool:
    """HTML-formatted message (<b>, <i>, <a href>). Returns True if every chunk went."""
    token, chat = os.environ.get("TELEGRAM_BOT_TOKEN"), os.environ.get("TELEGRAM_CHAT_ID")
    if not token or not chat:
        log.info("telegram not configured — message skipped")
        return False
    ok = True
    for part in _chunks(text):
        body = urllib.parse.urlencode(
            {
                "chat_id": chat,
                "text": part,
                "parse_mode": "HTML",
                "disable_web_page_preview": "true",
            }
        ).encode()
        req = urllib.request.Request(API.format(token=token), data=body, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT_S) as res:
                payload = json.loads(res.read())
            ok = ok and bool(payload.get("ok"))
        except urllib.error.HTTPError as exc:
            # The body carries Telegram's own reason ("chat not found", bad token...).
            log.warning("telegram HTTP %s: %s", exc.code, exc.read()[:200].decode(errors="replace"))
            return False
    log.info("telegram: sent %s message(s)", len(_chunks(text)))
    return ok
