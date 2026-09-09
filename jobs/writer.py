"""Artifact output — the only thing the API ever reads."""

from __future__ import annotations

import json
import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from jobs.config import OUT_DIR

log = logging.getLogger("jobs.writer")
IST = ZoneInfo("Asia/Kolkata")


def write(name: str, payload: dict | list) -> None:
    path = OUT_DIR / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=1, default=str))
    log.debug("wrote %s (%.1f KB)", name, path.stat().st_size / 1024)


def clear_dir(name: str) -> None:
    """Drop a whole artifact subdirectory before a rebuild, so instruments that fall off
    the Pulse screen don't leave stale chart files behind."""
    d = OUT_DIR / name
    if d.is_dir():
        for f in d.glob("*.json"):
            f.unlink()


def write_pulse(payload: dict) -> None:
    write("pulse.json", payload)


def write_calendar(holidays: list[dict]) -> None:
    write("calendar.json", {"holidays": holidays})


def write_meta(sources: dict) -> None:
    write(
        "meta.json",
        {"generated_at": datetime.now(IST).isoformat(timespec="seconds"), "sources": sources},
    )
