"""Raw-response caching.

Every external call writes its raw payload to disk before parsing, so a re-run replays
from the cache instead of hitting NSE again. This is what keeps the job idempotent and
the source IP unblocked.
"""

from __future__ import annotations

import functools
import hashlib
import logging
import time
from pathlib import Path

from jobs.config import RAW_CACHE_DIR

log = logging.getLogger("jobs.cache")


def raw_path(namespace: str, key: str, suffix: str = ".csv") -> Path:
    digest = hashlib.sha1(key.encode()).hexdigest()[:16]
    root = RAW_CACHE_DIR / namespace
    root.mkdir(parents=True, exist_ok=True)
    return root / f"{digest}{suffix}"


def cached(ttl: float):
    """In-process memoisation with a time-to-live. For calls repeated within one run."""

    def deco(fn):
        store: dict = {}

        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            key = (args, tuple(sorted(kwargs.items())))
            hit = store.get(key)
            now = time.time()
            if hit and now - hit[0] < ttl:
                return hit[1]
            value = fn(*args, **kwargs)
            store[key] = (now, value)
            return value

        return wrapper

    return deco


def safe(default=None, label: str = ""):
    """Never let one broken source take down the run — log it and return ``default``."""

    def deco(fn):
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            try:
                return fn(*args, **kwargs)
            except Exception as exc:  # noqa: BLE001 - deliberate: degrade, record, move on
                log.warning("%s failed: %s", label or fn.__name__, exc)
                return default() if callable(default) else default

        return wrapper

    return deco
