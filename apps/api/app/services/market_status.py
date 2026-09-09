"""Market-status pill: trading / pre-open / closed / holiday.

Reads the holiday calendar from the artifact store (no database) and compares against the
IST wall clock.
"""

from __future__ import annotations

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from app import store

IST = ZoneInfo("Asia/Kolkata")
PRE_OPEN = time(9, 0)
OPEN = time(9, 15)
CLOSE = time(15, 30)


def _holiday(d: date) -> dict | None:
    for h in store.holidays():
        if h.get("date") == d.isoformat():
            return h
    return None


def _next_session(after: date) -> date:
    d = after + timedelta(days=1)
    for _ in range(30):
        if d.weekday() < 5 and _holiday(d) is None:
            return d
        d += timedelta(days=1)
    return d


def market_status() -> dict:
    now = datetime.now(IST)
    today, t = now.date(), now.time()
    holiday = _holiday(today)

    if holiday is not None:
        desc = holiday.get("description") or "Holiday"
        return _pack("holiday", f"Market closed — {desc}", _next_session(today), now)

    if today.weekday() >= 5:
        return _pack("closed", "Market closed", _next_session(today), now)

    if t < PRE_OPEN:
        return _pack("closed", "Market closed", today, now)
    if PRE_OPEN <= t < OPEN:
        return _pack("preopen", "Pre-open", today, now)
    if OPEN <= t <= CLOSE:
        return _pack("trading", "Market open", today, now)
    return _pack("closed", "Market closed", _next_session(today), now)


def _pack(status: str, label: str, session_day: date, now: datetime) -> dict:
    return {
        "status": status,
        "label": label,
        "as_of": now.isoformat(timespec="seconds"),
        "next_session": session_day.isoformat(),
    }
