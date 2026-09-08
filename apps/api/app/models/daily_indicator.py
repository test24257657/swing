from __future__ import annotations

from datetime import date

from sqlalchemy import Boolean, Date, ForeignKey, Index, Numeric, SmallInteger, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

INDICATOR_SET_VERSION = 1


class DailyIndicator(Base):
    """Precomputed technical indicators, one row per symbol per trading day.

    Kept separate from ``daily_bars`` so a full recompute never rewrites the immutable
    price data, and so a bad indicator deploy is rolled back by recomputing this table
    alone. Wide (not key/value) because the screener filters on many columns at once.
    Computed on the **adjusted** close (``close * adj_factor``).

    ``indicator_set_version`` records which definition produced the row, so a partial
    recompute is detectable.
    """

    __tablename__ = "daily_indicators"
    __table_args__ = (
        Index("ix_daily_indicators_date", "date"),
        Index("ix_daily_indicators_date_rsi", "date", "rsi_14"),
        Index("ix_daily_indicators_date_relvol", "date", "rel_volume"),
        Index("ix_daily_indicators_date_dist52wh", "date", "dist_52w_high_pct"),
    )

    symbol_id: Mapped[int] = mapped_column(ForeignKey("symbols.id"), primary_key=True)
    date: Mapped[date] = mapped_column(Date, primary_key=True)

    # Moving averages
    sma_20: Mapped[float | None] = mapped_column(Numeric(14, 4))
    sma_50: Mapped[float | None] = mapped_column(Numeric(14, 4))
    sma_200: Mapped[float | None] = mapped_column(Numeric(14, 4))
    ema_20: Mapped[float | None] = mapped_column(Numeric(14, 4))
    ema_50: Mapped[float | None] = mapped_column(Numeric(14, 4))
    above_sma_20: Mapped[bool | None] = mapped_column(Boolean)
    above_sma_50: Mapped[bool | None] = mapped_column(Boolean)
    above_sma_200: Mapped[bool | None] = mapped_column(Boolean)

    # Oscillators / volatility (Wilder smoothing)
    rsi_14: Mapped[float | None] = mapped_column(Numeric(6, 2))
    atr_14: Mapped[float | None] = mapped_column(Numeric(14, 4))
    atr_pct: Mapped[float | None] = mapped_column(Numeric(6, 2))

    # Volume
    vol_sma_20: Mapped[float | None] = mapped_column(Numeric(20, 2))
    rel_volume: Mapped[float | None] = mapped_column(Numeric(8, 3))

    # 52-week position
    high_52w: Mapped[float | None] = mapped_column(Numeric(14, 4))
    low_52w: Mapped[float | None] = mapped_column(Numeric(14, 4))
    dist_52w_high_pct: Mapped[float | None] = mapped_column(Numeric(7, 3))
    dist_52w_low_pct: Mapped[float | None] = mapped_column(Numeric(7, 3))

    # Returns (adjusted)
    ret_1d: Mapped[float | None] = mapped_column(Numeric(9, 3))
    ret_5d: Mapped[float | None] = mapped_column(Numeric(9, 3))
    ret_20d: Mapped[float | None] = mapped_column(Numeric(9, 3))
    ret_60d: Mapped[float | None] = mapped_column(Numeric(9, 3))
    ret_120d: Mapped[float | None] = mapped_column(Numeric(9, 3))

    # Relative strength — stock 20d return minus its sector index 20d return
    rs_vs_sector_1m: Mapped[float | None] = mapped_column(Numeric(9, 3))

    # Delivery
    delivery_pct_sma_20: Mapped[float | None] = mapped_column(Numeric(7, 3))
    # rising | flat | falling  (slope of delivery_pct over the last 10 sessions)
    delivery_trend: Mapped[str | None] = mapped_column(String(8))

    indicator_set_version: Mapped[int] = mapped_column(
        SmallInteger, default=INDICATOR_SET_VERSION, nullable=False
    )
