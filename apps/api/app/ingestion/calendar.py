from __future__ import annotations

from datetime import date, timedelta

# Phase 0 uses a weekend-only rule. A real NSE holiday calendar (nselib holiday_calendar)
# lands in a later phase and replaces ``_is_holiday``.
_HOLIDAYS: set[date] = set()


def _is_holiday(d: date) -> bool:
    return d.weekday() >= 5 or d in _HOLIDAYS


def last_trading_day(ref: date | None = None) -> date:
    """Most recent completed trading day on or before ``ref`` (default: today)."""
    d = ref or date.today()
    while _is_holiday(d):
        d -= timedelta(days=1)
    return d


def trading_days(start: date, end: date) -> list[date]:
    out: list[date] = []
    d = start
    while d <= end:
        if not _is_holiday(d):
            out.append(d)
        d += timedelta(days=1)
    return out
