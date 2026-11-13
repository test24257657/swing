"""
pipeline/run_seed.py
One-time Day-1 Historical Backfill (2Y OHLCV + Fundamentals).

Run this ONCE to bootstrap the system:
  1. Build the clean ~1,700 stock universe
  2. Download 2 years of split-adjusted daily OHLCV via yfinance (bulk)
  3. Upload ohlcv_2y.parquet to GitHub Release (creates the 'latest-data' release)
  4. Upsert all symbols to Neon DB
  5. Run indicators + scoring on the 2yr history
  6. Upsert LatestTechnical rows to Neon DB

Takes approximately 3-5 minutes depending on internet speed.
"""

from __future__ import annotations

import logging
import sys
from datetime import date, timedelta

import polars as pl

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger("pipeline.seed")


def main() -> None:
    log.info("=" * 60)
    log.info("Swing Terminal v2 — Day-1 Historical Seed")
    log.info("This will take 3-5 minutes...")
    log.info("=" * 60)

    today = date.today()

    # ── Step 1: Universe (using today's bhavcopy) ─────────────────────────────
    log.info("[1/7] Building equity universe...")
    from pipeline.sources.universe import build_universe
    universe_df = build_universe(today)
    universe_isins = set(universe_df["isin"].to_list())
    log.info("Universe: %d stocks", len(universe_isins))

    # ── Step 2: Download 2-year OHLCV via yfinance ────────────────────────────
    log.info("[2/7] Downloading 2-year OHLCV history via yfinance (NSE .NS + BSE .BO)...")
    log.info("This may take 2-3 minutes for universe stocks...")
    parquet = _download_2y_ohlcv(universe_df)
    if len(parquet) == 0:
        raise RuntimeError("yfinance download returned 0 rows. Cannot proceed with historical seed.")
    log.info("Downloaded: %d rows for %d stocks", len(parquet), parquet["isin"].n_unique())

    # ── Step 3: Compute indicators ────────────────────────────────────────────
    log.info("[3/7] Computing technical indicators on 2-year history...")
    from pipeline.compute.indicators import compute_all, compute_weinstein_stage
    parquet = compute_all(parquet)
    parquet = compute_weinstein_stage(parquet)

    # ── Step 4: Compute RS percentiles ───────────────────────────────────────
    log.info("[4/7] Computing Relative Strength percentiles...")
    benchmark = _download_benchmark()
    if benchmark is not None:
        from pipeline.compute.indicators import compute_relative_strength
        parquet = compute_relative_strength(parquet, benchmark)

    # ── Step 5: Upload parquet to GitHub Release ──────────────────────────────
    log.info("[5/7] Uploading ohlcv_2y.parquet to GitHub Release...")
    from pipeline.storage import save_parquet
    ok = save_parquet(parquet)
    log.info("Parquet upload: %s", "OK" if ok else "FAILED (saved locally)")

    # ── Step 6: Upsert symbols to Neon DB ─────────────────────────────────────
    log.info("[6/7] Upserting %d symbols to Neon DB...", len(universe_df))
    from pipeline import db
    db.upsert_symbols(universe_df)

    # ── Step 7: Upsert LatestTechnical ───────────────────────────────────────
    log.info("[7/7] Upserting LatestTechnical snapshot...")
    from pipeline.compute.scorer import score_all
    today_tech = parquet.sort("date").group_by("isin").last()
    scored_df = score_all(
        technical_df=today_tech,
        fundamental_df=pl.DataFrame(),
        pattern_df=pl.DataFrame(),
        institutional_df=pl.DataFrame(),
    )
    db.upsert_latest_technical(parquet, scored_df)

    log.info("=" * 60)
    log.info("Seed complete! Run `python run_nightly.py` for daily updates.")
    log.info("=" * 60)


