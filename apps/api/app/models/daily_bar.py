from __future__ import annotations

from datetime import date

from sqlalchemy import BigInteger, Date, ForeignKey, Index, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class DailyBar(Base):
    """One EOD OHLCV row per symbol per trading day, straight from the NSE bhavcopy.

    Delivery data comes from the same bhavcopy so it lives here, not in a separate table.

    Prices are stored **raw, as delivered** and never overwritten. ``adj_factor`` is the
    cumulative corporate-action factor (maintained from a corp_actions table in a later
    phase); adjusted close = ``close * adj_factor``. Indicators are computed on the
    adjusted series.

    ``NUMERIC`` not float — a correctness requirement rules out binary-float rounding.

    Query shapes this table must serve fast:
      * one symbol, a date range  → PK (symbol_id, date)
      * all symbols on one date   → ix_daily_bars_date
    When row counts warrant it (~5M+), convert to declarative RANGE partitioning by year;
    the composite PK and the date index carry over unchanged.
    """

    __tablename__ = "daily_bars"
    __table_args__ = (
        Index("ix_daily_bars_date", "date"),
        Index("ix_daily_bars_date_delivery", "date", "delivery_pct"),
    )

    symbol_id: Mapped[int] = mapped_column(ForeignKey("symbols.id"), primary_key=True)
    date: Mapped[date] = mapped_column(Date, primary_key=True)

    open: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False)
    high: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False)
    low: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False)
    close: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False)
    prev_close: Mapped[float | None] = mapped_column(Numeric(14, 4))
    vwap: Mapped[float | None] = mapped_column(Numeric(14, 4))

    volume: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    trades: Mapped[int | None] = mapped_column(Integer)
    turnover: Mapped[float | None] = mapped_column(Numeric(20, 2))

    delivery_qty: Mapped[int | None] = mapped_column(BigInteger)
    delivery_pct: Mapped[float | None] = mapped_column(Numeric(7, 3))

    series: Mapped[str] = mapped_column(String(4), default="EQ", nullable=False)
    adj_factor: Mapped[float] = mapped_column(Numeric(20, 10), default=1, nullable=False)

    source: Mapped[str] = mapped_column(String(40), default="nse_bhavcopy", nullable=False)

    symbol: Mapped["Symbol"] = relationship(back_populates="bars")  # noqa: F821
