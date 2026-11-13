"""
pipeline/run_weekly.py
Master Sunday 10:00 AM IST orchestrator — Weekly Fundamentals Sync.

Steps:
  1. Load universe symbols from Neon DB
  2. Scrape quarterly financials (EPS, Sales QoQ/YoY, ROCE, FII/DII) from Screener.in
  3. Compute fundamental scores (0-40, Pillar C)
  4. Upsert Fundamental rows to Neon DB
"""

from __future__ import annotations

import logging
import sys
from datetime import date
from zoneinfo import ZoneInfo

import polars as pl

from pipeline.config import IST_TZ
from pipeline.sources.screener import fetch_fundamentals
from pipeline import db

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    stream=sys.stdout,
)
log = logging.getLogger("pipeline.weekly")
IST = ZoneInfo(IST_TZ)


def main() -> None:
    log.info("=" * 60)
    log.info("Swing Terminal v2 — Weekly Fundamentals Sync (Sunday 10:00 AM IST)")
    log.info("=" * 60)

    # 1. Fetch all active symbols from DB
    try:
        symbols_df = db.get_active_symbols()
        symbols = symbols_df["symbol"].to_list() if not symbols_df.is_empty() else []
    except Exception as exc:
        log.warning("Could not read symbols from DB (%s); building from universe...", exc)
        from pipeline.sources.universe import build_universe
        uni = build_universe(date.today())
        symbols = [r["symbol"] for r in uni.to_dicts() if r.get("symbol")]

    if not symbols:
        log.warning("No symbols found to update fundamentals.")
        return

    log.info("Starting Screener.in fetch for %d symbols...", len(symbols))
    fund_df = fetch_fundamentals(symbols)

    if fund_df.is_empty():
        log.warning("No fundamental records returned from Screener.in.")
        return

    log.info("Fetched %d fundamental records. Computing Pillar C scores...", len(fund_df))
    from pipeline.compute.scorer import score_pillar_c
    scores = []
    for r in fund_df.to_dicts():
        c_res = score_pillar_c(r, {})
        scores.append(int(c_res.get("total", 0)))

    fund_df = fund_df.with_columns([
        pl.Series("fundamental_score", scores, dtype=pl.Int32),
    ])

    log.info("Upserting fundamentals to Neon DB...")
    try:
        count = db.upsert_fundamentals(fund_df)
        log.info("Weekly Fundamentals sync complete! Updated %d stocks.", count)
    except Exception as exc:
        log.error("Failed to upsert fundamentals to DB: %s", exc)


if __name__ == "__main__":
    main()
