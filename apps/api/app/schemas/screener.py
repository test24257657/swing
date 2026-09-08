from __future__ import annotations

from datetime import date

from pydantic import BaseModel, Field


class ScreenerRow(BaseModel):
    symbol: str
    name: str
    sector: str | None = None
    is_fno: bool = False

    ltp: float | None = None
    change_pct: float | None = None

    composite_score: float | None = None
    verdict: str | None = None
    inputs_present: int | None = None
    rank_overall: int | None = None

    momentum_score: float | None = None
    delivery_quality_score: float | None = None
    relative_strength_score: float | None = None
    earnings_trend_score: float | None = None

    rsi_14: float | None = None
    rs_vs_sector_1m: float | None = None
    dist_52w_high_pct: float | None = None
    delivery_pct_sma_20: float | None = None
    rel_volume: float | None = None
    ret_20d: float | None = None
    above_sma_20: bool | None = None
    above_sma_50: bool | None = None
    above_sma_200: bool | None = None

    # Phase 2 — always empty for now.
    patterns: list[str] = Field(default_factory=list)


class ScreenerFacets(BaseModel):
    sectors: dict[str, int]
    verdicts: dict[str, int]
    patterns: dict[str, int] = Field(default_factory=dict)
    stages: dict[str, int] = Field(default_factory=dict)


class ScreenerResult(BaseModel):
    rows: list[ScreenerRow]
    total: int
    page: int
    per_page: int
    as_of: date | None
    score_validated: bool
    facets: ScreenerFacets
