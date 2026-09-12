"""External data sources. Every function caches its raw payload and degrades to
``None`` / an empty frame rather than raising — one broken source must never take down
the run.
"""

from __future__ import annotations

import logging
from datetime import UTC, date, datetime, timedelta
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
    # Sector indices — every filename here was verified against a real CSV response
    # (not the site's HTML 404 fallback) before being added; a guessed-wrong filename
    # degrades that one sector to empty via @safe rather than raising.
    "NIFTY AUTO": "ind_niftyautolist.csv",
    "NIFTY IT": "ind_niftyitlist.csv",
    "NIFTY PHARMA": "ind_niftypharmalist.csv",
    "NIFTY FMCG": "ind_niftyfmcglist.csv",
    "NIFTY METAL": "ind_niftymetallist.csv",
    "NIFTY REALTY": "ind_niftyrealtylist.csv",
    "NIFTY ENERGY": "ind_niftyenergylist.csv",
    "NIFTY PSU BANK": "ind_niftypsubanklist.csv",
    "NIFTY PRIVATE BANK": "ind_nifty_privatebanklist.csv",
    "NIFTY MEDIA": "ind_niftymedialist.csv",
    "NIFTY CONSUMER DURABLES": "ind_niftyconsumerdurableslist.csv",
    "NIFTY OIL & GAS": "ind_niftyoilgaslist.csv",
    "NIFTY HEALTHCARE INDEX": "ind_niftyhealthcarelist.csv",
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


@cached(ttl=3600)
@safe(default=dict, label="listing dates")
def listing_dates() -> dict[str, date]:
    """NSE symbol -> listing date, for the IPO-base detector."""
    cache = raw_path("equity_list", "nse-equity-list")
    if cache.exists() and cache.stat().st_size > 0:
        df = pd.read_csv(cache)
    else:
        from nselib import capital_market

        df = pd.DataFrame(capital_market.equity_list())
        df.to_csv(cache, index=False)
    cols = {c.strip().upper(): c for c in df.columns}
    sym, listed = cols.get("SYMBOL"), cols.get("DATE OF LISTING")
    if not (sym and listed):
        return {}
    out: dict[str, date] = {}
    for s, d in zip(df[sym], df[listed], strict=False):
        parsed = pd.to_datetime(d, format="%d-%b-%Y", errors="coerce")
        if pd.notna(parsed):
            out[str(s).strip().upper()] = parsed.date()
    return out


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
    end = date.today()  # noqa: DTZ011
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


# --- announcements -------------------------------------------------------------


@safe(default=list, label="corporate announcements")
def announcements(start: date, end: date) -> list[dict]:
    """NSE corporate announcements/filings for every listed equity in the given range
    (needs the cookie dance, same as fii_dii). Filtering to a relevant subset and
    classifying impact happens in jobs/news.py — this is the raw feed."""
    headers = {
        "User-Agent": _UA,
        "Accept": "application/json, text/plain, */*",
        "Referer": "https://www.nseindia.com/companies-listing/corporate-filings-announcements",
    }
    params = {
        "index": "equities",
        "from_date": start.strftime("%d-%m-%Y"),
        "to_date": end.strftime("%d-%m-%Y"),
    }
    with httpx.Client(headers=headers, timeout=HTTP_TIMEOUT, follow_redirects=True) as cl:
        cl.get("https://www.nseindia.com")
        r = cl.get("https://www.nseindia.com/api/corporate-announcements", params=params)
        r.raise_for_status()
        rows = r.json()
    return rows if isinstance(rows, list) else []


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
                parsed = datetime.strptime(str(r[d_col]).strip(), fmt).replace(tzinfo=UTC).date()
                break
            except ValueError:
                continue
        if parsed is None:
            continue
        desc = str(r.get(desc_col, "")).strip() if desc_col else ""
        out[parsed.isoformat()] = {"date": parsed.isoformat(), "description": desc[:120]}
    return sorted(out.values(), key=lambda h: h["date"])


# --- bulk & block deals -------------------------------------------------------


