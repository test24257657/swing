from __future__ import annotations

from datetime import date

from sqlalchemy import Boolean, Date, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class Symbol(Base, TimestampMixin):
    """The symbol master. One row per NSE-listed equity.

    ``delisting_date`` is populated when a symbol leaves the exchange — it is mandatory for
    survivorship-bias-free backtests later, so we never hard-delete rows.
    """

    __tablename__ = "symbols"
    __table_args__ = (
        Index("ix_symbols_sector_active", "sector_id", "is_active"),
        Index("ix_symbols_is_fno", "is_fno"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    nse_symbol: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    isin: Mapped[str | None] = mapped_column(String(12), index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    series: Mapped[str] = mapped_column(String(4), default="EQ", nullable=False)

    sector_id: Mapped[int | None] = mapped_column(ForeignKey("sectors.id"))
    industry: Mapped[str | None] = mapped_column(String(120))

    listing_date: Mapped[date | None] = mapped_column(Date)
    delisting_date: Mapped[date | None] = mapped_column(Date)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    is_fno: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    lot_size: Mapped[int | None] = mapped_column(Integer)
    # nifty50 | next50 | midcap150 | smallcap250 | micro | none
    mcap_category: Mapped[str | None] = mapped_column(String(16))

    sector: Mapped["Sector | None"] = relationship(back_populates="symbols")  # noqa: F821
    bars: Mapped[list["DailyBar"]] = relationship(back_populates="symbol")  # noqa: F821
