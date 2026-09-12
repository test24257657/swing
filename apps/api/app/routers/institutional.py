from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app import store
from app.schemas.envelope import Envelope, Meta, envelope

router = APIRouter(tags=["institutional"])


@router.get("/institutional", response_model=Envelope[dict])
def institutional() -> Envelope[dict]:
    """Bulk/block deal disclosures (repeat-accumulation flagged) and participant-wise
    open interest, including the FII index-futures long/short ratio trend."""
    data = store.institutional()
    if not data:
        raise HTTPException(
            status_code=503,
            detail="Artifacts not loaded yet. Run `python -m jobs.run_nightly`.",
        )
    return envelope(data, Meta(**store.meta()))
