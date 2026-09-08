from __future__ import annotations

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import HolidayCalendar

IST = ZoneInfo("Asia/Kolkata")
PRE_OPEN = time(9, 0)
OPEN = time(9, 15)
CLOSE = time(15, 30)


def _holiday_on(db: Session, d: date) -> HolidayCalendar | None:
    return db.execute(select(HolidayCalendar).where(HolidayCalendar.date == d)).scalar_one_or_none()


def _next_session(db: Session, after: date) -> date:
    d = after + timedelta(days=1)
    for _ in range(30):
        if d.weekday() < 5 and _holiday_on(db, d) is None:
            return d
        d += timedelta(days=1)
    return d


def market_status(db: Session) -> dict:
    now = datetime.now(IST)
    today = now.date()
    t = now.time()
    weekend = today.weekday() >= 5
    holiday = _holiday_on(db, today)

    if holiday is not None and holiday.is_muhurat:
        return {
            "status": "holiday",
            "label": f"Market closed — {holiday.description or 'Muhurat'}",
            "note": "Muhurat trading — check the exchange circular for the exact window",
            "as_of": now.isoformat(),
            "next_session": _next_session(db, today).isoformat(),
            "seconds_to_next": None,
        }

    if weekend or holiday is not None:
        nxt = _next_session(db, today)
        open_dt = datetime.combine(nxt, OPEN, tzinfo=IST)
        return {
            "status": "closed",
            "label": f"Market closed — {holiday.description}" if holiday else "Market closed",
            "note": f"next session {nxt.strftime('%d %b')} 09:15",
            "as_of": now.isoformat(),
            "next_session": nxt.isoformat(),
            "seconds_to_next": int((open_dt - now).total_seconds()),
        }

    # a normal weekday
    if t < PRE_OPEN:
        target = datetime.combine(today, PRE_OPEN, tzinfo=IST)
        return _pack("closed", "Market closed", "pre-open in", target, now, today, db)
    if PRE_OPEN <= t < OPEN:
        target = datetime.combine(today, OPEN, tzinfo=IST)
        return _pack("preopen", "Pre-open", "opens in", target, now, today, db)
    if OPEN <= t <= CLOSE:
        target = datetime.combine(today, CLOSE, tzinfo=IST)
        return _pack("trading", "Market open", "closes in", target, now, today, db)

    nxt = _next_session(db, today)
    target = datetime.combine(nxt, PRE_OPEN, tzinfo=IST)
    return _pack("closed", "Market closed", "pre-open in", target, now, nxt, db)


def _pack(
    status: str, label: str, verb: str, target: datetime, now: datetime, session_day: date, db: Session
) -> dict:
    secs = max(0, int((target - now).total_seconds()))
    return {
        "status": status,
        "label": label,
        "note": f"{verb} {_hms(secs)}",
        "as_of": now.isoformat(),
        "next_session": session_day.isoformat(),
        "seconds_to_next": secs,
    }


def _hms(secs: int) -> str:
    h, rem = divmod(secs, 3600)
    m, s = divmod(rem, 60)
    return f"{h:02d}:{m:02d}:{s:02d}"
