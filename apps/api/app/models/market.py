from __future__ import annotations

from datetime import date

from sqlalchemy import Boolean, Date, ForeignKey, Index, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class MarketBreadth(Base):
    """One row per trading day — advance/decline counts and the share of the universe
    above its 50/200-day averages. Computed nightly from daily_bars + daily_indicators."""

    __tablename__ = "market_breadth"

    date: Mapped[date] = mapped_column(Date, primary_key=True)
    advances: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    declines: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    unchanged: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    traded: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    pct_above_50dma: Mapped[float | None] = mapped_column(Numeric(6, 2))
    pct_above_200dma: Mapped[float | None] = mapped_column(Numeric(6, 2))
    new_52w_highs: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    new_52w_lows: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class FiiDiiFlow(Base):
    """FII / DII net activity for a session. ``segment`` = cash | fno_index | fno_stock.
    Values in ₹ crore."""

    __tablename__ = "fii_dii_flows"

    date: Mapped[date] = mapped_column(Date, primary_key=True)
    segment: Mapped[str] = mapped_column(String(12), primary_key=True, default="cash")

    fii_buy: Mapped[float | None] = mapped_column(Numeric(16, 2))
    fii_sell: Mapped[float | None] = mapped_column(Numeric(16, 2))
    fii_net: Mapped[float | None] = mapped_column(Numeric(16, 2))
    dii_buy: Mapped[float | None] = mapped_column(Numeric(16, 2))
    dii_sell: Mapped[float | None] = mapped_column(Numeric(16, 2))
    dii_net: Mapped[float | None] = mapped_column(Numeric(16, 2))


class IndexConstituent(Base):
    """Index membership. ``weight`` is populated when a source provides it (NSE factsheet);
    otherwise NULL and point-contribution falls back to equal-weight in the UI."""

    __tablename__ = "index_constituents"
    __table_args__ = (Index("ix_index_constituents_symbol", "symbol_id"),)

    index_id: Mapped[int] = mapped_column(ForeignKey("indices.id"), primary_key=True)
    symbol_id: Mapped[int] = mapped_column(ForeignKey("symbols.id"), primary_key=True)
    weight: Mapped[float | None] = mapped_column(Numeric(8, 4))
    as_of: Mapped[date | None] = mapped_column(Date)


class HolidayCalendar(Base):
    """NSE trading holidays. ``is_muhurat`` marks the special Diwali evening session."""

    __tablename__ = "holiday_calendar"

    date: Mapped[date] = mapped_column(Date, primary_key=True)
    description: Mapped[str] = mapped_column(String(120), default="", nullable=False)
    segment: Mapped[str] = mapped_column(String(20), default="equities", nullable=False)
    is_muhurat: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
