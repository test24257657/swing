"""mem0 wrapper for the weekly outlook's cross-week memory — the thing that lets it
grade its own past calls and (attempt to) do better next time, instead of starting
from a blank slate every Friday.

Every call is wrapped defensively: mem0's `add()` is asynchronous on their end (a
background job extracts the durable facts from the raw text before it becomes
searchable), so a `recall()` run moments after an `add()` can legitimately come back
empty even when everything is configured correctly. Missing memory degrades to "no
prior context" for that week's outlook, never a failed run.
"""

from __future__ import annotations

import logging
import os

from jobs.cache import safe
from jobs.config import MEM0_OUTLOOK_USER_ID

log = logging.getLogger("jobs.memory")


def _client():
    key = os.environ.get("MEM0_API_KEY")
    if not key:
        return None
    from mem0 import MemoryClient

    return MemoryClient(api_key=key)


@safe(default=list, label="mem0 recall")
def recall(query: str, limit: int = 5) -> list[str]:
    """Past weekly-outlook memories relevant to `query` — empty if mem0 isn't
    configured, has nothing yet, or the call fails for any reason."""
    client = _client()
    if client is None:
        return []
    res = client.search(query, filters={"user_id": MEM0_OUTLOOK_USER_ID}, limit=limit)
    rows = res.get("results", res) if isinstance(res, dict) else res
    return [m.get("memory", "") for m in rows if isinstance(m, dict) and m.get("memory")]


@safe(default=None, label="mem0 remember")
def remember(text: str) -> None:
    """Store one week's outlook (and, once there's a prior one, its self-graded
    outcome) so next week's recall() can find it.

    Writes are refused outside CI. Production and local development share one mem0
    bucket, so a memory written by a local test run becomes a fabricated "last week's
    prediction" that the real Friday outlook will later recall and reason from. Reads
    stay open — recalling prod's genuine memories locally is harmless and useful.
    """
    if os.environ.get("GITHUB_ACTIONS") != "true":
        log.info("mem0 remember: skipped (local run — prod shares this memory bucket)")
        return
    client = _client()
    if client is None:
        return
    client.add([{"role": "assistant", "content": text}], user_id=MEM0_OUTLOOK_USER_ID)
    return
