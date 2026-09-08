from __future__ import annotations

import logging
from datetime import date

import pandas as pd
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.indicators.compute import compute_symbol
from app.ingestion.calendar import last_trading_day
from app.ingestion.run_context import ingestion_run
from app.models import DailyBar, DailyIndicator, IndexBar, MarketIndex, Sector, Symbol

log = logging.getLogger("swing.compute.indicators")

JOB = "compute_indicators"

_UPSERT_COLS = (
    "sma_20",
    "sma_50",
    "sma_200",
    "ema_20",
    "ema_50",
    "above_sma_20",
    "above_sma_50",
    "above_sma_200",
    "rsi_14",
    "atr_14",
    "atr_pct",
    "vol_sma_20",
    "rel_volume",
    "high_52w",
    "low_52w",
    "dist_52w_high_pct",
    "dist_52w_low_pct",
    "ret_1d",
    "ret_5d",
    "ret_20d",
    "ret_60d",
    "ret_120d",
    "rs_vs_sector_1m",
    "delivery_pct_sma_20",
    "delivery_trend",
    "indicator_set_version",
)


def _sector_index_closes(db: Session) -> dict[int, pd.Series]:
    """sector_id -> that sector's index close series (date-indexed)."""
    sec_to_idx = dict(
        db.execute(
            select(Sector.id, MarketIndex.id).join(MarketIndex, MarketIndex.symbol == Sector.nse_index_symbol)
        ).all()
    )
    out: dict[int, pd.Series] = {}
    for sector_id, index_id in sec_to_idx.items():
        rows = db.execute(
            select(IndexBar.date, IndexBar.close).where(IndexBar.index_id == index_id).order_by(IndexBar.date)
        ).all()
        if rows:
            s = pd.Series(
                [float(c) for _, c in rows],
                index=pd.to_datetime([d for d, _ in rows]),
            )
            out[sector_id] = s
    return out


def _bars_for(db: Session, symbol_id: int) -> pd.DataFrame:
    rows = db.execute(
        select(
            DailyBar.date,
            DailyBar.open,
            DailyBar.high,
            DailyBar.low,
            DailyBar.close,
            DailyBar.volume,
            DailyBar.delivery_pct,
            DailyBar.adj_factor,
        )
        .where(DailyBar.symbol_id == symbol_id)
        .order_by(DailyBar.date)
    ).all()
    if not rows:
        return pd.DataFrame()
    df = pd.DataFrame(
        rows, columns=["date", "open", "high", "low", "close", "volume", "delivery_pct", "adj_factor"]
    )
    df["date"] = pd.to_datetime(df["date"])
    for c in ("open", "high", "low", "close", "volume", "delivery_pct", "adj_factor"):
        df[c] = pd.to_numeric(df[c], errors="coerce")
    df["adj_factor"] = df["adj_factor"].fillna(1.0)
    return df.set_index("date")


def run(business_date: date | None = None, full: bool = False) -> None:
    """Compute indicators. Default: only the latest trading day (fast, nightly).
    ``full=True`` recomputes every date in history (use after a backfill)."""
    end = business_date or last_trading_day()
    since = None if full else pd.Timestamp(end)

    db = SessionLocal()
    try:
        with ingestion_run(db, JOB, end) as run_row:
            sector_series = _sector_index_closes(db)
            symbols = db.execute(select(Symbol.id, Symbol.sector_id).where(Symbol.is_active.is_(True))).all()

            written, skipped = 0, 0
            for sid, sector_id in symbols:
                bars = _bars_for(db, sid)
                if bars.empty:
                    skipped += 1
                    continue
                rows = compute_symbol(bars, sector_series.get(sector_id) if sector_id else None, since=since)
                if not rows:
                    continue
                payload = [{"symbol_id": sid, **r} for r in rows]
                stmt = pg_insert(DailyIndicator).values(payload)
                stmt = stmt.on_conflict_do_update(
                    index_elements=["symbol_id", "date"],
                    set_={c: stmt.excluded[c] for c in _UPSERT_COLS},
                )
                db.execute(stmt)
                db.commit()
                written += len(payload)

            run_row.rows_written = written
            run_row.source_stats = {
                "symbols": len(symbols),
                "no_bars": skipped,
                "mode": "full" if full else "latest",
                "sector_indices": len(sector_series),
            }
            run_row.status = "success"
        log.info("indicators: %s rows for %s symbols", run_row.rows_written, len(symbols))
    finally:
        db.close()


if __name__ == "__main__":
    import os

    logging.basicConfig(level="INFO")
    run(full=os.environ.get("FULL") == "1")
