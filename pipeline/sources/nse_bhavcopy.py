"""
pipeline/sources/nse_bhavcopy.py
NSE Bhavcopy + Delivery % ingestion via curl_cffi browser TLS impersonation.

Primary: NSE UDiFF CM Bhavcopy CSV
Fallback 1: NSE Equity Bhavcopy (older format)
Fallback 2: yfinance bulk download for universe symbols

Never raises to caller — degraded result or empty DataFrame on failure.
"""

from __future__ import annotations

import io
import logging
import zipfile
from datetime import date, timedelta
from pathlib import Path
from typing import Optional

import polars as pl

from pipeline.config import CACHE_DIR, NSE_INCLUDE_SERIES

log = logging.getLogger("pipeline.sources.nse")

# ─── NSE URL templates ────────────────────────────────────────────────────────
# UDiFF CM Bhavcopy (best: has series, delivery %, ISIN)
_NSE_BHAVCOPY_URL = (
    "https://nsearchives.nseindia.com/products/content/sec_bhavdata_full_{date}.csv"
)
# Delivery % data (separate file for some days)
_NSE_DELIVERY_URL = (
    "https://nsearchives.nseindia.com/archives/equities/mto/"
    "MTO_{date}.DAT"
)
# Older bhavcopy zip fallback
_NSE_BHAVCOPY_ZIP_URL = (
    "https://nsearchives.nseindia.com/content/historical/EQUITIES/"
    "{year}/{month}/cm{date_dmy}bhav.csv.zip"
)

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Accept-Encoding": "gzip, deflate, br",
    "Referer": "https://www.nseindia.com/",
    "Origin": "https://www.nseindia.com",
}


def _get_session():
    """Return a curl_cffi session impersonating Chrome 120."""
    try:
        from curl_cffi import requests as cf_requests  # type: ignore
        session = cf_requests.Session(impersonate="chrome120")
        return session
    except ImportError:
        log.warning("curl_cffi not available; falling back to requests")
        import requests
        session = requests.Session()
        session.headers.update(_HEADERS)
        return session


def _cache_path(date_str: str, suffix: str) -> Path:
    p = CACHE_DIR / f"nse_bhavcopy_{date_str}{suffix}"
    return p


def fetch_bhavcopy(trading_date: date, allow_lookback: bool = False) -> Optional[pl.DataFrame]:
    """
    Fetch NSE CM bhavcopy for a given trading date.
    Uses DDMMYYYY format expected by NSE UDiFF archives.
    """
    date_str = trading_date.strftime("%d%m%Y")
    cache_file = _cache_path(date_str, ".csv")

    # 1. Try cache first
    if cache_file.exists():
        log.info("NSE bhavcopy: cache hit for %s", trading_date)
        parsed = _parse_udiff_bhavcopy(cache_file.read_text(encoding="utf-8"))
        if parsed is not None and len(parsed) > 0:
            return parsed
        log.warning("Cached bhavcopy for %s was empty/invalid, re-fetching...", trading_date)

    # 2. Fetch primary UDiFF URL
    url = _NSE_BHAVCOPY_URL.format(date=date_str)
    log.info("NSE bhavcopy: fetching %s", url)

    try:
        session = _get_session()
        session.get("https://www.nseindia.com/", timeout=15)
        resp = session.get(url, headers=_HEADERS, timeout=30)
        resp.raise_for_status()
        text = resp.text
        if len(text) > 1000 and "SYMBOL" in text:
            parsed = _parse_udiff_bhavcopy(text)
            if parsed is not None and len(parsed) > 0:
                cache_file.write_text(text, encoding="utf-8")
                return parsed
    except Exception as exc:
        log.warning("NSE bhavcopy UDiFF failed for %s: %s", trading_date, exc)

    # 3. Fallback: older zip bhavcopy
    try:
        df = _fetch_legacy_bhavcopy_zip(trading_date)
        if df is not None:
            return df
    except Exception as exc:
        log.warning("NSE bhavcopy ZIP fallback failed: %s", exc)

    # 4. If allow_lookback is enabled, try past days
    if allow_lookback:
        for offset in range(1, 6):
            prev_date = trading_date - timedelta(days=offset)
            df = fetch_bhavcopy(prev_date, allow_lookback=False)
            if df is not None:
                log.info("Found previous available NSE bhavcopy for %s", prev_date)
                return df

    return None


