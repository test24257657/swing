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
    from nselib import capital_market

    raw = capital_market.holiday_master(holiday_type="trading")
    df = pd.DataFrame(raw)
    df.columns = [c.strip().lower() for c in df.columns]
    df.to_csv(cache, index=False)
    return df


def run(business_date: date | None = None) -> None:
    business_date = business_date or date.today()
    db = SessionLocal()
    try:
        with ingestion_run(db, JOB, business_date) as run_row:
            df = _fetch()
            date_col = next((c for c in df.columns if "date" in c or "trade" in c), None)
            desc_col = next((c for c in df.columns if "descr" in c or "purpose" in c or "holiday" in c), None)
            if not date_col:
                run_row.status = "partial"
                run_row.source_stats = {"note": "no date column", "columns": list(df.columns)}
                return

            payload = []
            for r in df.to_dict("records"):
                raw_d = str(r[date_col]).strip()
                d = None
                for fmt in ("%d-%b-%Y", "%d-%b-%y", "%Y-%m-%d", "%d-%m-%Y"):
                    try:
                        d = datetime.strptime(raw_d, fmt).date()
                        break
                    except ValueError:
                        continue
                if d is None:
                    continue
                desc = str(r.get(desc_col, "")).strip() if desc_col else ""
                payload.append(
                    {
                        "date": d,
                        "description": desc[:120],
                        "segment": "equities",
                        "is_muhurat": "muhurat" in desc.lower(),
                    }
                )

            if payload:
                stmt = pg_insert(HolidayCalendar).values(payload)
                stmt = stmt.on_conflict_do_update(
                    index_elements=["date"],
                    set_={"description": stmt.excluded.description, "is_muhurat": stmt.excluded.is_muhurat},
                )
                db.execute(stmt)
                db.commit()

            run_row.rows_written = len(payload)
            run_row.source_stats = {"holidays": len(payload), "source": "nselib.holiday_master"}
            run_row.status = "success" if payload else "partial"
        log.info("holidays: %s dates", run_row.rows_written)
    finally:
        db.close()


if __name__ == "__main__":
    logging.basicConfig(level="INFO")
    run()
