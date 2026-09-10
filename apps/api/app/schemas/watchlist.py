from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, Field

ALERT_KINDS = ("price_above", "price_below")


class AlertIn(BaseModel):
    kind: str = Field(pattern="^(price_above|price_below)$")
    threshold: float = Field(gt=0)


class AlertUpdate(BaseModel):
    threshold: float | None = Field(default=None, gt=0)
    enabled: bool | None = None


class AlertOut(BaseModel):
    id: int
    kind: str
    threshold: float
    enabled: bool
    triggered_at: date | None
    triggered_price: float | None

    model_config = {"from_attributes": True}


class WatchlistItemIn(BaseModel):
    symbol: str = Field(min_length=1, max_length=32)
    entry_price: float | None = Field(default=None, gt=0)


class WatchlistItemUpdate(BaseModel):
    entry_price: float | None = Field(default=None, gt=0)


class WatchlistItemOut(BaseModel):
    id: int
    symbol: str
    name: str
    entry_price: float | None
    added_at: datetime
    alerts: list[AlertOut]
    # Enriched from the nightly artifact at read time — null if the symbol didn't trade
    # in the last run (delisted, suspended) or the artifact hasn't caught up yet.
    ltp: float | None = None
    change_pct: float | None = None

    model_config = {"from_attributes": True}
