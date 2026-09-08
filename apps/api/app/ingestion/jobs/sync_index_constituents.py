from __future__ import annotations

import logging
from datetime import date

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.db.session import SessionLocal
from app.ingestion.run_context import ingestion_run
from app.models import IndexConstituent, MarketIndex, Sector, Symbol

log = logging.getLogger("swing.ingest.index_constituents")

JOB = "sync_index_constituents"


def run(business_date: date | None = None) -> None:
    """Populate index_constituents for **sectoral** indices from the symbol->sector map
    (weight NULL — no factsheet source yet). Broad/thematic index membership needs a
    dedicated NSE source and is left empty for now."""
    business_date = business_date or date.today()
    db = SessionLocal()
    try:
        with ingestion_run(db, JOB, business_date) as run_row:
            sector_to_index = dict(
                db.execute(
                    select(Sector.id, MarketIndex.id).join(
                        MarketIndex, MarketIndex.symbol == Sector.nse_index_symbol
                    )
                ).all()
            )
            members = db.execute(
                select(Symbol.id, Symbol.sector_id).where(
                    Symbol.is_active.is_(True), Symbol.sector_id.isnot(None)
                )
            ).all()

            payload = []
            for symbol_id, sector_id in members:
                index_id = sector_to_index.get(sector_id)
                if index_id:
                    payload.append(
                        {"index_id": index_id, "symbol_id": symbol_id, "weight": None, "as_of": business_date}
                    )

            db.execute(
                delete(IndexConstituent).where(IndexConstituent.index_id.in_(list(sector_to_index.values())))
            )
            if payload:
                db.execute(pg_insert(IndexConstituent).values(payload).on_conflict_do_nothing())
            db.commit()

            run_row.rows_written = len(payload)
            run_row.source_stats = {
                "sectoral_indices": len(sector_to_index),
                "memberships": len(payload),
                "note": "sectoral only; weights NULL",
            }
            run_row.status = "success" if payload else "partial"
        log.info("index constituents: %s memberships", run_row.rows_written)
    finally:
        db.close()


if __name__ == "__main__":
    logging.basicConfig(level="INFO")
    run()
