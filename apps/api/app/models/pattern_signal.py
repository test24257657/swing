from __future__ import annotations

from datetime import date

from sqlalchemy import JSON, Date, ForeignKey, Index, Numeric, SmallInteger, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

DETECTOR_VERSION = 1

PATTERN_CODES = ("vcp", "ipo_base", "high_52w_breakout", "near_pivot")
STAGES = ("forming", "confirmed", "extended")


class PatternSignal(Base):
    """A setup pattern a symbol matches on a given trading day.

    One row per (symbol, date, pattern). Recomputed nightly for the latest date; a symbol
    that no longer matches simply gets no new row (the screener reads the latest date).

    ``detector_version`` pins which detector logic produced the signal — when a detector
    is retuned, historical signals stay attributable and the backtest can pin a version.
    A mislabelled pattern is worse than a missing one, so ``confidence`` is conservative
    and the UI can gate low-confidence matches.
    """

    __tablename__ = "pattern_signals"
    __table_args__ = (
        Index("ix_pattern_signals_date_code", "date", "pattern_code"),
        Index("ix_pattern_signals_date_code_stage", "date", "pattern_code", "stage"),
    )

    symbol_id: Mapped[int] = mapped_column(ForeignKey("symbols.id"), primary_key=True)
    date: Mapped[date] = mapped_column(Date, primary_key=True)
    pattern_code: Mapped[str] = mapped_column(String(24), primary_key=True)

    # forming | confirmed | extended
    stage: Mapped[str] = mapped_column(String(10), nullable=False)
    direction: Mapped[str] = mapped_column(String(5), default="long", nullable=False)
    timeframe: Mapped[str] = mapped_column(String(8), default="daily", nullable=False)
    confidence: Mapped[float] = mapped_column(Numeric(5, 4), nullable=False)

    pivot_price: Mapped[float | None] = mapped_column(Numeric(14, 4))
    stop_suggestion: Mapped[float | None] = mapped_column(Numeric(14, 4))
    target_suggestion: Mapped[float | None] = mapped_column(Numeric(14, 4))

    base_start_date: Mapped[date | None] = mapped_column(Date)
    base_weeks: Mapped[float | None] = mapped_column(Numeric(6, 2))
    breakout_date: Mapped[date | None] = mapped_column(Date)
    breakout_volume_ratio: Mapped[float | None] = mapped_column(Numeric(8, 3))

    # pattern-specific detail (VCP contractions, IPO listing date, etc.)
    meta: Mapped[dict | None] = mapped_column(JSON)
    detector_version: Mapped[int] = mapped_column(SmallInteger, default=DETECTOR_VERSION, nullable=False)
