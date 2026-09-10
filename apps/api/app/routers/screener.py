from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app import store
from app.schemas.envelope import Envelope, Meta, envelope

router = APIRouter(tags=["screener"])


@router.get("/screener", response_model=Envelope[dict])
def screener() -> Envelope[dict]:
    """Setup-pattern matches (VCP, IPO base, 52w breakout, near pivot) from tonight's
    run — a dict lookup, nothing computed. Filtering by pattern/stage happens client
    side against ``facets`` and ``rows``, both small enough to ship whole."""
    data = store.screener()
    if not data:
        raise HTTPException(
            status_code=503,
            detail="Artifacts not loaded yet. Run `python -m jobs.run_nightly`.",
        )
    return envelope(data, Meta(**store.meta()))
