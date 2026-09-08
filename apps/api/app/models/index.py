from __future__ import annotations

from datetime import date

from sqlalchemy import BigInteger, Date, ForeignKey, Index, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class MarketIndex(Base, TimestampMixin):
    """An NSE index we track (broad / sectoral / thematic / strategy).

    Sector relative-strength reads the matching sectoral index's closes, so every
    ``Sector.nse_index_symbol`` should have a row here.
    """

    __tablename__ = "indices"

    id: Mapped[int] = mapped_column(primary_key=True)
    symbol: Mapped[str] = mapped_column(String(60), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    # broad | sectoral | thematic | strategy
    category: Mapped[str] = mapped_column(String(16), default="sectoral", nullable=False)

    bars: Mapped[list[IndexBar]] = relationship(back_populates="index")


class IndexBar(Base):
    """EOD value for an index. Mirrors ``daily_bars`` but for indices."""

    __tablename__ = "index_bars"
    __table_args__ = (Index("ix_index_bars_date", "date"),)

    index_id: Mapped[int] = mapped_column(ForeignKey("indices.id"), primary_key=True)
    date: Mapped[date] = mapped_column(Date, primary_key=True)

    open: Mapped[float | None] = mapped_column(Numeric(16, 4))
    high: Mapped[float | None] = mapped_column(Numeric(16, 4))
    low: Mapped[float | None] = mapped_column(Numeric(16, 4))
    close: Mapped[float] = mapped_column(Numeric(16, 4), nullable=False)
    volume: Mapped[int | None] = mapped_column(BigInteger)

    source: Mapped[str] = mapped_column(String(40), default="nse_index", nullable=False)

    index: Mapped[MarketIndex] = relationship(back_populates="bars")