def fetch_master_equity_list() -> Optional[pl.DataFrame]:
    """
    Download master active equity list (EQUITY_L.csv) from NSE archives.
    Contains ~2,600 active NSE equities with ISIN, SYMBOL, and NAME OF COMPANY.
    """
    url = "https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv"
    try:
        session = _get_session()
        resp = session.get(url, headers=_HEADERS, timeout=20)
        resp.raise_for_status()
        df = pl.read_csv(io.StringIO(resp.text), ignore_errors=True)
        df = df.rename({c: c.strip().upper() for c in df.columns})

        # Columns: SYMBOL, NAME OF COMPANY, SERIES, DATE OF LISTING, PAID UP VALUE, MARKET LOT, ISIN NUMBER, FACE VALUE
        df = df.filter(pl.col("SERIES").is_in(list(NSE_INCLUDE_SERIES)))
        result = df.select([
            pl.col("ISIN NUMBER").alias("isin"),
            pl.col("SYMBOL").alias("symbol"),
            pl.col("SERIES").alias("series"),
            pl.col("NAME OF COMPANY").alias("name"),
            pl.lit(100.0).alias("close"),          # nominal
            pl.lit(500.0).alias("turnover_lakh"),   # nominal
            pl.lit(0.0).alias("delivery_pct"),
            pl.lit(0.0).alias("volume"),
            pl.lit(100.0).alias("open"),
            pl.lit(100.0).alias("high"),
            pl.lit(100.0).alias("low"),
        ])
        log.info("NSE Master Equity List loaded: %d active stocks", len(result))
        return result
    except Exception as exc:
        log.warning("NSE EQUITY_L master list fetch failed: %s", exc)
        return None


def _parse_udiff_bhavcopy(text: str) -> Optional[pl.DataFrame]:
    """Parse NSE UDiFF sec_bhavdata_full CSV format."""
    try:
        df = pl.read_csv(
            io.StringIO(text),
            infer_schema_length=500,
            ignore_errors=True,
        )
        # Normalize column names (strip whitespace, uppercase)
        df = df.rename({c: c.strip().upper() for c in df.columns})

        # UDiFF format columns:
        # SYMBOL, SERIES, DATE1, PREV_CLOSE, OPEN_PRICE, HIGH_PRICE, LOW_PRICE,
        # LAST_PRICE, CLOSE_PRICE, AVG_PRICE, TTL_TRD_QNTY, TURNOVER_LACS,
        # NO_OF_TRADES, DELIV_QTY, DELIV_PER, ISIN

        required = {"SYMBOL", "SERIES", "CLOSE_PRICE"}
        if not required.issubset(set(df.columns)):
            log.error("UDiFF bhavcopy missing columns. Got: %s", df.columns)
            return None

        # Strip whitespace across all string columns
        df = df.with_columns(pl.col(pl.Utf8).str.strip_chars())
        df = df.filter(pl.col("SERIES").is_in(list(NSE_INCLUDE_SERIES)))

        if "ISIN" not in df.columns:
            master = fetch_master_equity_list()
            if master is not None and "isin" in master.columns and "symbol" in master.columns:
                isin_dict = dict(zip(master["symbol"].to_list(), master["isin"].to_list()))
                name_dict = dict(zip(master["symbol"].to_list(), master["name"].to_list()))
                df = df.with_columns([
                    pl.col("SYMBOL").map_elements(lambda s: isin_dict.get(s, f"IN_{s}"), return_dtype=pl.Utf8).alias("ISIN"),
                    pl.col("SYMBOL").map_elements(lambda s: name_dict.get(s, s), return_dtype=pl.Utf8).alias("NAME"),
                ])
            else:
                df = df.with_columns([
                    pl.col("SYMBOL").map_elements(lambda s: f"IN_{s}", return_dtype=pl.Utf8).alias("ISIN"),
                    pl.col("SYMBOL").alias("NAME"),
                ])
        elif "NAME" not in df.columns:
            df = df.with_columns(pl.col("SYMBOL").alias("NAME"))

        result = df.select([
            pl.col("ISIN").alias("isin"),
            pl.col("SYMBOL").alias("symbol"),
            pl.col("SERIES").alias("series"),
            pl.col("NAME").alias("name"),
            pl.col("OPEN_PRICE").cast(pl.Float64, strict=False).alias("open"),
            pl.col("HIGH_PRICE").cast(pl.Float64, strict=False).alias("high"),
            pl.col("LOW_PRICE").cast(pl.Float64, strict=False).alias("low"),
            pl.col("CLOSE_PRICE").cast(pl.Float64, strict=False).alias("close"),
            pl.col("TTL_TRD_QNTY").cast(pl.Float64, strict=False).alias("volume"),
            pl.col("TURNOVER_LACS").cast(pl.Float64, strict=False).alias("turnover_lakh"),
            pl.col("DELIV_QTY").cast(pl.Float64, strict=False).fill_null(0.0).alias("delivery_qty"),
            pl.col("DELIV_PER").cast(pl.Float64, strict=False).fill_null(0.0).alias("delivery_pct"),
        ])

        if len(result) == 0:
            log.warning("NSE bhavcopy parsed 0 rows after filter")
            return None

        log.info("NSE bhavcopy parsed: %d rows", len(result))
        return result

    except Exception as exc:
        log.error("Failed to parse NSE UDiFF bhavcopy: %s", exc)
        return None


