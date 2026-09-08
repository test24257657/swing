from __future__ import annotations

import logging

from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger

from app.ingestion.jobs import ingest_bhavcopy, sync_symbols

log = logging.getLogger("swing.scheduler")

# All times IST. The bhavcopy with delivery data is reliably published well after close.
IST = "Asia/Kolkata"


def build_scheduler() -> BlockingScheduler:
    sched = BlockingScheduler(timezone=IST)

    # Symbol master refresh — weekdays, before the bhavcopy job.
    sched.add_job(
        sync_symbols.run,
        CronTrigger(day_of_week="mon-fri", hour=18, minute=45, timezone=IST),
        id="sync_symbols",
        max_instances=1,
        misfire_grace_time=3600,
    )

    # Nightly full-market bhavcopy ingest.
    sched.add_job(
        ingest_bhavcopy.run,
        CronTrigger(day_of_week="mon-fri", hour=19, minute=15, timezone=IST),
        id="ingest_bhavcopy",
        max_instances=1,
        misfire_grace_time=3 * 3600,
    )
    return sched


if __name__ == "__main__":
    logging.basicConfig(level="INFO")
    log.info("starting scheduler (Ctrl-C to stop)")
    build_scheduler().start()
