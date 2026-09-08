from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.db.session import get_db
from app.models import Sector, Symbol
from app.schemas.envelope import Envelope, envelope
from app.schemas.symbol import SectorOut, SymbolOut
from app.services.freshness import meta_for_job

router = APIRouter(tags=["reference"])

SYMBOL_SOURCE = "NSE equity list"
SYMBOL_JOB = "sync_symbols"


@router.get("/symbols", response_model=Envelope[list[SymbolOut]])
def list_symbols(
    q: str | None = Query(default=None, description="Search nse_symbol or name"),
    sector: str | None = Query(default=None, description="Sector slug"),
    fno_only: bool = False,
    limit: int = Query(default=50, le=500),
    offset: int = 0,
    db: Session = Depends(get_db),
) -> Envelope[list[SymbolOut]]:
    stmt = (
        select(Symbol)
        .options(selectinload(Symbol.sector))
        .where(Symbol.is_active.is_(True))
        .order_by(Symbol.nse_symbol)
        .limit(limit)
        .offset(offset)
    )
    if q:
        like = f"%{q.upper()}%"
        stmt = stmt.where(or_(Symbol.nse_symbol.like(like), func.upper(Symbol.name).like(like)))
    if sector:
        stmt = stmt.join(Symbol.sector).where(Sector.slug == sector)
    if fno_only:
        stmt = stmt.where(Symbol.is_fno.is_(True))

    rows = db.execute(stmt).scalars().all()
    return envelope(
        [SymbolOut.model_validate(r) for r in rows],
        meta_for_job(db, SYMBOL_JOB, SYMBOL_SOURCE),
    )


@router.get("/symbols/{nse_symbol}", response_model=Envelope[SymbolOut])
def get_symbol(nse_symbol: str, db: Session = Depends(get_db)) -> Envelope[SymbolOut]:
    row = db.execute(
        select(Symbol)
        .options(selectinload(Symbol.sector))
        .where(Symbol.nse_symbol == nse_symbol.upper())
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail=f"Unknown symbol {nse_symbol!r}")
    return envelope(SymbolOut.model_validate(row), meta_for_job(db, SYMBOL_JOB, SYMBOL_SOURCE))


@router.get("/sectors", response_model=Envelope[list[SectorOut]])
def list_sectors(db: Session = Depends(get_db)) -> Envelope[list[SectorOut]]:
    rows = db.execute(select(Sector).order_by(Sector.name)).scalars().all()
    return envelope(
        [SectorOut.model_validate(r) for r in rows],
        meta_for_job(db, SYMBOL_JOB, "NSE sector mapping"),
    )
