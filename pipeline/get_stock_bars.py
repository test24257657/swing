#!/usr/bin/env python3
"""
pipeline/get_stock_bars.py
Fast script to fetch OHLCV bars for a single symbol.

Data source priority:
  1. Angel One SmartAPI (D / W / M)  ← primary
  2. Local parquet cache (ohlcv_2y.parquet) ← fallback if Angel One fails

Called by Next.js API  /api/stock/[symbol]/bars?tf=D|W|M
Usage:
    python get_stock_bars.py <SYMBOL> [D|W|M]
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _from_parquet(sym: str) -> list[dict]:
    """Fallback: read from cached parquet (daily only)."""
    parquet_file = ROOT / "data" / "ohlcv_2y.parquet"
    if not parquet_file.exists():
        return []
    try:
        import polars as pl
        lazy = pl.scan_parquet(str(parquet_file))
        filtered = lazy.filter(pl.col("symbol") == sym)
        schema = lazy.collect_schema()
        base_cols = [c for c in ["date", "open", "high", "low", "close", "volume"] if c in schema]
        ma_cols = [c for c in ["sma20", "sma50", "sma200", "ema21"] if c in schema]
        df = filtered.select(base_cols + ma_cols).sort("date").collect()
        records = []
        for r in df.to_dicts():
            d = r.get("date")
            if not d:
                continue
            records.append({
                "time":   str(d)[:10],
                "open":   float(r["open"])   if r.get("open")   is not None else None,
                "high":   float(r["high"])   if r.get("high")   is not None else None,
                "low":    float(r["low"])    if r.get("low")    is not None else None,
                "close":  float(r["close"])  if r.get("close")  is not None else None,
                "volume": int(r["volume"])   if r.get("volume") is not None else 0,
                "sma20":  round(float(r["sma20"]),  2) if r.get("sma20")  is not None else None,
                "sma50":  round(float(r["sma50"]),  2) if r.get("sma50")  is not None else None,
                "sma200": round(float(r["sma200"]), 2) if r.get("sma200") is not None else None,
                "ema21":  round(float(r["ema21"]),  2) if r.get("ema21")  is not None else None,
            })
        return records
    except Exception as e:
        sys.stderr.write(f"Parquet fallback error: {e}\n")
        return []


def main():
    if len(sys.argv) < 2:
        print(json.dumps([]))
        return

    sym = sys.argv[1].strip().upper()
    tf  = (sys.argv[2].strip().upper() if len(sys.argv) > 2 else "D")

    # Normalize timeframe
    tf = {"DAILY": "D", "WEEKLY": "W", "MONTHLY": "M"}.get(tf, tf)
    if tf not in ("D", "W", "M"):
        tf = "D"

    bars: list[dict] = []

    # ── Primary: Angel One ────────────────────────────────────────────────────
    try:
        sys.path.insert(0, str(ROOT / "pipeline"))
        from sources.angel_one import fetch_bars_for_symbol  # type: ignore
        # Full historical candles via Angel One API (10 years)
        years = 10
        bars = fetch_bars_for_symbol(sym, interval=tf, years=years)
    except Exception as e:
        sys.stderr.write(f"Angel One fetch failed for {sym} [{tf}]: {e}\n")
        bars = []

    # ── Fallback: parquet (daily only) ────────────────────────────────────────
    if not bars and tf == "D":
        bars = _from_parquet(sym)

    print(json.dumps(bars))


if __name__ == "__main__":
    main()