def _download_2y_ohlcv(universe_df: pl.DataFrame) -> pl.DataFrame:
    """
    Download 2 years of daily OHLCV for NSE (.NS) and BSE-only (.BO) stocks.
    Builds ticker_map keyed by yfinance ticker for fast lookup of isin/symbol/exchange.
    """
    try:
        import yfinance as yf  # type: ignore
        import pandas as pd

        rows = universe_df.to_dicts()

        # Build unified ticker_map: yf_ticker → {isin, symbol, exchange}
        ticker_map: dict[str, dict] = {}
        for r in rows:
            isin = r.get("isin", "")
            if not isin:
                continue
            if r.get("exchange") == "NSE" and r.get("nse_symbol"):
                sym = r["nse_symbol"]
                ticker_map[f"{sym}.NS"] = {"isin": isin, "symbol": sym, "exchange": "NSE"}
            elif r.get("exchange") == "BSE" and r.get("bse_code"):
                bse = r["bse_code"]
                ticker_map[f"{bse}.BO"] = {"isin": isin, "symbol": bse, "exchange": "BSE"}

        all_tickers = list(ticker_map.keys())
        log.info("Downloading %d tickers (NSE .NS + BSE .BO) from yfinance...", len(all_tickers))

        # Download in batches of 200
        all_dfs = []
        batch_size = 200

        for i in range(0, len(all_tickers), batch_size):
            batch = all_tickers[i:i + batch_size]
            log.info(
                "  Batch %d/%d (%d tickers)...",
                i // batch_size + 1,
                (len(all_tickers) + batch_size - 1) // batch_size,
                len(batch),
            )
            try:
                data = yf.download(
                    batch,
                    period="2y",
                    interval="1d",
                    group_by="ticker",
                    auto_adjust=True,
                    progress=False,
                    threads=True,
                )

                if data.empty:
                    continue

                for yf_ticker in batch:
                    meta = ticker_map.get(yf_ticker)
                    if not meta:
                        continue
                    try:
                        if isinstance(data.columns, pd.MultiIndex):
                            # yfinance ≥ 0.2 uses (field, ticker) ordering
                            lvl0 = data.columns.get_level_values(0)
                            lvl1 = data.columns.get_level_values(1)
                            if yf_ticker in lvl1:
                                sym_data = data.xs(yf_ticker, level=1, axis=1).copy()
                            elif yf_ticker in lvl0:
                                sym_data = data[yf_ticker].copy()
                            else:
                                continue
                        else:
                            sym_data = data.copy()

                        if sym_data.empty:
                            continue
                        sym_data = sym_data.dropna(subset=["Close"])
                        if sym_data.empty:
                            continue

                        sym_data.index = pd.to_datetime(sym_data.index).date
                        sym_data = sym_data.reset_index().rename(columns={
                            "index": "date", "Date": "date",
                            "Open": "open", "High": "high", "Low": "low",
                            "Close": "close", "Volume": "volume",
                        })
                        req = ["date", "open", "high", "low", "close", "volume"]
                        if not all(c in sym_data.columns for c in req):
                            continue

                        df = pl.from_pandas(sym_data[req])
                        df = df.with_columns([
                            pl.col("open").cast(pl.Float64, strict=False),
                            pl.col("high").cast(pl.Float64, strict=False),
                            pl.col("low").cast(pl.Float64, strict=False),
                            pl.col("close").cast(pl.Float64, strict=False),
                            pl.col("volume").cast(pl.Float64, strict=False),
                            pl.lit(meta["isin"]).alias("isin"),
                            pl.lit(meta["symbol"]).alias("symbol"),
                            pl.lit(meta["exchange"]).alias("exchange"),
                            pl.lit(0.0).alias("delivery_pct"),
                            pl.lit(0.0).alias("turnover_lakh"),
                            pl.lit(1.0).alias("adj_factor"),
                        ])
                        all_dfs.append(df)
                    except Exception:
                        pass

            except Exception as exc:
                log.warning("Batch download failed: %s", exc)

        if not all_dfs:
            log.error("yfinance download returned no data")
            return pl.DataFrame()

        result = pl.concat(all_dfs, how="diagonal")
        if result["date"].dtype != pl.Date:
            result = result.with_columns([pl.col("date").cast(pl.Date)])

        log.info(
            "Downloaded %d rows for %d tickers (%d unique ISINs)",
            len(result),
            result["symbol"].n_unique(),
            result["isin"].n_unique(),
        )
        return result.sort(["isin", "date"])

    except ImportError:
        log.error("yfinance not installed. Run: pip install yfinance")
        sys.exit(1)
    except Exception as exc:
        log.error("2Y OHLCV download failed: %s", exc)
        return pl.DataFrame()


def _download_benchmark() -> pl.DataFrame | None:
    """Download Nifty 500 close history for RS computation."""
    try:
        import yfinance as yf  # type: ignore
        import pandas as pd
        hist = yf.Ticker("^CRSLDX").history(period="2y")
        if hist.empty:
            hist = yf.Ticker("^NSEI").history(period="2y")
        if hist.empty:
            return None
        hist.index = pd.to_datetime(hist.index).date
        hist_df = hist.reset_index()
        date_col = "Date" if "Date" in hist_df.columns else "index"
        hist_df = hist_df.rename(columns={date_col: "date", "Close": "close"})
        df = pl.from_pandas(hist_df[["date", "close"]])
        return df
    except Exception as exc:
        log.warning("Benchmark download failed: %s", exc)
        return None


if __name__ == "__main__":
    main()
