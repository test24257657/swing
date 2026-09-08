from __future__ import annotations

import logging
import time
from datetime import UTC, date, datetime

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.db.session import SessionLocal
from app.ingestion.run_context import ingestion_run
from app.ingestion.sources.yf_fundamentals import fetch
from app.models import Fundamental, Symbol

log = logging.getLogger("swing.ingest.fundamentals")

JOB = "sync_fundamentals"


def run(business_date: date | None = None, limit: int | None = None, sleep: float = 0.4) -> None:
    """Quarterly fundamentals via yfinance for the active universe.

    Slow — one HTTP round-trip per symbol. ~2000 symbols ≈ 20–40 min. yfinance results are
    cached to disk, so a re-run only re-fetches misses. Run less often than the bhavcopy
    job (results move quarterly).
    """
    business_date = business_date or date.today()
    db = SessionLocal()
    try:
        with ingestion_run(db, JOB, business_date) as run_row:
            symbols = db.execute(select(Symbol.id, Symbol.nse_symbol).where(Symbol.is_active.is_(True))).all()
            if limit:
                symbols = symbols[:limit]

            fetched_at = datetime.now(UTC)
            written, hit, miss = 0, 0, 0
            for sid, sym in symbols:
                res = fetch(sym)
                if res is None or not res.quarters:
                    miss += 1
                    continue
                hit += 1
                latest_ratios = {
                    "pe": res.pe,
                    "pb": res.pb,
                    "roe": res.roe,
                    "debt_equity": res.debt_equity,
                }
                payload = []
                for i, q in enumerate(res.quarters):
                    row = {
                        "symbol_id": sid,
                        "period_end": q.period_end,
                        "period_type": "quarterly",
                        "revenue": q.revenue,
                        "net_profit": q.net_profit,
                        "eps": q.eps,
                        "source": "yfinance",
                        "fetched_at": fetched_at,
                    }
                    # attach the point-in-time ratios only to the most recent quarter
                    if i == len(res.quarters) - 1:
                        row.update(latest_ratios)
                    payload.append(row)

                stmt = pg_insert(Fundamental).values(payload)
                stmt = stmt.on_conflict_do_update(
                    index_elements=["symbol_id", "period_end", "period_type"],
                    set_={
                        c: stmt.excluded[c]
                        for c in (
                            "revenue",
                            "net_profit",
                            "eps",
                            "pe",
                            "pb",
                            "roe",
                            "debt_equity",
                            "fetched_at",
                        )
                    },
                )
                db.execute(stmt)
                db.commit()
                written += len(payload)
                if sleep:
                    time.sleep(sleep)

            run_row.rows_written = written
            run_row.source_stats = {
                "symbols": len(symbols),
                "with_data": hit,
                "no_data": miss,
                "source": "yfinance.quarterly_income_stmt",
            }
            run_row.status = "success" if hit else "partial"
        log.info("fundamentals: %s rows, %s symbols with data", written, hit)
    finally:
        db.close()


if __name__ == "__main__":
    import os

    logging.basicConfig(level="INFO")
    run(limit=int(os.environ["FUND_LIMIT"]) if os.environ.get("FUND_LIMIT") else None)
