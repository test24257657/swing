from __future__ import annotations

from datetime import date

from pydantic import BaseModel, ConfigDict


class SectorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    nse_index_symbol: str | None = None


class SymbolOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nse_symbol: str
    name: str
    isin: str | None = None
    series: str
    industry: str | None = None
    is_active: bool
    is_fno: bool
    lot_size: int | None = None
    mcap_category: str | None = None
    listing_date: date | None = None
    sector: SectorOut | None = None
