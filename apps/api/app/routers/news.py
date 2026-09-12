from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app import store
from app.schemas.envelope import Envelope, Meta, envelope

router = APIRouter(tags=["news"])


@router.get("/news", response_model=Envelope[dict])
def news() -> Envelope[dict]:
    """Corporate announcements for the interesting symbol universe (movers/screener/
    watchlist), filtered to relevant categories and AI-classified by likely impact."""
    data = store.news()
    if not data:
        raise HTTPException(
            status_code=503,
            detail="Artifacts not loaded yet. Run `python -m jobs.run_nightly`.",
        )
    return envelope(data, Meta(**store.meta()))
