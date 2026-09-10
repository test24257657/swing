from __future__ import annotations

from datetime import date

from sqlalchemy import Boolean, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class WatchlistItem(Base, TimestampMixin):
    """One symbol a user is tracking. ``entry_price`` is optional — set it to see
    unrealised P/L, leave it blank to just watch the symbol."""

    __tablename__ = "watchlist_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    symbol: Mapped[str] = mapped_column(String(32), nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    entry_price: Mapped[float | None] = mapped_column(Float)

    alerts: Mapped[list[Alert]] = relationship(
        back_populates="item", cascade="all, delete-orphan", order_by="Alert.id"
    )


class Alert(Base, TimestampMixin):
    """A price level on one watchlist item. Evaluated once nightly against that
    session's high/low (``jobs/alerts.py``) — there is no live intraday feed, so
    "triggered" means "crossed at some point during today's session," not real-time.
    Auto-disables once triggered so it doesn't refire every night."""

    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(primary_key=True)
    watchlist_item_id: Mapped[int] = mapped_column(
        ForeignKey("watchlist_items.id", ondelete="CASCADE"), nullable=False, index=True
    )
    kind: Mapped[str] = mapped_column(String(16), nullable=False)  # "price_above" | "price_below"
    threshold: Mapped[float] = mapped_column(Float, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    triggered_at: Mapped[date | None] = mapped_column()
    triggered_price: Mapped[float | None] = mapped_column(Float)

    item: Mapped[WatchlistItem] = relationship(back_populates="alerts")
