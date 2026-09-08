from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import JSON, Date, DateTime, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class IngestionRun(Base):
    """One row per ingestion job per business date.

    This is the backbone of the ``meta.stale`` flag on every API response: the API reads
    the latest successful run for a job to know how fresh the data is and where it came
    from. ``source_stats`` records per-source counts and failures so a broken source is
    visible rather than silently dropping rows.
    """

    __tablename__ = "ingestion_runs"
    __table_args__ = (
        Index("ix_ingestion_runs_job_date", "job_name", "business_date"),
        Index("ix_ingestion_runs_job_status_finished", "job_name", "status", "finished_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    job_name: Mapped[str] = mapped_column(String(60), nullable=False)
    business_date: Mapped[date] = mapped_column(Date, nullable=False)

    # running | success | partial | failed
    status: Mapped[str] = mapped_column(String(12), default="running", nullable=False)

    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    rows_written: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    source_stats: Mapped[dict | None] = mapped_column(JSON)
    error_text: Mapped[str | None] = mapped_column(Text)
