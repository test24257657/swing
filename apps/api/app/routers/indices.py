from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.envelope import Envelope, envelope
from app.services.freshness import meta_for_job
from app.services.indices_view import (
    index_compare,
    index_constituents,
    index_detail,
    indices_list,
)

router = APIRouter(prefix="/indices", tags=["indices"])
SOURCE = "NSE index values"
JOB = "ingest_indices"


@router.get("", response_model=Envelope[dict])
def list_indices(
    db: Annotated[Session, Depends(get_db)],
    category: str | None = Query(default=None),
) -> Envelope[dict]:
    return envelope(indices_list(db, category), meta_for_job(db, JOB, SOURCE))


@router.get("/compare", response_model=Envelope[dict])
def compare(
    db: Annotated[Session, Depends(get_db)],
    symbols: str = Query(description="comma-separated index symbols"),
    tf: str = "3M",
) -> Envelope[dict]:
    syms = [s.strip() for s in symbols.split(",") if s.strip()]
    return envelope(index_compare(db, syms, tf), meta_for_job(db, JOB, SOURCE))


@router.get("/{symbol:path}/constituents", response_model=Envelope[dict])
def constituents(symbol: str, db: Annotated[Session, Depends(get_db)]) -> Envelope[dict]:
    data = index_constituents(db, symbol)
    if data is None:
        raise HTTPException(status_code=404, detail=f"Unknown index {symbol!r}")
    return envelope(data, meta_for_job(db, JOB, "NSE index factsheet + bhavcopy"))


@router.get("/{symbol:path}", response_model=Envelope[dict])
def detail(symbol: str, db: Annotated[Session, Depends(get_db)], tf: str = "3M") -> Envelope[dict]:
    data = index_detail(db, symbol, tf)
    if data is None:
        raise HTTPException(status_code=404, detail=f"Unknown index {symbol!r}")
    return envelope(data, meta_for_job(db, JOB, SOURCE))