@safe(default=list, label="bulk deals")
def bulk_deals() -> list[dict]:
    """Today's bulk-deal disclosures — a static daily archive file, no cookie dance
    needed (same class of endpoint as the niftyindices CSVs)."""
    with httpx.Client(headers={"User-Agent": _UA}, timeout=HTTP_TIMEOUT, follow_redirects=True) as cl:
        r = cl.get("https://nsearchives.nseindia.com/content/equities/bulk.csv")
        r.raise_for_status()
        df = pd.read_csv(StringIO(r.text))
    df.columns = [c.strip() for c in df.columns]
    return df.to_dict("records")


@safe(default=list, label="block deals")
def block_deals() -> list[dict]:
    """Today's block-deal disclosures — same static daily archive as bulk_deals()."""
    with httpx.Client(headers={"User-Agent": _UA}, timeout=HTTP_TIMEOUT, follow_redirects=True) as cl:
        r = cl.get("https://nsearchives.nseindia.com/content/equities/block.csv")
        r.raise_for_status()
        df = pd.read_csv(StringIO(r.text))
    df.columns = [c.strip() for c in df.columns]
    return df.to_dict("records")


# --- participant-wise open interest --------------------------------------------


@safe(default=None, label="participant-wise OI")
def participant_oi(d: date) -> dict | None:
    """FII/DII/Pro/Client open-interest breakdown for one session — a static daily
    archive file (no cookie dance). Also the source for the FII index-futures
    long/short ratio: it's just the FII row's Future Index Long/Short columns."""
    cache = raw_path("participant_oi", d.isoformat(), suffix=".csv")
    if cache.exists() and cache.stat().st_size > 0:
        text = cache.read_text()
    else:
        url = f"https://nsearchives.nseindia.com/content/nsccl/fao_participant_oi_{d.strftime('%d%m%Y')}.csv"
        with httpx.Client(headers={"User-Agent": _UA}, timeout=HTTP_TIMEOUT, follow_redirects=True) as cl:
            r = cl.get(url)
            if r.status_code == 404:
                return None
            r.raise_for_status()
            text = r.text
        cache.write_text(text)

    df = pd.read_csv(StringIO(text), skiprows=1)
    df.columns = [c.strip() for c in df.columns]
    df["Client Type"] = df["Client Type"].astype(str).str.strip()
    df = df.set_index("Client Type")
    if not {"FII", "DII", "Pro", "Client", "TOTAL"}.issubset(set(df.index)):
        return None
    return {row: {col.strip(): _num(val) for col, val in df.loc[row].items()} for row in df.index}


# --- F&O bhavcopy ---------------------------------------------------------------


@safe(default=None, label="F&O bhavcopy")
def fno_bhavcopy(d: date) -> pd.DataFrame | None:
    """Every F&O contract traded on one session — futures + options, all underlyings.
    Used for the buildup classifier (near-month stock futures only)."""
    cache = raw_path("fno_bhav", d.isoformat(), suffix=".csv")
    if cache.exists() and cache.stat().st_size > 0:
        return pd.read_csv(cache)

    from nselib import derivatives

    df = derivatives.fno_bhav_copy(d.strftime("%d-%m-%Y"))
    if df is None or df.empty:
        return None
    df.to_csv(cache, index=False)
    return df


# --- option chain ---------------------------------------------------------------


@cached(ttl=3600)
@safe(default=list, label="F&O expiry dates")
def fno_expiries() -> list[str]:
    """Upcoming monthly expiry dates (stock F&O and index futures share the cycle),
    nearest first — 'DD-Mon-YYYY' strings as NSE's option-chain API expects them."""
    from nselib import derivatives

    return list(derivatives.expiry_dates_future())


@safe(default=None, label="option chain")
def option_chain(symbol: str, expiry: str) -> dict | None:
    """Live option-chain snapshot (needs a real, current expiry from fno_expiries()) —
    NSE's option-chain-v3 endpoint returns {} for a stale/invalid expiry rather than
    erroring, so an empty 'records' is treated the same as a hard failure."""
    headers = {
        "User-Agent": _UA,
        "Accept": "application/json, text/plain, */*",
        "Referer": "https://www.nseindia.com/option-chain",
    }
    kind = "Indices" if symbol.upper() in {"NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY"} else "Equity"
    with httpx.Client(headers=headers, timeout=HTTP_TIMEOUT, follow_redirects=True) as cl:
        cl.get("https://www.nseindia.com/option-chain")
        r = cl.get(
            "https://www.nseindia.com/api/option-chain-v3",
            params={"type": kind, "symbol": symbol, "expiry": expiry},
        )
        r.raise_for_status()
        payload = r.json()
    records = payload.get("records") or {}
    if not records.get("data"):
        return None
    return payload


