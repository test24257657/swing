from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Fundamental(Base):
    """Quarterly / annual financials. Phase 1 populates just enough for the composite
    score's earnings-trend leg (revenue, net profit, EPS) from yfinance.

    yfinance lags NSE by a day or two after results and is US-centric — treat it as
    secondary. ``filing_verified`` is set later when a value is reconciled against the
    official NSE filing (Phase 8).
    """

    __tablename__ = "fundamentals"

    symbol_id: Mapped[int] = mapped_column(ForeignKey("symbols.id"), primary_key=True)
    period_end: Mapped[date] = mapped_column(Date, primary_key=True)
    # quarterly | annual | ttm
    period_type: Mapped[str] = mapped_column(String(10), primary_key=True, default="quarterly")

    revenue: Mapped[float | None] = mapped_column(Numeric(20, 2))
    ebitda: Mapped[float | None] = mapped_column(Numeric(20, 2))
    net_profit: Mapped[float | None] = mapped_column(Numeric(20, 2))
    eps: Mapped[float | None] = mapped_column(Numeric(12, 4))

    pe: Mapped[float | None] = mapped_column(Numeric(12, 2))
    pb: Mapped[float | None] = mapped_column(Numeric(12, 2))
    roe: Mapped[float | None] = mapped_column(Numeric(8, 2))
    debt_equity: Mapped[float | None] = mapped_column(Numeric(8, 2))

    source: Mapped[str] = mapped_column(String(20), default="yfinance", nullable=False)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    is_estimated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    filing_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
