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


@router.get("/chart/{slug}", response_model=Envelope[dict])
def chart(slug: str) -> Envelope[dict]:
    """OHLCV + moving averages for one instrument shown on Pulse. Slug is the symbol with
    non-alphanumerics replaced by ``_`` — e.g. ``NIFTY_50``, ``TATAMOTORS``."""
    data = store.chart(slug)
    if not data:
        raise HTTPException(
            status_code=404,
            detail=f"No chart for {slug!r}. Charts exist only for instruments on Market Pulse.",
        )
    return envelope(data, Meta(**store.meta()))


@router.get("/fundamentals/{slug}", response_model=Envelope[dict])
def fundamentals(slug: str) -> Envelope[dict]:
    """Quarterly revenue/net-income, last 4 quarters, from yfinance. Not every symbol has
    this — a missing artifact just means yfinance had nothing for it that night."""
    data = store.fundamentals(slug)
    if not data:
        raise HTTPException(status_code=404, detail=f"No fundamentals for {slug!r}.")
    return envelope(data, Meta(**store.meta()))
