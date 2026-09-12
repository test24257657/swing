from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app import store
from app.schemas.envelope import Envelope, Meta, envelope

router = APIRouter(tags=["fno"])


@router.get("/fno/{slug}", response_model=Envelope[dict])
def fno(slug: str) -> Envelope[dict]:
    """Buildup classification (near-month stock futures) + option chain with max-OI
    support/resistance strikes. Only F&O-eligible symbols have this — a missing
    artifact just means the stock has no listed futures/options."""
    data = store.fno(slug)
    if not data:
        raise HTTPException(status_code=404, detail=f"No F&O data for {slug!r} — not F&O-eligible.")
    return envelope(data, Meta(**store.meta()))


@router.get("/depth/{slug}", response_model=Envelope[dict])
def depth(slug: str) -> Envelope[dict]:
    """Best-effort L2 market depth snapshot. NSE's quote-equity endpoint is the one
    source in this pipeline known to be unreliable from some hosts — a missing
    artifact means it didn't come through that night, not that the symbol is invalid."""
    data = store.depth(slug)
    if not data:
        raise HTTPException(status_code=404, detail=f"No depth snapshot for {slug!r}.")
    return envelope(data, Meta(**store.meta()))
