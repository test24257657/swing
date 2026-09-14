from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app import store
from app.schemas.envelope import Envelope, Meta, envelope

router = APIRouter(tags=["ai"])


@router.get("/ai-summary/{slug}", response_model=Envelope[dict])
def ai_summary(slug: str) -> Envelope[dict]:
    """A short AI-written read on this stock — technicals, setup pattern, fundamentals
    trend and recent news synthesized into one paragraph. A second opinion alongside
    the rule-based technical verdict, not a replacement for it — a missing artifact
    just means the symbol wasn't in scope that night, or Gemini was unavailable."""
    data = store.ai_summary(slug)
    if not data:
        raise HTTPException(status_code=404, detail=f"No AI summary for {slug!r}.")
    return envelope(data, Meta(**store.meta()))


@router.get("/weekly-outlook", response_model=Envelope[dict])
def weekly_outlook() -> Envelope[dict]:
    """The AI's weekly market-wide call — breadth/volatility/flows/sectors/indices
    synthesized into one direction + sector lean, refreshed Fridays only. Carries a
    self-graded review of its own prior call once mem0 has more than one week on
    record."""
    data = store.weekly_outlook()
    if not data:
        raise HTTPException(
            status_code=503,
            detail="No weekly outlook yet — generated on the first Friday nightly run after this shipped.",
        )
    return envelope(data, Meta(**store.meta()))
