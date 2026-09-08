from __future__ import annotations

from datetime import date, timedelta
from functools import lru_cache

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models import HolidayCalendar


@lru_cache(maxsize=1)
def _holiday_set() -> frozenset[date]:
    """NSE trading holidays from the holiday_calendar table (populated by
    ``ingest_holidays``). Falls back to an empty set if the table is empty — then only
    weekends are excluded. Cached for the process; the nightly job restarts fresh."""
    try:
        db = SessionLocal()
        try:
            rows = db.execute(select(HolidayCalendar.date)).scalars().all()
            return frozenset(rows)
        finally:
            db.close()
    except Exception:  # noqa: BLE001 - calendar must never raise
        return frozenset()


def refresh_holidays() -> None:
    _holiday_set.cache_clear()


def is_trading_day(d: date) -> bool:
    return d.weekday() < 5 and d not in _holiday_set()


def _is_holiday(d: date) -> bool:
    return not is_trading_day(d)


def last_trading_day(ref: date | None = None) -> date:
    """Most recent completed trading day on or before ``ref`` (default: today)."""
    d = ref or date.today()
    while _is_holiday(d):
        d -= timedelta(days=1)
    return d


def next_trading_day(ref: date | None = None) -> date:
    d = (ref or date.today()) + timedelta(days=1)
    while _is_holiday(d):
        d += timedelta(days=1)
    return d


def trading_days(start: date, end: date) -> list[date]:
    out: list[date] = []
    d = start
    while d <= end:
        if not _is_holiday(d):
            out.append(d)
        d += timedelta(days=1)
    return out
