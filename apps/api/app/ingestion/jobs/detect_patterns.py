from __future__ import annotations

import logging
from datetime import date

import pandas as pd
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.ingestion.calendar import last_trading_day
from app.ingestion.run_context import ingestion_run
from app.models import DailyBar, DailyIndicator, PatternSignal, Symbol
from app.models.pattern_signal import DETECTOR_VERSION
from app.patterns.base import DetectContext
from app.patterns.detect import detect_all

log = logging.getLogger("swing.detect.patterns")

JOB = "detect_patterns"

_UPSERT = (
    "stage",
    "direction",
    "timeframe",
    "confidence",
    "pivot_price",
    "stop_suggestion",
    "target_suggestion",
    "base_start_date",
    "base_weeks",
    "breakout_date",
    "breakout_volume_ratio",
    "meta",
    "detector_version",
)


def _bars(db: Session, symbol_id: int, limit: int = 320) -> pd.DataFrame:
    rows = db.execute(
        select(
            DailyBar.date, DailyBar.high, DailyBar.low, DailyBar.close, DailyBar.volume, DailyBar.adj_factor
        )
        .where(DailyBar.symbol_id == symbol_id)
        .order_by(DailyBar.date.desc())
        .limit(limit)
    ).all()
    if not rows:
        return pd.DataFrame()
    df = pd.DataFrame(rows, columns=["date", "high", "low", "close", "volume", "adj"])
    df["date"] = pd.to_datetime(df["date"])
    for c in ("high", "low", "close", "volume", "adj"):
        df[c] = pd.to_numeric(df[c], errors="coerce")
    df["adj"] = df["adj"].fillna(1.0)
    df = df.set_index("date").sort_index()
    # adjust OHLC for corporate actions before detection
    for c in ("high", "low", "close"):
        df[c] = df[c] * df["adj"]
    return df[["high", "low", "close", "volume"]]


def run(business_date: date | None = None) -> None:
    end = business_date or last_trading_day()
    db = SessionLocal()
    try:
        with ingestion_run(db, JOB, end) as run_row:
            ind = {
                sid: (v20, atr)
                for sid, v20, atr in db.execute(
                    select(DailyIndicator.symbol_id, DailyIndicator.vol_sma_20, DailyIndicator.atr_14).where(
                        DailyIndicator.date == end
                    )
                ).all()
            }
            symbols = db.execute(
                select(Symbol.id, Symbol.listing_date).where(Symbol.is_active.is_(True))
            ).all()

            written, matched_symbols, by_code, by_stage = 0, 0, {}, {}
            for sid, listing in symbols:
                df = _bars(db, sid)
                if df.empty or df.index[-1].date() != end:
                    continue
                v20, atr = ind.get(sid, (None, None))
                ctx = DetectContext(
                    listing_date=listing,
                    vol_sma_20=float(v20) if v20 is not None else None,
                    high_52w=None,
                    atr_14=float(atr) if atr is not None else None,
                )
                matches = detect_all(df, ctx)
                if not matches:
                    continue
                matched_symbols += 1
                payload = [
                    {
                        "symbol_id": sid,
                        "date": end,
                        "pattern_code": m.pattern_code,
                        "stage": m.stage,
                        "direction": "long",
                        "timeframe": "daily",
                        "confidence": m.confidence,
                        "pivot_price": m.pivot_price,
                        "stop_suggestion": m.stop_suggestion,
                        "target_suggestion": m.target_suggestion,
                        "base_start_date": m.base_start_date,
                        "base_weeks": m.base_weeks,
                        "breakout_date": m.breakout_date,
                        "breakout_volume_ratio": m.breakout_volume_ratio,
                        "meta": m.meta,
                        "detector_version": DETECTOR_VERSION,
                    }
                    for m in matches
                ]
                stmt = pg_insert(PatternSignal).values(payload)
                stmt = stmt.on_conflict_do_update(
                    index_elements=["symbol_id", "date", "pattern_code"],
                    set_={c: stmt.excluded[c] for c in _UPSERT},
                )
                db.execute(stmt)
                db.commit()
                written += len(payload)
                for m in matches:
                    by_code[m.pattern_code] = by_code.get(m.pattern_code, 0) + 1
                    by_stage[m.stage] = by_stage.get(m.stage, 0) + 1

            run_row.rows_written = written
            run_row.source_stats = {
                "symbols_with_bars_today": sum(1 for _ in symbols),
                "symbols_matched": matched_symbols,
                "by_pattern": by_code,
                "by_stage": by_stage,
                "detector_version": DETECTOR_VERSION,
            }
            run_row.status = "success"
        log.info("patterns: %s signals across %s symbols for %s", written, matched_symbols, end)
    finally:
        db.close()


if __name__ == "__main__":
    logging.basicConfig(level="INFO")
    run()
