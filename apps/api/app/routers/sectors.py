from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app import store
from app.schemas.envelope import Envelope, Meta, envelope

router = APIRouter(tags=["sectors"])


@router.get("/sectors", response_model=Envelope[dict])
def sectors() -> Envelope[dict]:
    """Sector rotation — 1M/3M ranking, rank deltas, RRG tail, and each sector's
    constituents with today's LTP/change. A dict lookup, nothing computed."""
    data = store.sectors()
    if not data:
        raise HTTPException(
            status_code=503,
            detail="Artifacts not loaded yet. Run `python -m jobs.run_nightly`.",
        )
    return envelope(data, Meta(**store.meta()))
