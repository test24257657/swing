"""
pipeline/sources/bse_bhavcopy.py
BSE Bhavcopy ingestion — fallback when NSE data is unavailable.
Also used for BSE-exclusive stocks (A/B group) not listed on NSE.
"""

from __future__ import annotations

import io
import logging
import zipfile
from datetime import date
from pathlib import Path
from typing import Optional

import polars as pl

from pipeline.config import CACHE_DIR, BSE_INCLUDE_GROUPS

log = logging.getLogger("pipeline.sources.bse")

# BSE daily bhavdump — requires the date in DDMMYYYY format
_BSE_BHAVCOPY_URL = (
    "https://www.bseindia.com/download/BhavCopy/Equity/"
    "EQ_ISINCODE_{date}.ZIP"
)

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Referer": "https://www.bseindia.com/",
}


def fetch_bhavcopy(trading_date: date, allow_lookback: bool = False) -> Optional[pl.DataFrame]:
    """
    Fetch BSE bhavcopy for a given trading date.

    Returns a Polars DataFrame with columns:
        isin, bse_code, symbol, group, open, high, low, close, volume, turnover_lakh

    Returns None on failure.
    """
    date_str = trading_date.strftime("%d%m%Y")
    cache_file = CACHE_DIR / f"bse_bhavcopy_{date_str}.csv"

    if cache_file.exists():
        log.info("BSE bhavcopy: cache hit for %s", trading_date)
        parsed = _parse_bse_bhavcopy(cache_file.read_text(encoding="utf-8"))
        if parsed is not None and len(parsed) > 0:
            return parsed

    url = _BSE_BHAVCOPY_URL.format(date=date_str)
    log.info("BSE bhavcopy: fetching %s", url)

    try:
        try:
            from curl_cffi import requests as cf_requests  # type: ignore
            session = cf_requests.Session(impersonate="chrome120")
        except ImportError:
            import requests
            session = requests.Session()
            session.headers.update(_HEADERS)

        resp = session.get(url, headers=_HEADERS, timeout=30)
        resp.raise_for_status()

        with zipfile.ZipFile(io.BytesIO(resp.content)) as zf:
            csv_name = zf.namelist()[0]
            text = zf.read(csv_name).decode("utf-8")

        parsed = _parse_bse_bhavcopy(text)
        if parsed is not None and len(parsed) > 0:
            cache_file.write_text(text, encoding="utf-8")
            return parsed

    except Exception as exc:
        log.warning("BSE bhavcopy failed for %s: %s", trading_date, exc)

    if allow_lookback:
        from datetime import timedelta
        for offset in range(1, 6):
            prev_date = trading_date - timedelta(days=offset)
            df = fetch_bhavcopy(prev_date, allow_lookback=False)
            if df is not None and len(df) > 0:
                log.info("Found previous available BSE bhavcopy for %s", prev_date)
                return df

    return None


def _parse_bse_bhavcopy(text: str) -> Optional[pl.DataFrame]:
    """Parse BSE EQ_ISINCODE CSV format."""
    try:
        df = pl.read_csv(
            io.StringIO(text),
            infer_schema_length=200,
            ignore_errors=True,
        )
        df = df.rename({c: c.strip().upper() for c in df.columns})

        # BSE format: ISIN_CODE, SCRIP_CD, SC_NAME, SC_GROUP, SC_TYPE,
        # OPEN, HIGH, LOW, CLOSE, LAST, PREVCLOSE, NO_TRADES,
        # NO_OF_SHRS, NET_TURNOV (₹), CORP_ADJ_FACTOR

        required = {"ISIN_CODE", "SC_GROUP", "CLOSE"}
        if not required.issubset(set(df.columns)):
            log.error("BSE bhavcopy missing columns. Got: %s", df.columns)
            return None

        # Clean strings
        df = df.with_columns(pl.col(pl.Utf8).str.strip_chars())
        df = df.filter(pl.col("SC_GROUP").is_in(list(BSE_INCLUDE_GROUPS)))

        result = df.select([
            pl.col("ISIN_CODE").alias("isin"),
            pl.col("SCRIP_CD").cast(pl.Utf8).alias("bse_code"),
            pl.col("SC_NAME").alias("name"),
            pl.col("SC_GROUP").alias("group"),
            pl.col("OPEN").cast(pl.Float64, strict=False).alias("open"),
            pl.col("HIGH").cast(pl.Float64, strict=False).alias("high"),
            pl.col("LOW").cast(pl.Float64, strict=False).alias("low"),
            pl.col("CLOSE").cast(pl.Float64, strict=False).alias("close"),
            pl.col("NO_OF_SHRS").cast(pl.Float64, strict=False).alias("volume"),
            (pl.col("NET_TURNOV").cast(pl.Float64, strict=False) / 1e5).alias("turnover_lakh"),
        ])

        # Exclude ETF-like names
        from pipeline.config import EXCLUDE_NAME_KEYWORDS
        for kw in EXCLUDE_NAME_KEYWORDS:
            result = result.filter(
                ~pl.col("name").str.to_uppercase().str.contains(kw)
            )

        log.info("BSE bhavcopy parsed: %d rows", len(result))
        return result

    except Exception as exc:
        log.error("Failed to parse BSE bhavcopy: %s", exc)
        return None
