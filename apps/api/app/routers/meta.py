from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import IngestionRun

router = APIRouter(prefix="/meta", tags=["system"])


@router.get("/ingestion")
def ingestion_status(db: Session = Depends(get_db)) -> dict:
    """Latest run per job — powers the 'data as of' indicator in the app shell."""
    rows = db.execute(
        select(IngestionRun).order_by(IngestionRun.job_name, IngestionRun.started_at.desc())
    ).scalars()

    seen: dict[str, dict] = {}
    for r in rows:
        if r.job_name in seen:
            continue
        seen[r.job_name] = {
            "job": r.job_name,
            "business_date": r.business_date.isoformat(),
            "status": r.status,
            "started_at": r.started_at.isoformat(),
            "finished_at": r.finished_at.isoformat() if r.finished_at else None,
            "rows_written": r.rows_written,
            "source_stats": r.source_stats,
            "error": r.error_text,
        }
    return {"jobs": list(seen.values())}
