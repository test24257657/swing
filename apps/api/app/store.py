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

_state: dict[str, dict] = {
    "pulse": {},
    "meta": {},
    "calendar": {},
    "charts": {},
    "screener": {},
    "fundamentals": {},
    "quotes": {},
    "sectors": {},
    "indices": {},
    "news": {},
}


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


def _read_dir(name: str) -> dict[str, dict]:
    """One JSON file per symbol, keyed by its uppercased slug (the filename stem)."""
    out: dict[str, dict] = {}
    d = OUT_DIR / name
    if not d.is_dir():
        return out
    for f in d.glob("*.json"):
        try:
            out[f.stem.upper()] = json.loads(f.read_text())
        except json.JSONDecodeError:
            log.warning("bad %s artifact: %s", name, f.name)
    return out


def load() -> None:
    """Read every artifact into memory. Called at startup and by ``/admin/reload``."""
    _state["pulse"] = _read("pulse.json")
    _state["meta"] = _read("meta.json")
    _state["calendar"] = _read("calendar.json")
    _state["screener"] = _read("screener.json")
    _state["charts"] = _read_dir("charts")
    _state["fundamentals"] = _read_dir("fundamentals")
    _state["quotes"] = _read("quotes.json")
    _state["sectors"] = _read("sectors.json")
    _state["indices"] = _read("indices.json")
    _state["news"] = _read("news.json")

    log.info(
        "artifacts loaded from %s — pulse=%s keys, charts=%s, fundamentals=%s, generated_at=%s",
        OUT_DIR,
        len(_state["pulse"]),
        len(_state["charts"]),
        len(_state["fundamentals"]),
        _state["meta"].get("generated_at"),
    )


def pulse() -> dict:
    return _state["pulse"]


def screener() -> dict:
    return _state["screener"]


def chart(slug: str) -> dict | None:
    return _state["charts"].get(slug.upper())


def chart_slugs() -> list[str]:
    return sorted(_state["charts"])


def fundamentals(slug: str) -> dict | None:
    return _state["fundamentals"].get(slug.upper())


def quote(symbol: str) -> dict | None:
    """LTP/name/change% for any actively-traded symbol — the whole panel, not just the
    subset with a chart artifact. Used to enrich watchlist rows."""
    return _state["quotes"].get(symbol.upper())


def sectors() -> dict:
    return _state["sectors"]


def indices() -> dict:
    return _state["indices"]


def news() -> dict:
    return _state["news"]


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
