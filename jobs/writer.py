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
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / name
    path.write_text(json.dumps(payload, indent=1, default=str))
    log.info("wrote %s (%.1f KB)", path.name, path.stat().st_size / 1024)


def write_pulse(payload: dict) -> None:
    write("pulse.json", payload)


def write_calendar(holidays: list[dict]) -> None:
    write("calendar.json", {"holidays": holidays})


def write_meta(sources: dict) -> None:
    write(
        "meta.json",
        {"generated_at": datetime.now(IST).isoformat(timespec="seconds"), "sources": sources},
    )
