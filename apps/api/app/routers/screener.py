from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import SavedScreen
from app.schemas.envelope import Envelope, envelope
from app.schemas.screener import ScreenerResult
from app.services.freshness import meta_for_job
from app.services.screener import ScreenerQuery, run_screener

router = APIRouter(prefix="/screener", tags=["screener"])

SOURCE = "NSE bhavcopy + precomputed indicators/score"


@router.get("", response_model=Envelope[ScreenerResult])
def screen(
    db: Annotated[Session, Depends(get_db)],
    sector: str | None = None,
    fno_only: bool = False,
    mcap_category: Annotated[list[str], Query()] = None,  # noqa: RUF013
    rsi_min: float | None = None,
    rsi_max: float | None = None,
    dist_52wh_min: float | None = None,
    dist_52wh_max: float | None = None,
    rel_volume_min: float | None = None,
    delivery_min: float | None = None,
    min_score: float | None = None,
    above_sma_20: bool | None = None,
    above_sma_50: bool | None = None,
    above_sma_200: bool | None = None,
    patterns: Annotated[list[str], Query()] = None,  # noqa: RUF013 - Phase 2
    stage: str | None = None,
    sort: str = "composite",
    order: str = "desc",
    page: int = 1,
    per_page: int = Query(default=25, le=200),
) -> Envelope[ScreenerResult]:
    q = ScreenerQuery(
        sector=sector,
        fno_only=fno_only,
        mcap_category=mcap_category or [],
        rsi_min=rsi_min,
        rsi_max=rsi_max,
        dist_52wh_min=dist_52wh_min,
        dist_52wh_max=dist_52wh_max,
        rel_volume_min=rel_volume_min,
        delivery_min=delivery_min,
        min_score=min_score,
        above_sma_20=above_sma_20,
        above_sma_50=above_sma_50,
        above_sma_200=above_sma_200,
        patterns=patterns or [],
        stage=stage,
        sort=sort,
        order=order,
        page=page,
        per_page=per_page,
    )
    result = run_screener(db, q)
    return envelope(result, meta_for_job(db, "compute_scores", SOURCE))


# --- Saved screens -----------------------------------------------------------------


class SavedScreenIn(dict):
    pass


@router.get("/saved")
def list_saved(db: Annotated[Session, Depends(get_db)]) -> dict:
    rows = (
        db.execute(select(SavedScreen).where(SavedScreen.user_id == "local").order_by(SavedScreen.name))
        .scalars()
        .all()
    )
    return {
        "screens": [
            {"id": s.id, "name": s.name, "filters": s.filters, "updated_at": s.updated_at.isoformat()}
            for s in rows
        ]
    }


@router.post("/saved", status_code=201)
def create_saved(payload: dict, db: Annotated[Session, Depends(get_db)]) -> dict:
    name = str(payload.get("name", "")).strip()
    filters = payload.get("filters")
    if not name or not isinstance(filters, dict):
        raise HTTPException(status_code=422, detail="name and filters (object) are required")
    existing = db.execute(
        select(SavedScreen).where(SavedScreen.user_id == "local", SavedScreen.name == name)
    ).scalar_one_or_none()
    if existing:
        existing.filters = filters
        db.commit()
        return {"id": existing.id, "name": existing.name, "updated": True}
    row = SavedScreen(user_id="local", name=name, filters=filters)
    db.add(row)
    db.commit()
    return {"id": row.id, "name": row.name, "updated": False}


@router.delete("/saved/{screen_id}", status_code=204)
def delete_saved(screen_id: int, db: Annotated[Session, Depends(get_db)]) -> None:
    row = db.get(SavedScreen, screen_id)
    if row and row.user_id == "local":
        db.delete(row)
        db.commit()
