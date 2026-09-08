from __future__ import annotations

import logging

from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger

from app.ingestion.calendar import refresh_holidays
from app.ingestion.jobs import (
    compute_breadth,
    compute_indicators,
    compute_scores,
    detect_patterns,
    ingest_bhavcopy,
    ingest_fii_dii,
    ingest_holidays,
    ingest_indices,
    run_backtest,
    sync_fundamentals,
    sync_index_constituents,
    sync_symbols,
)

log = logging.getLogger("swing.scheduler")

# All times IST. The bhavcopy with delivery data is reliably published well after close.
IST = "Asia/Kolkata"


def _nightly() -> None:
    """The post-close pipeline, in dependency order."""
    ingest_holidays.run()
    refresh_holidays()
    sync_symbols.run()
    ingest_indices.run()
    sync_index_constituents.run()  # needs both symbols and indices
    ingest_bhavcopy.run()
    ingest_fii_dii.run()
    compute_indicators.run()
    compute_breadth.run()
    detect_patterns.run()
    sync_fundamentals.run()  # slow; internally cached
    compute_scores.run()
    run_backtest.run()


def build_scheduler() -> BlockingScheduler:
    sched = BlockingScheduler(timezone=IST)
    sched.add_job(
        _nightly,
        CronTrigger(day_of_week="mon-fri", hour=19, minute=15, timezone=IST),
        id="nightly_pipeline",
        max_instances=1,
        misfire_grace_time=4 * 3600,
    )
    return sched


if __name__ == "__main__":
    logging.basicConfig(level="INFO")
    log.info("starting scheduler (Ctrl-C to stop)")
    build_scheduler().start()
