from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import store
from app.auth.deps import CurrentUser
from app.db.session import get_db
from app.models import Alert, WatchlistItem
from app.schemas.envelope import Envelope, Meta, envelope
from app.schemas.watchlist import (
    AlertIn,
    AlertOut,
    AlertUpdate,
    WatchlistItemIn,
    WatchlistItemOut,
    WatchlistItemUpdate,
)

router = APIRouter(prefix="/watchlist", tags=["watchlist"])

DbSession = Annotated[Session, Depends(get_db)]


def _out(item: WatchlistItem) -> WatchlistItemOut:
    q = store.quote(item.symbol)
    return WatchlistItemOut(
        id=item.id,
        symbol=item.symbol,
        name=item.name,
        entry_price=item.entry_price,
        added_at=item.created_at,
        alerts=[AlertOut.model_validate(a) for a in item.alerts],
        ltp=q["ltp"] if q else None,
        change_pct=q["change_pct"] if q else None,
    )


@router.get("", response_model=Envelope[list[WatchlistItemOut]])
def list_watchlist(user: CurrentUser, db: DbSession) -> Envelope[list[WatchlistItemOut]]:
    items = db.execute(select(WatchlistItem).where(WatchlistItem.user_id == user.id)).scalars().all()
    return envelope([_out(i) for i in items], Meta(**store.meta()))


@router.post("", response_model=WatchlistItemOut, status_code=201)
def add_item(payload: WatchlistItemIn, user: CurrentUser, db: DbSession) -> WatchlistItemOut:
    symbol = payload.symbol.strip().upper()
    q = store.quote(symbol)
    if q is None:
        raise HTTPException(400, f"Unknown symbol {symbol!r} — it didn't trade in the last run.")
    existing = db.execute(
        select(WatchlistItem).where(WatchlistItem.user_id == user.id, WatchlistItem.symbol == symbol)
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(409, f"{symbol} is already on your watchlist.")
    item = WatchlistItem(user_id=user.id, symbol=symbol, name=q["name"], entry_price=payload.entry_price)
    db.add(item)
    db.commit()
    db.refresh(item)
    return _out(item)


def _get_owned_item(item_id: int, user: CurrentUser, db: Session) -> WatchlistItem:
    item = db.get(WatchlistItem, item_id)
    if item is None or item.user_id != user.id:
        raise HTTPException(404, "Watchlist item not found.")
    return item


@router.patch("/{item_id}", response_model=WatchlistItemOut)
def update_item(
    item_id: int, payload: WatchlistItemUpdate, user: CurrentUser, db: DbSession
) -> WatchlistItemOut:
    item = _get_owned_item(item_id, user, db)
    if payload.entry_price is not None:
        item.entry_price = payload.entry_price
    db.commit()
    db.refresh(item)
    return _out(item)


@router.delete("/{item_id}", status_code=204)
def remove_item(item_id: int, user: CurrentUser, db: DbSession) -> None:
    item = _get_owned_item(item_id, user, db)
    db.delete(item)
    db.commit()


@router.post("/{item_id}/alerts", response_model=AlertOut, status_code=201)
def add_alert(item_id: int, payload: AlertIn, user: CurrentUser, db: DbSession) -> AlertOut:
    item = _get_owned_item(item_id, user, db)
    alert = Alert(watchlist_item_id=item.id, kind=payload.kind, threshold=payload.threshold)
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return AlertOut.model_validate(alert)


def _get_owned_alert(alert_id: int, user: CurrentUser, db: Session) -> Alert:
    alert = db.get(Alert, alert_id)
    if alert is None or alert.item.user_id != user.id:
        raise HTTPException(404, "Alert not found.")
    return alert


@router.patch("/alerts/{alert_id}", response_model=AlertOut)
def update_alert(alert_id: int, payload: AlertUpdate, user: CurrentUser, db: DbSession) -> AlertOut:
    alert = _get_owned_alert(alert_id, user, db)
    if payload.threshold is not None:
        alert.threshold = payload.threshold
    if payload.enabled is not None:
        alert.enabled = payload.enabled
        if payload.enabled:
            alert.triggered_at = None
            alert.triggered_price = None
    db.commit()
    db.refresh(alert)
    return AlertOut.model_validate(alert)


@router.delete("/alerts/{alert_id}", status_code=204)
def remove_alert(alert_id: int, user: CurrentUser, db: DbSession) -> None:
    alert = _get_owned_alert(alert_id, user, db)
    db.delete(alert)
    db.commit()
