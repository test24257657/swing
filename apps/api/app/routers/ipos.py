from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app import store
from app.schemas.envelope import Envelope, Meta, envelope

router = APIRouter(tags=["ipos"])


@router.get("/ipos", response_model=Envelope[dict])
def ipos() -> Envelope[dict]:
    """Every NSE IPO listed in the last year that has price history — issue price,
    listing pop, gain since IPO and since listing, and whether it has built a first
    base. Bars live in /ipos/{slug} so a page only loads the charts it shows."""
    data = store.ipos()
    if not data:
        raise HTTPException(status_code=503, detail="No IPO data yet — built by the nightly run.")
    return envelope(data, Meta(**{**store.meta(), "source": "NSE public issues + bhavcopy"}))


@router.get("/ipos/{slug}", response_model=Envelope[dict])
def ipo_chart(slug: str) -> Envelope[dict]:
    """Post-listing daily bars for one IPO."""
    data = store.ipo_chart(slug)
    if not data:
        raise HTTPException(status_code=404, detail=f"No IPO chart for {slug!r}.")
    return envelope(data, Meta(**{**store.meta(), "source": "NSE bhavcopy"}))
