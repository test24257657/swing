from __future__ import annotations

import logging

from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger

from app.ingestion.jobs import (
    compute_indicators,
    compute_scores,
    ingest_bhavcopy,
    ingest_indices,
    run_backtest,
    sync_fundamentals,
    sync_symbols,
)

log = logging.getLogger("swing.scheduler")

# All times IST. The bhavcopy with delivery data is reliably published well after close.
IST = "Asia/Kolkata"


def _nightly() -> None:
    """The post-close pipeline, in dependency order."""
    sync_symbols.run()
    ingest_indices.run()
    ingest_bhavcopy.run()
    compute_indicators.run()
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
