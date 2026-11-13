"""
pipeline/sources/bulk_deals.py
NSE Bulk Deals & Block Deals ingestion.
Primary: NSE archive CSV (no cookie required)
Fallback: BSE bulk deals
"""

from __future__ import annotations

import io
import logging
from datetime import date
from typing import Optional

import polars as pl

from pipeline.config import CACHE_DIR

log = logging.getLogger("pipeline.sources.bulk_deals")

_NSE_BULK_URL = (
    "https://nsearchives.nseindia.com/content/equities/bulk.csv"
)
_NSE_BLOCK_URL = (
    "https://nsearchives.nseindia.com/content/equities/block.csv"
)
_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "Referer": "https://www.nseindia.com/",
}


def fetch_bulk_deals(trading_date: Optional[date] = None) -> pl.DataFrame:
    """
    Fetch NSE bulk deals for the given date (or all recent).

    Returns DataFrame with columns:
        date, symbol, client, buy_sell, quantity, price, value_cr
    """
    cache_file = CACHE_DIR / "nse_bulk_deals.csv"
    return _fetch_deals(
        url=_NSE_BULK_URL,
        cache_file=cache_file,
        deal_type="BULK",
        trading_date=trading_date,
    )


def fetch_block_deals(trading_date: Optional[date] = None) -> pl.DataFrame:
    """
    Fetch NSE block deals for the given date.

    Returns same schema as fetch_bulk_deals.
    """
    cache_file = CACHE_DIR / "nse_block_deals.csv"
    return _fetch_deals(
        url=_NSE_BLOCK_URL,
        cache_file=cache_file,
        deal_type="BLOCK",
        trading_date=trading_date,
    )


def _fetch_deals(
    url: str,
    cache_file,
    deal_type: str,
    trading_date: Optional[date],
) -> pl.DataFrame:
    try:
        try:
            from curl_cffi import requests as cf_requests  # type: ignore
            session = cf_requests.Session(impersonate="chrome120")
        except ImportError:
            import requests
            session = requests.Session()
            session.headers.update(_HEADERS)

        # NSE's bulk/block CSVs are updated daily — always refetch
        session.get("https://www.nseindia.com/", timeout=15)
        resp = session.get(url, headers=_HEADERS, timeout=30)
        resp.raise_for_status()
        text = resp.text
        cache_file.write_text(text, encoding="utf-8")

    except Exception as exc:
        log.warning("%s deals fetch failed: %s", deal_type, exc)
        if cache_file.exists():
            log.info("Using cached %s deals", deal_type)
            text = cache_file.read_text(encoding="utf-8")
        else:
            return pl.DataFrame()

    return _parse_deals_csv(text, deal_type, trading_date)


def _parse_deals_csv(
    text: str,
    deal_type: str,
    trading_date: Optional[date],
) -> pl.DataFrame:
    """Parse NSE bulk/block deals CSV."""
    try:
        df = pl.read_csv(
            io.StringIO(text),
            infer_schema_length=200,
            ignore_errors=True,
        )
        df = df.rename({c: c.strip().upper() for c in df.columns})

        # NSE format: DATE_OF_DEAL, SYMBOL_SERIES, NAME_OF_CLIENT,
        # BUY_SELL, QUANTITY_TRADED, TRADE_PRICE, REMARKS
        # or: DATE OF DEAL, SYMBOL, NAME OF CLIENT, BUY / SELL, QTY TRADED, TRADE PRICE

        # Normalize column names
        col_map = {}
        for col in df.columns:
            clean = col.replace(" ", "_").replace("/", "_").strip("_")
            col_map[col] = clean
        df = df.rename(col_map)

        # Find date column
        date_col = next(
            (c for c in df.columns if "DATE" in c), None
        )
        symbol_col = next(
            (c for c in df.columns if "SYMBOL" in c), None
        )
        client_col = next(
            (c for c in df.columns if "CLIENT" in c or "NAME" in c), None
        )
        buysell_col = next(
            (c for c in df.columns if "BUY" in c or "SELL" in c), None
        )
        qty_col = next(
            (c for c in df.columns if "QTY" in c or "QUANTITY" in c), None
        )
        price_col = next(
            (c for c in df.columns if "PRICE" in c), None
        )

        if not all([date_col, symbol_col, client_col]):
            log.error("Bulk deals: could not identify required columns in %s", df.columns)
            return pl.DataFrame()

        result = df.select(
            [c for c in [date_col, symbol_col, client_col, buysell_col, qty_col, price_col] if c]
        ).rename({
            date_col: "date_str",
            symbol_col: "symbol",
            client_col: "client",
            **(
                {
                    buysell_col: "buy_sell",
                    qty_col: "quantity",
                    price_col: "price",
                }
                if buysell_col and qty_col and price_col
                else {}
            ),
        })

        # Parse date
        result = result.with_columns([
            pl.col("date_str").str.to_date(format="%d-%b-%Y", strict=False).alias("deal_date"),
            pl.lit(deal_type).alias("deal_type"),
        ]).drop("date_str")

        # Filter to trading date if specified
        if trading_date is not None:
            result = result.filter(pl.col("deal_date") == pl.lit(trading_date))

        # Compute value in ₹ cr
        if "quantity" in result.columns and "price" in result.columns:
            result = result.with_columns([
                pl.col("quantity").cast(pl.Float64).fill_null(0),
                pl.col("price").cast(pl.Float64).fill_null(0),
            ]).with_columns([
                (pl.col("quantity") * pl.col("price") / 1e7).alias("value_cr"),
            ])

        log.info("%s deals: %d rows", deal_type, len(result))
        return result

    except Exception as exc:
        log.error("Failed to parse %s deals: %s", deal_type, exc)
        return pl.DataFrame()