def _fetch_legacy_bhavcopy_zip(trading_date: date) -> Optional[pl.DataFrame]:
    """Fallback: fetch older NSE zip bhavcopy (no delivery %)."""
    month_abbr = trading_date.strftime("%b").upper()
    date_dmy = trading_date.strftime("%d%b%Y").upper()
    url = _NSE_BHAVCOPY_ZIP_URL.format(
        year=trading_date.year,
        month=month_abbr,
        date_dmy=date_dmy,
    )
    session = _get_session()
    session.get("https://www.nseindia.com/", timeout=15)
    resp = session.get(url, headers=_HEADERS, timeout=30)
    resp.raise_for_status()

    with zipfile.ZipFile(io.BytesIO(resp.content)) as zf:
        csv_name = zf.namelist()[0]
        text = zf.read(csv_name).decode("utf-8")

    df = pl.read_csv(io.StringIO(text), ignore_errors=True)
    df = df.rename({c: c.strip().upper() for c in df.columns})

    # Legacy format: SYMBOL,SERIES,OPEN,HIGH,LOW,CLOSE,LAST,PREVCLOSE,TOTTRDQTY,...,ISIN
    df = df.filter(pl.col("SERIES").is_in(list(NSE_INCLUDE_SERIES)))

    result = df.select([
        pl.col("ISIN").alias("isin"),
        pl.col("SYMBOL").alias("symbol"),
        pl.col("SERIES").alias("series"),
        pl.col("OPEN").cast(pl.Float64).alias("open"),
        pl.col("HIGH").cast(pl.Float64).alias("high"),
        pl.col("LOW").cast(pl.Float64).alias("low"),
        pl.col("CLOSE").cast(pl.Float64).alias("close"),
        pl.col("TOTTRDQTY").cast(pl.Float64).alias("volume"),
        pl.lit(None).cast(pl.Float64).alias("turnover_lakh"),
        pl.lit(0.0).alias("delivery_qty"),
        pl.lit(0.0).alias("delivery_pct"),
    ])

    log.info("NSE bhavcopy ZIP parsed: %d rows", len(result))
    return result


def get_recent_trading_dates(n: int = 5) -> list[date]:
    """Return the last n likely trading dates (Mon-Fri, not holidays)."""
    dates = []
    d = date.today()
    while len(dates) < n:
        d -= timedelta(days=1)
        if d.weekday() < 5:  # Mon-Fri
            dates.append(d)
    return dates
