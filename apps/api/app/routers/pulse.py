from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app import store
from app.schemas.envelope import Envelope, Meta, envelope
from app.services.market_status import market_status

router = APIRouter(tags=["pulse"])


@router.get("/pulse", response_model=Envelope[dict])
def pulse() -> Envelope[dict]:
    """The whole Market Pulse screen in one payload — a dict lookup, nothing computed."""
    data = store.pulse()
    if not data:
        raise HTTPException(
            status_code=503,
            detail="Artifacts not loaded yet. Run `python -m jobs.run_nightly`.",
        )
    return envelope(data, Meta(**store.meta()))


@router.get("/market/status")
def status() -> dict:
    """Trading / pre-open / closed / holiday, from the artifact holiday calendar + IST clock."""
    return market_status()
