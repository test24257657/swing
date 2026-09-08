from __future__ import annotations

from datetime import date

from sqlalchemy import JSON, Date, ForeignKey, Index, Integer, Numeric, SmallInteger, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

SCORE_VERSION = 1

# Composite weights — from the design's Stock Detail tooltip.
WEIGHTS = {
    "momentum": 0.35,
    "delivery_quality": 0.25,
    "relative_strength": 0.20,
    "earnings_trend": 0.20,
}


class ScreenerScore(Base):
    """Precomputed composite score, one row per symbol per trading day.

    Daily retention is deliberate — the watchlist shows "score since added", and the
    backtest harness reads the score history to check it beats the index. Every row must
    be reproducible from data available at that date's EOD only (no look-ahead).
    """

    __tablename__ = "screener_scores"
    __table_args__ = (
        Index("ix_screener_scores_date_composite", "date", "composite_score"),
        Index("ix_screener_scores_date_rank", "date", "rank_overall"),
    )

    symbol_id: Mapped[int] = mapped_column(ForeignKey("symbols.id"), primary_key=True)
    date: Mapped[date] = mapped_column(Date, primary_key=True)

    momentum_score: Mapped[float | None] = mapped_column(Numeric(6, 2))
    delivery_quality_score: Mapped[float | None] = mapped_column(Numeric(6, 2))
    relative_strength_score: Mapped[float | None] = mapped_column(Numeric(6, 2))
    earnings_trend_score: Mapped[float | None] = mapped_column(Numeric(6, 2))

    composite_score: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False)
    # V.Good | Good | Avg | Poor
    verdict: Mapped[str] = mapped_column(String(8), nullable=False)
    # how many of the 4 sub-scores had data (e.g. 3 when fundamentals are missing)
    inputs_present: Mapped[int] = mapped_column(SmallInteger, default=4, nullable=False)

    rank_overall: Mapped[int | None] = mapped_column(Integer)
    rank_in_sector: Mapped[int | None] = mapped_column(Integer)

    weights: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    score_version: Mapped[int] = mapped_column(SmallInteger, default=SCORE_VERSION, nullable=False)
