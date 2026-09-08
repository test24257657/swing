from __future__ import annotations

import logging
from datetime import date

from sqlalchemy import case, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.db.session import SessionLocal
from app.ingestion.calendar import last_trading_day
from app.ingestion.run_context import ingestion_run
from app.models import DailyBar, DailyIndicator, MarketBreadth

log = logging.getLogger("swing.compute.breadth")

JOB = "compute_breadth"


def run(business_date: date | None = None) -> None:
    end = business_date or last_trading_day()
    db = SessionLocal()
    try:
        with ingestion_run(db, JOB, end) as run_row:
            chg = DailyBar.close - DailyBar.prev_close
            row = db.execute(
                select(
                    func.count().label("traded"),
                    func.sum(case((chg > 0, 1), else_=0)).label("adv"),
                    func.sum(case((chg < 0, 1), else_=0)).label("dec"),
                    func.sum(case((chg == 0, 1), else_=0)).label("unch"),
                ).where(DailyBar.date == end, DailyBar.prev_close.isnot(None))
            ).one()

            if not row.traded:
                run_row.status = "partial"
                run_row.source_stats = {"note": f"no bars for {end}"}
                return

            ind = db.execute(
                select(
                    func.count().label("n"),
                    func.sum(case((DailyIndicator.above_sma_50.is_(True), 1), else_=0)).label("a50"),
                    func.sum(case((DailyIndicator.above_sma_200.is_(True), 1), else_=0)).label("a200"),
                    func.sum(case((DailyIndicator.dist_52w_high_pct >= -0.05, 1), else_=0)).label("nh"),
                    func.sum(case((DailyIndicator.dist_52w_low_pct <= 0.05, 1), else_=0)).label("nl"),
                ).where(DailyIndicator.date == end)
            ).one()

            n = ind.n or 0
            payload = {
                "date": end,
                "traded": int(row.traded),
                "advances": int(row.adv or 0),
                "declines": int(row.dec or 0),
                "unchanged": int(row.unch or 0),
                "pct_above_50dma": round((ind.a50 or 0) / n * 100, 2) if n else None,
                "pct_above_200dma": round((ind.a200 or 0) / n * 100, 2) if n else None,
                "new_52w_highs": int(ind.nh or 0),
                "new_52w_lows": int(ind.nl or 0),
            }
            stmt = pg_insert(MarketBreadth).values(payload)
            stmt = stmt.on_conflict_do_update(
                index_elements=["date"],
                set_={k: stmt.excluded[k] for k in payload if k != "date"},
            )
            db.execute(stmt)
            db.commit()

            run_row.rows_written = 1
            run_row.source_stats = payload
            run_row.status = "success"
        log.info("breadth %s: %s adv / %s dec", end, payload["advances"], payload["declines"])
    finally:
        db.close()


if __name__ == "__main__":
    logging.basicConfig(level="INFO")
    run()
