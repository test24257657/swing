from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, DateTime, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SavedScreen(Base):
    """A named screener filter set. Single-user for now (``user_id`` defaults to a
    placeholder); becomes a real FK when auth lands.
    """

    __tablename__ = "saved_screens"
    __table_args__ = (Index("ix_saved_screens_user", "user_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), default="local", nullable=False)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    # the screener query params, as sent to GET /screener
    filters: Mapped[dict] = mapped_column(JSON, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
