from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date

import pandas as pd

from app.ingestion.sources.cache import raw_cache_path

log = logging.getLogger("swing.ingest.index")


@dataclass
class IndexBarRow:
    d: date
    open: float | None
    high: float | None
    low: float | None
    close: float


# nselib index_data column -> our field. Names vary; unknowns fall through to None.
_COL_CANDIDATES = {
    "open": ["OPEN_INDEX_VAL", "OPEN", "Open"],
    "high": ["HIGH_INDEX_VAL", "HIGH", "High"],
    "low": ["LOW_INDEX_VAL", "LOW", "Low"],
    "close": ["CLOSE_INDEX_VAL", "CLOSE", "Close", "INDEX_VAL"],
    "date": ["TIMESTAMP", "HistoricalDate", "Date", "DATE"],
}


def _to_float(v) -> float | None:
    try:
        f = float(str(v).replace(",", "").strip())
        return f if pd.notna(f) else None
    except (ValueError, TypeError):
        return None


def _pick(df: pd.DataFrame, field: str) -> str | None:
    for c in _COL_CANDIDATES[field]:
        if c in df.columns:
            return c
    return None


def fetch_index_history(symbol: str, start: date, end: date, *, use_cache: bool = True) -> pd.DataFrame:
    cache = raw_cache_path("index_history", f"{symbol}|{start}|{end}")
    if use_cache and cache.exists() and cache.stat().st_size > 0:
        return pd.read_csv(cache)

    from nselib import capital_market

    raw = capital_market.index_data(
        index=symbol,
        from_date=start.strftime("%d-%m-%Y"),
        to_date=end.strftime("%d-%m-%Y"),
    )
    df = pd.DataFrame(raw)
    df.to_csv(cache, index=False)
    return df


def normalize(df: pd.DataFrame) -> list[IndexBarRow]:
    date_col = _pick(df, "date")
    close_col = _pick(df, "close")
    if not date_col or not close_col:
        log.warning("index frame missing date/close columns: %s", list(df.columns))
        return []
    open_col, high_col, low_col = _pick(df, "open"), _pick(df, "high"), _pick(df, "low")

    rows: list[IndexBarRow] = []
    for r in df.to_dict("records"):
        d = pd.to_datetime(r[date_col], dayfirst=True, errors="coerce")
        close = _to_float(r[close_col])
        if pd.isna(d) or close is None:
            continue
        rows.append(
            IndexBarRow(
                d=d.date(),
                open=_to_float(r.get(open_col)) if open_col else None,
                high=_to_float(r.get(high_col)) if high_col else None,
                low=_to_float(r.get(low_col)) if low_col else None,
                close=close,
            )
        )
    return rows
