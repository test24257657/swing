from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import IngestionRun
from app.schemas.envelope import Meta

# A job is considered stale once its last success is older than this.
STALE_AFTER = timedelta(hours=20)


def meta_for_job(db: Session, job_name: str, source: str) -> Meta:
    """Build a :class:`Meta` from the latest successful run of ``job_name``."""
    run = db.execute(
        select(IngestionRun)
        .where(IngestionRun.job_name == job_name, IngestionRun.status.in_(("success", "partial")))
        .order_by(IngestionRun.finished_at.desc())
        .limit(1)
    ).scalar_one_or_none()

    if run is None or run.finished_at is None:
        return Meta(source=source, as_of=None, stale=True, job=job_name)

    finished = run.finished_at
    if finished.tzinfo is None:
        finished = finished.replace(tzinfo=UTC)
    stale = (datetime.now(UTC) - finished) > STALE_AFTER or run.status == "partial"
    return Meta(source=source, as_of=finished, stale=stale, job=job_name)
