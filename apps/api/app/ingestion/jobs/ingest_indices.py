from __future__ import annotations

import logging
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.ingestion.calendar import last_trading_day
from app.ingestion.indices_seed import INDICES
from app.ingestion.run_context import ingestion_run
from app.ingestion.sources.nse_index import fetch_index_history, normalize
from app.models import IndexBar, MarketIndex

log = logging.getLogger("swing.ingest.indices")

JOB = "ingest_indices"


def _upsert_indices(db: Session) -> dict[str, MarketIndex]:
    existing = {i.symbol: i for i in db.execute(select(MarketIndex)).scalars()}
    for row in INDICES:
        m = existing.get(row["symbol"])
        if m is None:
            m = MarketIndex(symbol=row["symbol"], name=row["name"], category=row["category"])
            db.add(m)
            existing[row["symbol"]] = m
        else:
            m.name, m.category = row["name"], row["category"]
    db.commit()
    return existing


def run(business_date: date | None = None, days: int = 420) -> None:
    end = business_date or last_trading_day()
    start = end - timedelta(days=int(days * 1.5))  # calendar days padding for weekends/holidays

    db = SessionLocal()
    try:
        with ingestion_run(db, JOB, end) as run_row:
            indices = _upsert_indices(db)
            total, failed = 0, []
            for symbol, mi in indices.items():
                try:
                    raw = fetch_index_history(symbol, start, end)
                    rows = normalize(raw)
                    if not rows:
                        failed.append(symbol)
                        continue
                    payload = [
                        {
                            "index_id": mi.id,
                            "date": r.d,
                            "open": r.open,
                            "high": r.high,
                            "low": r.low,
                            "close": r.close,
                            "source": "nse_index",
                        }
                        for r in rows
                    ]
                    stmt = pg_insert(IndexBar).values(payload)
                    stmt = stmt.on_conflict_do_update(
                        index_elements=["index_id", "date"],
                        set_={c: stmt.excluded[c] for c in ("open", "high", "low", "close")},
                    )
                    db.execute(stmt)
                    db.commit()
                    total += len(payload)
                    log.info("index %s: %s bars", symbol, len(payload))
                except Exception as exc:  # noqa: BLE001
                    failed.append(symbol)
                    log.warning("index %s failed: %s", symbol, exc)

            run_row.rows_written = total
            run_row.source_stats = {
                "indices": len(indices),
                "failed": failed,
                "source": "nselib.index_data",
            }
            run_row.status = "partial" if failed else "success"
    finally:
        db.close()


if __name__ == "__main__":
    logging.basicConfig(level="INFO")
    run()
