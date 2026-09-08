from __future__ import annotations

import logging
from datetime import date

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.ingestion.calendar import last_trading_day, trading_days
from app.ingestion.run_context import ingestion_run
from app.ingestion.sources.nse_bhavcopy import fetch_bhavcopy, normalize
from app.models import DailyBar, Symbol

log = logging.getLogger("swing.ingest.bhavcopy")

JOB = "ingest_bhavcopy"


def _symbol_id_map(db: Session) -> dict[str, int]:
    return {sym: sid for sym, sid in db.execute(select(Symbol.nse_symbol, Symbol.id))}


def ingest_one_day(db: Session, d: date) -> tuple[int, int]:
    """Returns (rows_upserted, unknown_symbols_skipped)."""
    raw = fetch_bhavcopy(d)
    rows = normalize(raw, d)
    sid = _symbol_id_map(db)

    payload, skipped = [], 0
    for r in rows:
        symbol_id = sid.get(r.nse_symbol)
        if symbol_id is None:
            skipped += 1
            continue
        payload.append(
            {
                "symbol_id": symbol_id,
                "date": r.d,
                "open": r.open,
                "high": r.high,
                "low": r.low,
                "close": r.close,
                "prev_close": r.prev_close,
                "vwap": r.vwap,
                "volume": r.volume,
                "trades": r.trades,
                "turnover": r.turnover,
                "delivery_qty": r.delivery_qty,
                "delivery_pct": r.delivery_pct,
                "series": r.series,
                "source": "nse_bhavcopy",
            }
        )

    if payload:
        stmt = pg_insert(DailyBar).values(payload)
        update_cols = {
            c: stmt.excluded[c]
            for c in (
                "open", "high", "low", "close", "prev_close", "vwap", "volume",
                "trades", "turnover", "delivery_qty", "delivery_pct", "series", "source",
            )
        }
        stmt = stmt.on_conflict_do_update(index_elements=["symbol_id", "date"], set_=update_cols)
        db.execute(stmt)
        db.commit()

    return len(payload), skipped


def run(business_date: date | None = None, backfill_from: date | None = None) -> None:
    end = business_date or last_trading_day()
    days = trading_days(backfill_from, end) if backfill_from else [end]

    db = SessionLocal()
    try:
        with ingestion_run(db, JOB, end) as run_row:
            total, skipped_total, failed_days = 0, 0, []
            for d in days:
                try:
                    n, skipped = ingest_one_day(db, d)
                    total += n
                    skipped_total += skipped
                    log.info("bhavcopy %s: %s rows (%s unknown symbols)", d, n, skipped)
                except Exception as exc:  # noqa: BLE001 - one bad day should not fail the run
                    failed_days.append(d.isoformat())
                    log.warning("bhavcopy %s failed: %s", d, exc)

            run_row.rows_written = total
            run_row.source_stats = {
                "days_requested": [d.isoformat() for d in days],
                "days_failed": failed_days,
                "unknown_symbols_skipped": skipped_total,
                "source": "nselib.bhav_copy_with_delivery -> jugaad fallback",
            }
            run_row.status = "partial" if failed_days else "success"
    finally:
        db.close()


if __name__ == "__main__":
    import os
    from datetime import timedelta

    logging.basicConfig(level="INFO")
    days_back = int(os.environ.get("INGEST_BACKFILL_DAYS", "5"))
    run(backfill_from=last_trading_day() - timedelta(days=days_back))
