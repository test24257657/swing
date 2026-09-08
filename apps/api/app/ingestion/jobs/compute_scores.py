from __future__ import annotations

import logging
from datetime import date

import numpy as np
import pandas as pd
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.ingestion.calendar import last_trading_day
from app.ingestion.run_context import ingestion_run
from app.models import DailyIndicator, Fundamental, ScreenerScore, Symbol
from app.scoring.composite import score_cross_section

log = logging.getLogger("swing.compute.scores")

JOB = "compute_scores"

_UPSERT = (
    "momentum_score",
    "delivery_quality_score",
    "relative_strength_score",
    "earnings_trend_score",
    "composite_score",
    "verdict",
    "inputs_present",
    "rank_overall",
    "rank_in_sector",
    "weights",
    "score_version",
)


def _net_profit_qoq(db: Session) -> pd.Series:
    """Mean QoQ net-profit growth % over the last up-to-4 quarters, per symbol_id."""
    rows = db.execute(
        select(Fundamental.symbol_id, Fundamental.period_end, Fundamental.net_profit)
        .where(Fundamental.period_type == "quarterly", Fundamental.net_profit.isnot(None))
        .order_by(Fundamental.symbol_id, Fundamental.period_end)
    ).all()
    if not rows:
        return pd.Series(dtype=float)
    df = pd.DataFrame(rows, columns=["symbol_id", "period_end", "net_profit"])
    df["net_profit"] = pd.to_numeric(df["net_profit"], errors="coerce")

    def _mean_qoq(g: pd.DataFrame) -> float:
        v = g["net_profit"].tail(5).to_numpy(dtype=float)
        if len(v) < 2:
            return np.nan
        prev, cur = v[:-1], v[1:]
        with np.errstate(divide="ignore", invalid="ignore"):
            growth = np.where(np.abs(prev) > 1e-6, (cur - prev) / np.abs(prev) * 100.0, np.nan)
        return float(np.nanmean(growth)) if np.isfinite(growth).any() else np.nan

    return df.groupby("symbol_id").apply(_mean_qoq, include_groups=False)


def run(business_date: date | None = None) -> None:
    end = business_date or last_trading_day()
    db = SessionLocal()
    try:
        with ingestion_run(db, JOB, end) as run_row:
            ind_rows = db.execute(
                select(
                    DailyIndicator.symbol_id,
                    DailyIndicator.ret_20d,
                    DailyIndicator.ret_60d,
                    DailyIndicator.ret_120d,
                    DailyIndicator.rsi_14,
                    DailyIndicator.rel_volume,
                    DailyIndicator.above_sma_20,
                    DailyIndicator.above_sma_50,
                    DailyIndicator.above_sma_200,
                    DailyIndicator.delivery_pct_sma_20,
                    DailyIndicator.delivery_trend,
                    DailyIndicator.rs_vs_sector_1m,
                ).where(DailyIndicator.date == end)
            ).all()
            if not ind_rows:
                run_row.status = "partial"
                run_row.source_stats = {"note": f"no indicators for {end}"}
                return

            df = pd.DataFrame(ind_rows).set_index("symbol_id")
            for c in df.columns:
                if c not in ("delivery_trend",):
                    df[c] = pd.to_numeric(df[c], errors="coerce")

            qoq = _net_profit_qoq(db)
            df["net_profit_qoq"] = qoq.reindex(df.index)

            scores = score_cross_section(df)
            if scores.empty:
                run_row.status = "partial"
                return

            sector_of = dict(
                db.execute(select(Symbol.id, Symbol.sector_id).where(Symbol.sector_id.isnot(None))).all()
            )
            scores["rank_overall"] = scores["composite_score"].rank(ascending=False, method="min").astype(int)
            scores["_sector"] = scores.index.map(sector_of)
            scores["rank_in_sector"] = scores.groupby("_sector")["composite_score"].rank(
                ascending=False, method="min"
            )

            payload = []
            for sid, r in scores.iterrows():
                payload.append(
                    {
                        "symbol_id": int(sid),
                        "date": end,
                        "momentum_score": _n(r["momentum_score"]),
                        "delivery_quality_score": _n(r["delivery_quality_score"]),
                        "relative_strength_score": _n(r["relative_strength_score"]),
                        "earnings_trend_score": _n(r["earnings_trend_score"]),
                        "composite_score": float(r["composite_score"]),
                        "verdict": r["verdict"],
                        "inputs_present": int(r["inputs_present"]),
                        "rank_overall": int(r["rank_overall"]),
                        "rank_in_sector": _int(r["rank_in_sector"]),
                        "weights": r["weights"],
                        "score_version": int(r["score_version"]),
                    }
                )

            stmt = pg_insert(ScreenerScore).values(payload)
            stmt = stmt.on_conflict_do_update(
                index_elements=["symbol_id", "date"],
                set_={c: stmt.excluded[c] for c in _UPSERT},
            )
            db.execute(stmt)
            db.commit()

            run_row.rows_written = len(payload)
            run_row.source_stats = {
                "scored": len(payload),
                "with_earnings": int(scores["earnings_trend_score"].notna().sum()),
                "score_version": int(scores["score_version"].iloc[0]),
                "validated": False,
            }
            run_row.status = "success"
        log.info("scores: %s symbols scored for %s", run_row.rows_written, end)
    finally:
        db.close()


def _n(v) -> float | None:
    return None if v is None or (isinstance(v, float) and np.isnan(v)) else round(float(v), 2)


def _int(v) -> int | None:
    return None if v is None or (isinstance(v, float) and np.isnan(v)) else int(v)


def backfill() -> None:
    """Score every historical date that has indicators — needed by the backtest harness.
    Run after `compute_indicators` with FULL=1."""
    db = SessionLocal()
    try:
        dates = [
            d
            for (d,) in db.execute(select(DailyIndicator.date).distinct().order_by(DailyIndicator.date)).all()
        ]
    finally:
        db.close()
    log.info("backfilling scores for %s dates", len(dates))
    for d in dates:
        run(business_date=d)


if __name__ == "__main__":
    import os

    logging.basicConfig(level="INFO")
    backfill() if os.environ.get("BACKFILL") == "1" else run()
