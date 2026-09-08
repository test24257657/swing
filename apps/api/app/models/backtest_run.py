from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import JSON, Date, DateTime, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class BacktestRun(Base):
    """One recorded run of the score backtest. The brief's rule: the composite score does
    not ship as anything more than a sort key until a run here shows it beats the
    benchmark net of costs over a meaningful window.
    """

    __tablename__ = "backtest_runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    score_version: Mapped[int] = mapped_column(nullable=False)
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    benchmark: Mapped[str] = mapped_column(String(40), default="NIFTY 500", nullable=False)
    config: Mapped[dict] = mapped_column(JSON, nullable=False)

    strategy_cagr: Mapped[float | None] = mapped_column(Numeric(8, 2))
    benchmark_cagr: Mapped[float | None] = mapped_column(Numeric(8, 2))
    excess_cagr: Mapped[float | None] = mapped_column(Numeric(8, 2))
    max_drawdown: Mapped[float | None] = mapped_column(Numeric(8, 2))
    sharpe: Mapped[float | None] = mapped_column(Numeric(8, 3))
    hit_rate: Mapped[float | None] = mapped_column(Numeric(6, 2))
    beats_benchmark: Mapped[bool | None] = mapped_column()

    equity_curve: Mapped[dict | None] = mapped_column(JSON)
