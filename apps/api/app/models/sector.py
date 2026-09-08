from __future__ import annotations

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class Sector(Base, TimestampMixin):
    """NSE sectoral grouping. ``nse_index_symbol`` links to the sector index used for
    relative-strength and rotation calculations (e.g. ``NIFTY AUTO``)."""

    __tablename__ = "sectors"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    nse_index_symbol: Mapped[str | None] = mapped_column(String(40))

    symbols: Mapped[list[Symbol]] = relationship(back_populates="sector")  # noqa: F821
