from __future__ import annotations

import hashlib
from pathlib import Path

from app.config import settings


def raw_cache_path(namespace: str, key: str, suffix: str = ".csv") -> Path:
    """Deterministic on-disk path for a raw source response.

    Every source writes its raw payload here before parsing. Recompute (indicators,
    patterns, scores) then replays from this cache and never re-hits NSE — which is what
    keeps the server IP from being blocked.
    """
    digest = hashlib.sha1(key.encode()).hexdigest()[:16]
    root = Path(settings.raw_cache_dir) / namespace
    root.mkdir(parents=True, exist_ok=True)
    return root / f"{digest}{suffix}"
