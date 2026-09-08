from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.envelope import Envelope, envelope
from app.services.chart import symbol_chart
from app.services.freshness import meta_for_job

router = APIRouter(prefix="/stocks", tags=["stocks"])


@router.get("/{nse_symbol}/chart", response_model=Envelope[dict])
def chart(
    nse_symbol: str,
    db: Annotated[Session, Depends(get_db)],
    tf: str = "6M",
) -> Envelope[dict]:
    data = symbol_chart(db, nse_symbol, tf)
    if data is None:
        raise HTTPException(status_code=404, detail=f"Unknown symbol {nse_symbol!r}")
    return envelope(data, meta_for_job(db, "ingest_bhavcopy", "NSE EOD OHLCV · adjusted"))