# --- market depth (best-effort — see docs/phase-8.md) --------------------------


@safe(default=None, label="market depth")
def market_depth(symbol: str) -> dict | None:
    """Live L2 snapshot from the quote-equity endpoint. This is the one NSE endpoint
    that has come back hard-blocked (Akamai 403, not the usual bot-check) in testing —
    unlike every other endpoint in this file. Wrapped in safe() same as everything
    else: if it's blocked in production too, the depth card just never populates
    rather than breaking the chart page."""
    headers = {
        "User-Agent": _UA,
        "Accept": "application/json, text/plain, */*",
        "Referer": f"https://www.nseindia.com/get-quotes/equity?symbol={symbol}",
    }
    with httpx.Client(headers=headers, timeout=HTTP_TIMEOUT, follow_redirects=True) as cl:
        cl.get("https://www.nseindia.com")
        r = cl.get("https://www.nseindia.com/api/quote-equity", params={"symbol": symbol, "section": "trade_info"})
        r.raise_for_status()
        payload = r.json()
    depth = (payload.get("marketDeptOrderBook") or {}) if isinstance(payload, dict) else {}
    if not depth.get("bid") and not depth.get("ask"):
        return None
    return {
        "bid": depth.get("bid", []),
        "ask": depth.get("ask", []),
        "total_buy_qty": depth.get("totalBuyQuantity"),
        "total_sell_qty": depth.get("totalSellQuantity"),
        "vwap": (payload.get("tradeInfo") or {}).get("vwap") if isinstance(payload.get("tradeInfo"), dict) else None,
    }


# --- corporate financial results (for filing verification) ---------------------


@safe(default=list, label="corporate financial results")
def financial_results(symbol: str) -> list[dict]:
    """Every quarterly/annual result filing disclosed for one symbol, newest first —
    each row carries a direct link to the XBRL attachment (jobs/filing_verify.py
    parses it for the handful of tags we verify)."""
    headers = {
        "User-Agent": _UA,
        "Accept": "application/json, text/plain, */*",
        "Referer": "https://www.nseindia.com/companies-listing/corporate-filings-financial-results",
    }
    with httpx.Client(headers=headers, timeout=HTTP_TIMEOUT, follow_redirects=True) as cl:
        cl.get("https://www.nseindia.com")
        r = cl.get(
            "https://www.nseindia.com/api/corporates-financial-results",
            params={"index": "equities", "symbol": symbol, "period": "Quarterly"},
        )
        r.raise_for_status()
        rows = r.json()
    return rows if isinstance(rows, list) else []


@safe(default=None, label="XBRL financial result")
def xbrl_financials(url: str) -> dict | None:
    """Revenue / net profit / basic EPS for the quarter, parsed out of one XBRL filing.
    NSE's own in-bse-fin taxonomy tags — 'OneD' is the standalone-quarter context on
    every filing seen so far, not a company-specific quirk."""
    import re

    with httpx.Client(headers={"User-Agent": _UA}, timeout=HTTP_TIMEOUT, follow_redirects=True) as cl:
        r = cl.get(url)
        r.raise_for_status()
        text = r.text

    def tag(name: str) -> float | None:
        m = re.search(rf'<in-bse-fin:{name}[^>]*contextRef="OneD"[^>]*>([^<]*)</', text)
        return _num(m.group(1)) if m else None

    revenue = tag("RevenueFromOperations")
    net_profit = tag("ProfitLossForPeriod")
    eps = tag("BasicEarningsLossPerShareFromContinuingAndDiscontinuedOperations")
    if revenue is None and net_profit is None and eps is None:
        return None
    return {"revenue": revenue, "net_profit": net_profit, "eps": eps}
