from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.envelope import Envelope, Meta, envelope
from app.services.freshness import meta_for_job
from app.services.market_status import market_status
from app.services.pulse import market_pulse
from app.services.sector_rotation import sector_rotation

router = APIRouter(tags=["market"])


@router.get("/market/status")
def status(db: Annotated[Session, Depends(get_db)]) -> dict:
    """Live market-status pill: trading / pre-open / closed / holiday, with a countdown.
    Driven by the NSE holiday calendar + the IST clock. Not cached (it's a clock)."""
    return market_status(db)


@router.get("/market/pulse", response_model=Envelope[dict])
def pulse(db: Annotated[Session, Depends(get_db)]) -> Envelope[dict]:
    return envelope(market_pulse(db), meta_for_job(db, "compute_breadth", "NSE indices + bhavcopy + FII/DII"))


@router.get("/sectors/rotation", response_model=Envelope[dict])
def rotation(
    db: Annotated[Session, Depends(get_db)],
    tf: str = Query(default="1M"),
) -> Envelope[dict]:
    data = sector_rotation(db, tf)
    return envelope(
        data,
        Meta(source="NSE sectoral indices", as_of=None, stale=data["as_of"] is None, job="ingest_indices"),
    )
