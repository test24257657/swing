"""In-memory artifact store.

The API's entire market-data layer. Artifacts are read from ``out/*.json`` once at
startup into module-level dicts and served from there — no database, no pandas, no NSE.

If tonight's job failed, yesterday's files are still on disk: they load, ``meta.json``
carries the old timestamp, and the UI shows the stale state. Never a blank screen.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import UTC, datetime, timedelta
from pathlib import Path

log = logging.getLogger("swing.store")

OUT_DIR = Path(os.environ.get("OUT_DIR", Path(__file__).resolve().parents[3] / "out"))

# A run is considered stale once its artifacts are older than this.
STALE_AFTER = timedelta(hours=30)

_state: dict[str, dict] = {"pulse": {}, "meta": {}, "calendar": {}}


def _read(name: str) -> dict:
    path = OUT_DIR / name
    if not path.exists():
        log.warning("artifact missing: %s", path)
        return {}
    try:
        return json.loads(path.read_text())
    except json.JSONDecodeError as exc:
        log.error("artifact %s is not valid JSON: %s", path, exc)
        return {}


def load() -> None:
    """Read every artifact into memory. Called at startup and by ``/admin/reload``."""
    _state["pulse"] = _read("pulse.json")
    _state["meta"] = _read("meta.json")
    _state["calendar"] = _read("calendar.json")
    log.info(
        "artifacts loaded from %s — pulse=%s keys, generated_at=%s",
        OUT_DIR,
        len(_state["pulse"]),
        _state["meta"].get("generated_at"),
    )


def pulse() -> dict:
    return _state["pulse"]


def holidays() -> list[dict]:
    return _state["calendar"].get("holidays", [])


def holiday_dates() -> set[str]:
    return {h["date"] for h in holidays() if h.get("date")}


def meta() -> dict:
    """Provenance for the UI footer: source label, generated_at, stale flag."""
    m = _state["meta"]
    generated = m.get("generated_at")
    stale = True
    if generated:
        try:
            ts = datetime.fromisoformat(generated)
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=UTC)
            stale = (datetime.now(UTC) - ts) > STALE_AFTER
        except ValueError:
            stale = True
    degraded = [k for k, v in (m.get("sources") or {}).items() if not v.get("ok", True)]
    return {
        "source": "NSE bhavcopy + index feed",
        "as_of": generated,
        "stale": stale or bool(degraded),
        "job": "nightly",
        "degraded_sources": degraded,
    }


def is_loaded() -> bool:
    return bool(_state["pulse"])
