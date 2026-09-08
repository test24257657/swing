from __future__ import annotations

from contextlib import contextmanager
from datetime import UTC, date, datetime

from sqlalchemy.orm import Session

from app.models import IngestionRun


@contextmanager
def ingestion_run(db: Session, job_name: str, business_date: date):
    """Wrap a job so every attempt is recorded — success, partial, or failure.

    Usage::

        with ingestion_run(db, "ingest_bhavcopy", d) as run:
            run.rows_written = n
            run.source_stats = {...}
            run.status = "success"  # or "partial"
    """
    run = IngestionRun(
        job_name=job_name,
        business_date=business_date,
        status="running",
        started_at=datetime.now(UTC),
    )
    db.add(run)
    db.commit()
    try:
        yield run
        if run.status == "running":
            run.status = "success"
    except Exception as exc:  # noqa: BLE001 - we want to persist the failure and re-raise
        run.status = "failed"
        run.error_text = f"{type(exc).__name__}: {exc}"
        raise
    finally:
        run.finished_at = datetime.now(UTC)
        db.add(run)
        db.commit()
