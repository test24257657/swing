from __future__ import annotations

import threading
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app import store
from app.auth.deps import CurrentUser
from app.config import settings
from app.schemas.envelope import Envelope, Meta, envelope
from app.services import gemini
from app.services.stock_chat import build_context, system_prompt

router = APIRouter(tags=["ai"])

IST = timezone(timedelta(hours=5, minutes=30))
MAX_TURNS = 12  # history sent back to the model; older turns are dropped
MAX_CHARS = 1000

# Per-user daily counter, in memory. Resets on restart, which only ever errs toward
# allowing a few extra questions — acceptable for a quota guard, not a billing meter.
_usage: dict[tuple[str, str], int] = {}
_lock = threading.Lock()


class ChatTurn(BaseModel):
    role: Literal["user", "model"]
    text: str = Field(min_length=1, max_length=4000)


class ChatRequest(BaseModel):
    messages: list[ChatTurn] = Field(min_length=1)


class ChatReply(BaseModel):
    answer: str
    data_used: list[str]
    data_as_of: str | None
    used_today: int
    daily_limit: int


def _today_ist() -> str:
    return datetime.now(IST).date().isoformat()


@router.post("/chat/{slug}", response_model=Envelope[ChatReply])
def chat(slug: str, body: ChatRequest, user: CurrentUser) -> Envelope[ChatReply]:
    """Ask the AI about one stock. The answer is grounded only in that stock's nightly
    data (price, technicals, setup, deals, F&O, results, news, sector) — the numbers are
    computed server-side and the model is instructed to quote, not calculate. The client
    holds the conversation and sends it back each turn."""
    if not gemini.is_configured():
        raise HTTPException(503, "AI chat isn't configured on the server (GEMINI_API_KEY missing).")

    last = body.messages[-1]
    if last.role != "user":
        raise HTTPException(422, "The last message must be the user's question.")
    if len(last.text) > MAX_CHARS:
        raise HTTPException(422, f"Keep questions under {MAX_CHARS} characters.")

    built = build_context(slug)
    if built is None:
        raise HTTPException(404, f"No data for {slug!r}.")
    context, used = built

    key = (user.email, _today_ist())
    with _lock:
        count = _usage.get(key, 0)
        if count >= settings.chat_daily_limit:
            limit = settings.chat_daily_limit
            raise HTTPException(429, f"Daily limit of {limit} AI questions reached — resets at midnight IST.")
        _usage[key] = count + 1  # reserve before the slow call so parallel requests can't overshoot

    turns = [{"role": t.role, "text": t.text} for t in body.messages[-MAX_TURNS:]]
    if turns[0]["role"] != "user":  # Gemini requires the conversation to open with a user turn
        turns = turns[1:]
    answer = gemini.chat(system_prompt(context, datetime.now(IST).date()), turns)
    if answer is None:
        with _lock:
            _usage[key] = max(0, _usage.get(key, 1) - 1)  # a failed call shouldn't cost a question
        raise HTTPException(503, "The AI is busy or out of quota right now — try again in a minute.")

    with _lock:
        used_today = _usage.get(key, 0)
    meta = store.meta()
    return envelope(
        ChatReply(
            answer=answer,
            data_used=used,
            data_as_of=meta.get("as_of"),
            used_today=used_today,
            daily_limit=settings.chat_daily_limit,
        ),
        Meta(**{**meta, "source": "Nightly NSE artifacts + Gemini"}),
    )
