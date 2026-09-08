"""initial — symbols, sectors, daily_bars, ingestion_runs

Revision ID: 0001
Revises:
Create Date: 2026-09-07
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "sectors",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("slug", sa.String(80), nullable=False),
        sa.Column("nse_index_symbol", sa.String(40)),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("name", name="uq_sectors_name"),
        sa.UniqueConstraint("slug", name="uq_sectors_slug"),
    )

    op.create_table(
        "symbols",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("nse_symbol", sa.String(30), nullable=False),
        sa.Column("isin", sa.String(12)),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("series", sa.String(4), server_default="EQ", nullable=False),
        sa.Column("sector_id", sa.Integer, sa.ForeignKey("sectors.id")),
        sa.Column("industry", sa.String(120)),
        sa.Column("listing_date", sa.Date),
        sa.Column("delisting_date", sa.Date),
        sa.Column("is_active", sa.Boolean, server_default=sa.true(), nullable=False),
        sa.Column("is_fno", sa.Boolean, server_default=sa.false(), nullable=False),
        sa.Column("lot_size", sa.Integer),
        sa.Column("mcap_category", sa.String(16)),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("nse_symbol", name="uq_symbols_nse_symbol"),
    )
    op.create_index("ix_symbols_isin", "symbols", ["isin"])
    op.create_index("ix_symbols_sector_active", "symbols", ["sector_id", "is_active"])
    op.create_index("ix_symbols_is_fno", "symbols", ["is_fno"])

    op.create_table(
        "daily_bars",
        sa.Column("symbol_id", sa.Integer, sa.ForeignKey("symbols.id"), primary_key=True),
        sa.Column("date", sa.Date, primary_key=True),
        sa.Column("open", sa.Numeric(14, 4), nullable=False),
        sa.Column("high", sa.Numeric(14, 4), nullable=False),
        sa.Column("low", sa.Numeric(14, 4), nullable=False),
        sa.Column("close", sa.Numeric(14, 4), nullable=False),
        sa.Column("prev_close", sa.Numeric(14, 4)),
        sa.Column("vwap", sa.Numeric(14, 4)),
        sa.Column("volume", sa.BigInteger, server_default="0", nullable=False),
        sa.Column("trades", sa.Integer),
        sa.Column("turnover", sa.Numeric(20, 2)),
        sa.Column("delivery_qty", sa.BigInteger),
        sa.Column("delivery_pct", sa.Numeric(7, 3)),
        sa.Column("series", sa.String(4), server_default="EQ", nullable=False),
        sa.Column("adj_factor", sa.Numeric(20, 10), server_default="1", nullable=False),
        sa.Column("source", sa.String(40), server_default="nse_bhavcopy", nullable=False),
    )
    op.create_index("ix_daily_bars_date", "daily_bars", ["date"])
    op.create_index("ix_daily_bars_date_delivery", "daily_bars", ["date", "delivery_pct"])

    op.create_table(
        "ingestion_runs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("job_name", sa.String(60), nullable=False),
        sa.Column("business_date", sa.Date, nullable=False),
        sa.Column("status", sa.String(12), server_default="running", nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True)),
        sa.Column("rows_written", sa.Integer, server_default="0", nullable=False),
        sa.Column("source_stats", sa.JSON),
        sa.Column("error_text", sa.Text),
    )
    op.create_index("ix_ingestion_runs_job_date", "ingestion_runs", ["job_name", "business_date"])
    op.create_index(
        "ix_ingestion_runs_job_status_finished",
        "ingestion_runs",
        ["job_name", "status", "finished_at"],
    )


def downgrade() -> None:
    op.drop_table("ingestion_runs")
    op.drop_table("daily_bars")
    op.drop_index("ix_symbols_is_fno", table_name="symbols")
    op.drop_index("ix_symbols_sector_active", table_name="symbols")
    op.drop_index("ix_symbols_isin", table_name="symbols")
    op.drop_table("symbols")
    op.drop_table("sectors")
