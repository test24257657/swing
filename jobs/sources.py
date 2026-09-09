"""External data sources. Every function caches its raw payload and degrades to
``None`` / an empty frame rather than raising — one broken source must never take down
the run.
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta
from io import StringIO

import httpx
import pandas as pd

from jobs.cache import cached, raw_path, safe
from jobs.config import HTTP_TIMEOUT, SERIES_KEPT

log = logging.getLogger("jobs.sources")

_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"

# nselib bhavcopy column name -> ours. Keep the mapping in one place so a rename
# upstream is a one-line fix.
_BHAV_COLS = {
    "SYMBOL": "symbol",
    "SERIES": "series",
    "OPEN_PRICE": "open",
    "HIGH_PRICE": "high",
    "LOW_PRICE": "low",
    "CLOSE_PRICE": "close",
    "PREV_CLOSE": "prev_close",
    "AVG_PRICE": "vwap",
    "TTL_TRD_QNTY": "volume",
    "TURNOVER_LACS": "turnover_lacs",
    "DELIV_QTY": "delivery_qty",
    "DELIV_PER": "delivery_pct",
}

NIFTY_CSV = {
    "NIFTY 50": "ind_nifty50list.csv",
    "NIFTY 500": "ind_nifty500list.csv",
    "NIFTY BANK": "ind_niftybanklist.csv",
}


def _num(v) -> float | None:
    try:
        f = float(str(v).replace(",", "").strip())
        return f if pd.notna(f) else None
    except (ValueError, TypeError):
        return None


# --- universe ----------------------------------------------------------------


@cached(ttl=3600)
@safe(default=list, label="nifty500 constituents")
def index_constituents(index_symbol: str = "NIFTY 500") -> list[str]:
    """Symbols in an NSE index, from the official niftyindices.com list CSV."""
    fname = NIFTY_CSV.get(index_symbol)
    if not fname:
        return []
    cache = raw_path("constituents", index_symbol)
    if cache.exists() and cache.stat().st_size > 0:
        text = cache.read_text()
    else:
        r = httpx.get(
            f"https://niftyindices.com/IndexConstituent/{fname}",
            headers={"User-Agent": _UA, "Referer": "https://niftyindices.com/"},
            timeout=HTTP_TIMEOUT,
            follow_redirects=True,
        )
        r.raise_for_status()
        text = r.text
        cache.write_text(text)

    df = pd.read_csv(StringIO(text), engine="python", on_bad_lines="skip")
    col = next((c for c in df.columns if c.strip().lower() == "symbol"), None)
    return [str(s).strip().upper() for s in df[col] if str(s).strip()] if col else []


@cached(ttl=3600)
@safe(default=dict, label="equity list")
def symbol_names() -> dict[str, str]:
    """NSE symbol -> company name, for display in the movers tables."""
    cache = raw_path("equity_list", "nse-equity-list")
    if cache.exists() and cache.stat().st_size > 0:
        df = pd.read_csv(cache)
    else:
        from nselib import capital_market

        df = pd.DataFrame(capital_market.equity_list())
        df.to_csv(cache, index=False)
    cols = {c.strip().upper(): c for c in df.columns}
    sym, name = cols.get("SYMBOL"), cols.get("NAME OF COMPANY")
    if not (sym and name):
        return {}
    return {
        str(s).strip().upper(): str(n).strip()
        for s, n in zip(df[sym], df[name], strict=False)
    }


# --- bhavcopy ----------------------------------------------------------------


@safe(default=None, label="bhavcopy")
def bhavcopy(d: date) -> pd.DataFrame | None:
    """Whole-market EOD OHLCV + delivery for one session. One request, all symbols."""
    cache = raw_path("bhavcopy", d.isoformat())
    if cache.exists() and cache.stat().st_size > 0:
        raw = pd.read_csv(cache)
    else:
        from nselib import capital_market

        raw = pd.DataFrame(capital_market.bhav_copy_with_delivery(d.strftime("%d-%m-%Y")))
        if raw.empty:
            return None
        raw.to_csv(cache, index=False)

    df = raw.rename(columns={k: v for k, v in _BHAV_COLS.items() if k in raw.columns})
    if "symbol" not in df.columns:
        return None

    df["symbol"] = df["symbol"].astype(str).str.strip().str.upper()
    df["series"] = df.get("series", "EQ").astype(str).str.strip().str.upper()
    df = df[df["series"].isin(SERIES_KEPT)]

    for c in ("open", "high", "low", "close", "prev_close", "vwap", "volume",
              "turnover_lacs", "delivery_qty", "delivery_pct"):
        df[c] = pd.to_numeric(df[c].map(_num), errors="coerce") if c in df.columns else pd.NA
        df[c] = pd.to_numeric(df[c], errors="coerce")

    df["turnover"] = df["turnover_lacs"] * 1e5
    df["date"] = pd.Timestamp(d)
    keep = ["date", "symbol", "open", "high", "low", "close", "prev_close",
            "volume", "turnover", "delivery_qty", "delivery_pct"]
    return df[[c for c in keep if c in df.columns]].dropna(subset=["close"])


# --- indices -----------------------------------------------------------------


CHUNK_DAYS = 100  # nselib caps index_data at roughly this many sessions per call


@safe(default=None, label="index history")
def index_history(symbol: str, days: int) -> pd.DataFrame | None:
    """Daily OHLC for one NSE index, stitched from fixed-size windows.

    ``capital_market.index_data`` silently truncates a long range, so the request is
    chunked and the pieces concatenated.
    """
    end = date.today()
    span = int(days * 1.5) + 20  # calendar days needed to cover `days` sessions
    frames: list[pd.DataFrame] = []

    cursor_end = end
    while span > 0:
        cursor_start = cursor_end - timedelta(days=min(CHUNK_DAYS, span))
        part = _index_chunk(symbol, cursor_start, cursor_end)
        if part is not None and not part.empty:
            frames.append(part)
        span -= CHUNK_DAYS
        cursor_end = cursor_start - timedelta(days=1)

    if not frames:
        return None
    out = (
        pd.concat(frames, ignore_index=True)
        .drop_duplicates(subset=["date"])
        .sort_values("date")
        .reset_index(drop=True)
    )
    return out.tail(days).reset_index(drop=True)


def _index_chunk(symbol: str, start: date, end: date) -> pd.DataFrame | None:
    cache = raw_path("index", f"{symbol}-{start}-{end}")
    if cache.exists() and cache.stat().st_size > 0:
        raw = pd.read_csv(cache)
    else:
        from nselib import capital_market

        raw = pd.DataFrame(
            capital_market.index_data(
                symbol, start.strftime("%d-%m-%Y"), end.strftime("%d-%m-%Y")
            )
        )
        if raw.empty:
            return None
        raw.to_csv(cache, index=False)

    cols = {c.strip().upper(): c for c in raw.columns}

    def pick(*names):
        for n in names:
            if n in cols:
                return cols[n]
        return None

    d_col = pick("TIMESTAMP", "HISTORICALDATE", "DATE", "INDEX_DATE")
    c_col = pick("CLOSE_INDEX_VAL", "CLOSING_INDEX_VALUE", "CLOSE", "CLOSEPRICE")
    o_col = pick("OPEN_INDEX_VAL", "OPEN_INDEX_VALUE", "OPEN")
    h_col = pick("HIGH_INDEX_VAL", "HIGH_INDEX_VALUE", "HIGH")
    l_col = pick("LOW_INDEX_VAL", "LOW_INDEX_VALUE", "LOW")
    if not (d_col and c_col):
        return None

    return pd.DataFrame(
        {
            "date": pd.to_datetime(raw[d_col], dayfirst=True, errors="coerce", format="mixed"),
            "close": pd.to_numeric(raw[c_col].map(_num), errors="coerce"),
            "open": pd.to_numeric(raw[o_col].map(_num), errors="coerce") if o_col else None,
            "high": pd.to_numeric(raw[h_col].map(_num), errors="coerce") if h_col else None,
            "low": pd.to_numeric(raw[l_col].map(_num), errors="coerce") if l_col else None,
        }
    ).dropna(subset=["date", "close"])


# --- flows -------------------------------------------------------------------


@safe(default=None, label="FII/DII")
def fii_dii() -> pd.DataFrame | None:
    """Latest-session FII/DII cash figures from the NSE JSON API (needs the cookie dance)."""
    headers = {
        "User-Agent": _UA,
        "Accept": "application/json, text/plain, */*",
        "Referer": "https://www.nseindia.com/reports/fii-dii",
    }
    with httpx.Client(headers=headers, timeout=HTTP_TIMEOUT, follow_redirects=True) as cl:
        cl.get("https://www.nseindia.com")
        r = cl.get("https://www.nseindia.com/api/fiidiiTradeReact")
        r.raise_for_status()
        rows = r.json()

    df = pd.DataFrame(rows)
    if df.empty:
        return None
    df.columns = [c.strip().lower() for c in df.columns]
    return df


# --- calendar ----------------------------------------------------------------


@safe(default=list, label="holiday calendar")
def holidays() -> list[dict]:
    """NSE equity trading holidays."""
    import nselib

    df = pd.DataFrame(nselib.trading_holiday_calendar())
    if df.empty:
        return []
    lower = {c.lower(): c for c in df.columns}
    d_col = lower.get("tradingdate")
    p_col = lower.get("product")
    desc_col = lower.get("description")
    if not d_col:
        return []
    if p_col:
        df = df[df[p_col].astype(str).str.contains("Equit", case=False, na=False)]

    out: dict[str, dict] = {}
    for r in df.to_dict("records"):
        parsed = None
        for fmt in ("%d-%b-%Y", "%d-%b-%y", "%Y-%m-%d", "%d-%m-%Y"):
            try:
                parsed = datetime.strptime(str(r[d_col]).strip(), fmt).date()
                break
            except ValueError:
                continue
        if parsed is None:
            continue
        desc = str(r.get(desc_col, "")).strip() if desc_col else ""
        out[parsed.isoformat()] = {"date": parsed.isoformat(), "description": desc[:120]}
    return sorted(out.values(), key=lambda h: h["date"])
