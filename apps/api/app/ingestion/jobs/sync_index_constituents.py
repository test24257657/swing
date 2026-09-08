from __future__ import annotations

import logging
from datetime import date

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.db.session import SessionLocal
from app.ingestion.run_context import ingestion_run
from app.ingestion.sources.niftyindices import CSV_FILE, constituents
from app.models import IndexConstituent, MarketIndex, Symbol

log = logging.getLogger("swing.ingest.index_constituents")

JOB = "sync_index_constituents"


def run(business_date: date | None = None) -> None:
    """Populate index_constituents from the niftyindices.com constituent lists (cached).
    Covers every index in CSV_FILE — broad and sectoral. Weights stay NULL (the plain
    lists carry no weights); the UI falls back to equal-weight for point contribution."""
    business_date = business_date or date.today()
    db = SessionLocal()
    try:
        with ingestion_run(db, JOB, business_date) as run_row:
            symbols_by_name = {s.nse_symbol: s.id for s in db.execute(select(Symbol)).scalars()}
            indices = {m.symbol: m for m in db.execute(select(MarketIndex)).scalars()}

            payload, done = [], []
            for symbol, mi in indices.items():
                if symbol not in CSV_FILE:
                    continue
                members = constituents(symbol)
                if not members:
                    continue
                done.append(symbol)
                db.execute(delete(IndexConstituent).where(IndexConstituent.index_id == mi.id))
                for name in members:
                    sid = symbols_by_name.get(name)
                    if sid:
                        payload.append(
                            {"index_id": mi.id, "symbol_id": sid, "weight": None, "as_of": business_date}
                        )

            if payload:
                db.execute(pg_insert(IndexConstituent).values(payload).on_conflict_do_nothing())
            db.commit()

            run_row.rows_written = len(payload)
            run_row.source_stats = {"indices": done, "memberships": len(payload), "weights": "equal (NULL)"}
            run_row.status = "success" if payload else "partial"
        log.info("index constituents: %s memberships across %s indices", run_row.rows_written, len(done))
    finally:
        db.close()


if __name__ == "__main__":
    logging.basicConfig(level="INFO")
    run()
