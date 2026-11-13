"""
pipeline/sources/universe.py
Universe hygiene: builds and maintains the ~1,700 stock universe.

Rules:
1. Source NSE CM (EQ/BE series) + BSE exclusive (A/B group) stocks
2. Dedup by ISIN — if NSE-listed, use NSE symbol; BSE-only gets BSE code
3. Hard filters: exclude ETFs/BeES/Gilt/penny/illiquid
"""

from __future__ import annotations

import logging
from datetime import date
from typing import Optional

import polars as pl

from pipeline.config import (
    EXCLUDE_NAME_KEYWORDS,
    MIN_PRICE,
    MIN_TURNOVER_CR,
    ILLIQUID_LOOKBACK_DAYS,
)
from pipeline.sources.nse_bhavcopy import fetch_bhavcopy as nse_fetch
from pipeline.sources.bse_bhavcopy import fetch_bhavcopy as bse_fetch

log = logging.getLogger("pipeline.sources.universe")


def build_universe(
    trading_date: date,
    existing_parquet: Optional[pl.DataFrame] = None,
) -> pl.DataFrame:
    """
    Build the clean equity universe for a given date.

    Args:
        trading_date: Date to build universe for
        existing_parquet: Historical OHLCV df (2yr) for liquidity filtering

    Returns:
        DataFrame with columns:
            isin, nse_symbol, bse_code, name, exchange
        representing the clean ~1,700 stock universe.
    """
    nse_df = nse_fetch(trading_date, allow_lookback=True)
    bse_df = bse_fetch(trading_date)

    if nse_df is None and bse_df is None:
        log.info("Bhavcopy not published yet for %s; using NSE Master Equity List (EQUITY_L.csv)...", trading_date)
        from pipeline.sources.nse_bhavcopy import fetch_master_equity_list
        nse_df = fetch_master_equity_list()

    if nse_df is None and bse_df is None:
        raise RuntimeError(
            f"Could not load universe from bhavcopy or master list. "
            "Cannot build universe — aborting pipeline."
        )

    # ── Step 1: Build NSE universe ────────────────────────────────────────────
    nse_universe: Optional[pl.DataFrame] = None
    if nse_df is not None:
        name_expr = pl.col("name") if "name" in nse_df.columns else pl.col("symbol").alias("name")
        nse_universe = nse_df.select([
            pl.col("isin"),
            pl.col("symbol").alias("nse_symbol"),
            pl.lit(None).cast(pl.Utf8).alias("bse_code"),
            name_expr,
            pl.lit("NSE").alias("exchange"),
            pl.col("close"),
            pl.col("turnover_lakh"),
        ])

    # ── Step 2: Build BSE universe (BSE-exclusive only) ───────────────────────
    bse_exclusive: Optional[pl.DataFrame] = None
    if bse_df is not None and nse_universe is not None:
        # ISINs already in NSE universe → skip
        nse_isins = set(nse_universe["isin"].to_list())
        bse_exclusive_raw = bse_df.filter(~pl.col("isin").is_in(nse_isins))

        if len(bse_exclusive_raw) > 0:
            bse_exclusive = bse_exclusive_raw.select([
                pl.col("isin"),
                pl.lit(None).cast(pl.Utf8).alias("nse_symbol"),
                pl.col("bse_code"),
                pl.col("name"),
                pl.lit("BSE").alias("exchange"),
                pl.col("close"),
                pl.col("turnover_lakh"),
            ])
    elif bse_df is not None and nse_universe is None:
        # NSE completely failed, use all BSE
        bse_exclusive = bse_df.select([
            pl.col("isin"),
            pl.lit(None).cast(pl.Utf8).alias("nse_symbol"),
            pl.col("bse_code"),
            pl.col("name"),
            pl.lit("BSE").alias("exchange"),
            pl.col("close"),
            pl.col("turnover_lakh"),
        ])

    # ── Step 3: Combine ───────────────────────────────────────────────────────
    parts = [p for p in [nse_universe, bse_exclusive] if p is not None]
    if not parts:
        raise RuntimeError("Universe build failed: no data from any source")

    raw = pl.concat(parts, how="diagonal")
    log.info("Raw combined universe: %d rows", len(raw))

    # ── Step 4: Hard filters ──────────────────────────────────────────────────
    # 4a. ETF/BeES/Gilt keyword filter on name
    filtered = raw
    for kw in EXCLUDE_NAME_KEYWORDS:
        filtered = filtered.filter(
            ~pl.col("name").str.to_uppercase().str.contains(kw)
        )
    log.info("After ETF/keyword filter: %d rows", len(filtered))

    # 4b. Penny stock filter
    filtered = filtered.filter(pl.col("close") >= MIN_PRICE)
    log.info("After price filter (>= ₹%s): %d rows", MIN_PRICE, len(filtered))

    # 4c. Liquidity filter (uses historical turnover from parquet if available)
    if existing_parquet is not None:
        if "turnover_lakh" not in existing_parquet.columns or (existing_parquet["turnover_lakh"].max() or 0) <= 0:
            if "close" in existing_parquet.columns and "volume" in existing_parquet.columns:
                existing_parquet = existing_parquet.with_columns([
                    (pl.col("close") * pl.col("volume") / 1e5).alias("turnover_lakh")
                ])

        median_turnover = (
            existing_parquet
            .sort("date")
            .group_by("isin")
            .tail(ILLIQUID_LOOKBACK_DAYS)
            .group_by("isin")
            .agg(
                pl.col("turnover_lakh").median().alias("median_turnover_lakh")
            )
        )
        filtered = (
            filtered
            .join(median_turnover, on="isin", how="left")
            .filter(
                pl.col("median_turnover_lakh").is_null()  # new stock, include tentatively
                | (pl.col("median_turnover_lakh") >= MIN_TURNOVER_CR * 100)  # lakh → cr
            )
            .drop("median_turnover_lakh")
        )
        log.info("After liquidity filter (>= ₹%s Cr): %d rows", MIN_TURNOVER_CR, len(filtered))
    else:
        # No historical data — use today's turnover
        min_turnover_lakh = MIN_TURNOVER_CR * 100  # 3 Cr = 300 lakh
        filtered = filtered.filter(
            pl.col("turnover_lakh").is_null()
            | (pl.col("turnover_lakh") >= min_turnover_lakh)
        )
        log.info("After today's turnover filter: %d rows", len(filtered))

    # ── Step 5: Attach real sector, industry, and canonical symbol ─────────────
    sector_map = _fetch_sector_mappings()
    sectors = []
    industries = []
    for r in filtered.to_dicts():
        isin = r.get("isin")
        sym = r.get("nse_symbol") or r.get("bse_code")
        info = sector_map.get(isin) or sector_map.get(sym) or {}
        sectors.append(info.get("sector") or "Diversified")
        industries.append(info.get("industry") or "Diversified")

    universe = filtered.with_columns([
        pl.Series("sector", sectors, dtype=pl.Utf8),
        pl.Series("industry", industries, dtype=pl.Utf8),
        pl.when(pl.col("exchange") == "NSE")
          .then(pl.col("nse_symbol"))
          .otherwise(pl.col("bse_code"))
          .alias("symbol"),
    ]).select([
        "isin", "symbol", "nse_symbol", "bse_code", "name", "exchange", "sector", "industry"
    ])

    log.info(
        "Clean universe for %s: %d stocks (NSE: %d, BSE-only: %d)",
        trading_date,
        len(universe),
        universe.filter(pl.col("exchange") == "NSE").height,
        universe.filter(pl.col("exchange") == "BSE").height,
    )

    return universe


