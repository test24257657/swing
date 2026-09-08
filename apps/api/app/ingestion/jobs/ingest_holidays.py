from __future__ import annotations

import logging
from datetime import date, datetime

import pandas as pd
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.db.session import SessionLocal
from app.ingestion.run_context import ingestion_run
from app.ingestion.sources.cache import raw_cache_path
from app.models import HolidayCalendar

log = logging.getLogger("swing.ingest.holidays")

JOB = "ingest_holidays"


def _fetch() -> pd.DataFrame:
    cache = raw_cache_path("holidays", f"nse-{date.today().year}")
    if cache.exists() and cache.stat().st_size > 0:
        return pd.read_csv(cache)
    import nselib

    df = pd.DataFrame(nselib.trading_holiday_calendar())
    df.columns = [c.strip() for c in df.columns]
    df.to_csv(cache, index=False)
    return df


def _parse_date(raw: str) -> date | None:
    for fmt in ("%d-%b-%Y", "%d-%b-%y", "%Y-%m-%d", "%d-%m-%Y"):
        try:
            return datetime.strptime(str(raw).strip(), fmt).date()
        except ValueError:
            continue
    return None


def run(business_date: date | None = None) -> None:
    business_date = business_date or date.today()
    db = SessionLocal()
    try:
        with ingestion_run(db, JOB, business_date) as run_row:
            df = _fetch()
            lower = {c.lower(): c for c in df.columns}
            date_col = lower.get("tradingdate") or next((c for c in df.columns if "date" in c.lower()), None)
            prod_col = lower.get("product")
            desc_col = lower.get("description")
            eve_col = lower.get("evening_session")
            if not date_col:
                run_row.status = "partial"
                run_row.source_stats = {"note": "no date column", "columns": list(df.columns)}
                return

            if prod_col is not None:
                df = df[df[prod_col].astype(str).str.contains("Equit", case=False, na=False)]

            seen: dict[date, dict] = {}
            for r in df.to_dict("records"):
                d = _parse_date(r[date_col])
                if d is None:
                    continue
                desc = str(r.get(desc_col, "")).strip() if desc_col else ""
                eve = str(r.get(eve_col, "")).strip() if eve_col else ""
                seen[d] = {
                    "date": d,
                    "description": desc[:120],
                    "segment": "equities",
                    "is_muhurat": ("muhurat" in desc.lower()) or (eve not in ("", "nan", "None")),
                }

            payload = list(seen.values())
            if payload:
                stmt = pg_insert(HolidayCalendar).values(payload)
                stmt = stmt.on_conflict_do_update(
                    index_elements=["date"],
                    set_={"description": stmt.excluded.description, "is_muhurat": stmt.excluded.is_muhurat},
                )
                db.execute(stmt)
                db.commit()

            run_row.rows_written = len(payload)
            run_row.source_stats = {"holidays": len(payload), "source": "nselib.trading_holiday_calendar"}
            run_row.status = "success" if payload else "partial"
        log.info("holidays: %s equity trading holidays", run_row.rows_written)
    finally:
        db.close()


if __name__ == "__main__":
    logging.basicConfig(level="INFO")
    run()