def _fetch_sector_mappings() -> dict[str, dict]:
    """Fetch sector and industry mappings from TradingView scanner & Nifty 500."""
    mapping = {}
    # 1. TradingView India scanner (covers ~3000 NSE/BSE stocks)
    try:
        import urllib.request, json
        url = "https://scanner.tradingview.com/india/scan"
        payload = {
            "columns": ["name", "sector", "industry", "isin"],
            "ignore_unknown_fields": False,
            "options": {"lang": "en"},
            "range": [0, 4000],
            "sort": {"sortBy": "name", "sortOrder": "asc"},
            "symbols": {"query": {"types": ["stock"]}}
        }
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode(),
            headers={"User-Agent": "Mozilla/5.0", "Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            for item in data.get("data", []):
                d = item.get("d", [])
                if len(d) >= 4:
                    sym, sec, ind, isin = d[0], d[1], d[2], d[3]
                    if isin:
                        mapping[isin] = {"sector": sec or "Diversified", "industry": ind or "Diversified"}
                    if sym:
                        mapping[sym] = {"sector": sec or "Diversified", "industry": ind or "Diversified"}
    except Exception as exc:
        log.warning("TradingView sector scan failed: %s", exc)

    # 2. Nifty 500 official CSV as supplemental/fallback
    try:
        import urllib.request, csv, io
        url = "https://www.niftyindices.com/IndexConstituent/ind_nifty500list.csv"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            text = resp.read().decode("utf-8", errors="ignore")
            for r in csv.DictReader(io.StringIO(text)):
                isin = r.get("ISIN Code")
                ind = r.get("Industry")
                sym = r.get("Symbol")
                if isin and isin not in mapping:
                    mapping[isin] = {"sector": ind or "Diversified", "industry": ind or "Diversified"}
                if sym and sym not in mapping:
                    mapping[sym] = {"sector": ind or "Diversified", "industry": ind or "Diversified"}
    except Exception as exc:
        log.warning("Nifty 500 constituent fetch failed: %s", exc)

    return mapping


def apply_to_parquet(
    parquet: pl.DataFrame,
    universe: pl.DataFrame,
) -> pl.DataFrame:
    """Filter the OHLCV parquet to only include universe ISINs."""
    valid_isins = set(universe["isin"].to_list())
    return parquet.filter(pl.col("isin").is_in(valid_isins))
