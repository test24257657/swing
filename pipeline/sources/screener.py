"""
pipeline/sources/screener.py
Screener.in fundamental data scraper.
Runs weekly (Sunday) to update EPS, revenue, ROCE, FII/DII shareholding.

Rate-limited to SCREENER_BATCH_SIZE requests per session with sleep between batches.
Never raises through to caller — partial data is valid output.
"""

from __future__ import annotations

import logging
import time
from typing import Optional

import polars as pl

from pipeline.config import SCREENER_BATCH_SIZE, SCREENER_RATE_LIMIT_SLEEP

log = logging.getLogger("pipeline.sources.screener")

_SCREENER_BASE = "https://www.screener.in"
_SCREENER_API = f"{_SCREENER_BASE}/api/company"

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://www.screener.in/",
}


def fetch_fundamentals(symbols: list[str]) -> pl.DataFrame:
    """
    Fetch fundamentals for a list of NSE symbols from Screener.in.

    Returns DataFrame with columns:
        symbol, eps, eps_qoq, eps_yoy, revenue, revenue_qoq, revenue_yoy,
        roce, roe, debt_equity, promoter_holding, promoter_pledge,
        fii_holding, fii_qoq, dii_holding, dii_qoq

    Symbols that fail are omitted (partial is valid).
    """
    results = []
    total = len(symbols)

    for i in range(0, total, SCREENER_BATCH_SIZE):
        batch = symbols[i:i + SCREENER_BATCH_SIZE]
        log.info(
            "Screener.in: fetching batch %d/%d (%d symbols)",
            i // SCREENER_BATCH_SIZE + 1,
            (total + SCREENER_BATCH_SIZE - 1) // SCREENER_BATCH_SIZE,
            len(batch),
        )
        for symbol in batch:
            data = _fetch_one(symbol)
            if data:
                results.append(data)

        if i + SCREENER_BATCH_SIZE < total:
            time.sleep(SCREENER_RATE_LIMIT_SLEEP)

    if not results:
        log.warning("Screener.in: no data fetched for any symbol")
        return pl.DataFrame()

    return pl.DataFrame(results)


def _fetch_one(symbol: str) -> Optional[dict]:
    """Fetch fundamentals for a single symbol from Screener.in."""
    try:
        try:
            from curl_cffi import requests as cf_requests  # type: ignore
            session = cf_requests.Session(impersonate="chrome120")
        except ImportError:
            import requests
            session = requests.Session()
            session.headers.update(_HEADERS)

        # Screener.in company page (HTML) — we parse the JSON embedded in meta tags
        url = f"{_SCREENER_BASE}/company/{symbol}/consolidated/"
        resp = session.get(url, headers=_HEADERS, timeout=20)

        if resp.status_code == 404:
            # Try standalone (non-consolidated)
            url = f"{_SCREENER_BASE}/company/{symbol}/"
            resp = session.get(url, headers=_HEADERS, timeout=20)

        if resp.status_code != 200:
            log.debug("Screener.in %s: HTTP %d", symbol, resp.status_code)
            return None

        return _parse_screener_html(symbol, resp.text)

    except Exception as exc:
        log.debug("Screener.in %s: %s", symbol, exc)
        return None


def _parse_screener_html(symbol: str, html: str) -> Optional[dict]:
    """
    Parse Screener.in company page HTML for key metrics:
    - Ratios: ROCE, ROE, Debt to Equity
    - Quarters table (#quarters): Sales (QoQ, YoY), EPS (QoQ, YoY), OPM
    - Shareholding table (#shareholding): Promoter, FII, DII (holding & QoQ change)
    """
    try:
        from bs4 import BeautifulSoup
        import re

        soup = BeautifulSoup(html, "html.parser")
        result: dict = {"symbol": symbol}

        # 1. Key ratios in #top-ratios or li items
        patterns = {
            "roce": r'ROCE[^<]*<span[^>]*>\s*([\d.]+)\s*%',
            "roe": r'ROE[^<]*<span[^>]*>\s*([\d.]+)\s*%',
            "debt_equity": r'Debt\s*/\s*Equity[^<]*<span[^>]*>\s*([\d.]+)',
        }
        for key, pattern in patterns.items():
            m = re.search(pattern, html, re.IGNORECASE | re.DOTALL)
            if m:
                try:
                    result[key] = float(m.group(1))
                except ValueError:
                    pass

        # 2. Parse #quarters table
        quarters_sec = soup.find("section", id="quarters")
        if quarters_sec:
            table = quarters_sec.find("table")
            if table:
                rows = table.find_all("tr")
                for tr in rows:
                    cells = [td.get_text(strip=True).replace(",", "") for td in tr.find_all(["td", "th"])]
                    if not cells:
                        continue
                    label = cells[0].lower()
                    values = []
                    for c in cells[1:]:
                        try:
                            val_str = re.sub(r'[^\d.-]', '', c)
                            if val_str:
                                values.append(float(val_str))
                        except ValueError:
                            pass

                    if len(values) >= 2:
                        latest_v = values[-1]
                        prev_qoq = values[-2]
                        prev_yoy = values[-5] if len(values) >= 5 else None

                        if "sales" in label or "revenue" in label:
                            result["revenue"] = latest_v
                            if prev_qoq != 0:
                                result["revenue_qoq"] = round((latest_v - prev_qoq) / abs(prev_qoq) * 100, 2)
                            if prev_yoy and prev_yoy != 0:
                                result["revenue_yoy"] = round((latest_v - prev_yoy) / abs(prev_yoy) * 100, 2)

                        elif "eps" in label:
                            result["eps"] = latest_v
                            if prev_qoq != 0:
                                result["eps_qoq"] = round((latest_v - prev_qoq) / abs(prev_qoq) * 100, 2)
                            if prev_yoy and prev_yoy != 0:
                                result["eps_yoy"] = round((latest_v - prev_yoy) / abs(prev_yoy) * 100, 2)

                        elif "opm" in label:
                            result["opm"] = latest_v

        # 3. Parse #shareholding table
        sh_sec = soup.find("section", id="shareholding")
        if sh_sec:
            table = sh_sec.find("table")
            if table:
                rows = table.find_all("tr")
                for tr in rows:
                    cells = [td.get_text(strip=True).replace(",", "") for td in tr.find_all(["td", "th"])]
                    if not cells:
                        continue
                    label = cells[0].lower()
                    values = []
                    for c in cells[1:]:
                        try:
                            val_str = re.sub(r'[^\d.-]', '', c)
                            if val_str:
                                values.append(float(val_str))
                        except ValueError:
                            pass

                    if len(values) >= 2:
                        latest_sh = values[-1]
                        prev_sh = values[-2]
                        qoq_diff = round(latest_sh - prev_sh, 2)

                        if "promoter" in label:
                            result["promoter_holding"] = latest_sh
                            result["promoter_change"] = qoq_diff
                        elif "fii" in label:
                            result["fii_holding"] = latest_sh
                            result["fii_qoq"] = qoq_diff
                        elif "dii" in label:
                            result["dii_holding"] = latest_sh
                            result["dii_qoq"] = qoq_diff

        # Fallbacks from regex if tables weren't parsed
        if result.get("promoter_holding") is None:
            m = re.search(r'Promoters?\s*[^\d]+([\d.]+)\s*%', html, re.I)
            if m:
                result["promoter_holding"] = float(m.group(1))
        if result.get("fii_holding") is None:
            m = re.search(r'FIIs?\s*[^\d]+([\d.]+)\s*%', html, re.I)
            if m:
                result["fii_holding"] = float(m.group(1))
        if result.get("dii_holding") is None:
            m = re.search(r'DIIs?\s*[^\d]+([\d.]+)\s*%', html, re.I)
            if m:
                result["dii_holding"] = float(m.group(1))

        if len(result) <= 1:
            return None

        # Fill missing fields with None
        for field in [
            "eps", "eps_qoq", "eps_yoy",
            "revenue", "revenue_qoq", "revenue_yoy", "opm",
            "roce", "roe", "debt_equity", "current_ratio",
            "promoter_holding", "promoter_change", "promoter_pledge",
            "fii_holding", "fii_qoq", "dii_holding", "dii_qoq",
        ]:
            result.setdefault(field, None)

        return result

    except Exception as exc:
        log.debug("Screener.in parse error for %s: %s", symbol, exc)
        return None


def fetch_screener_json(symbol: str) -> Optional[dict]:
    """
    Fetch from Screener.in's JSON API endpoint.
    Returns raw dict or None on failure.
    """
    try:
        try:
            from curl_cffi import requests as cf_requests  # type: ignore
            session = cf_requests.Session(impersonate="chrome120")
        except ImportError:
            import requests
            session = requests.Session()
            session.headers.update(_HEADERS)

        # Get CSRF token first
        resp = session.get(f"{_SCREENER_BASE}/login/", timeout=15)
        csrf = _extract_csrf(resp.text)

        # Login with credentials if available
        # (Screener.in free tier works without login for most data)

        url = f"{_SCREENER_API}/{symbol}/"
        resp = session.get(url, headers={**_HEADERS, "X-CSRFToken": csrf}, timeout=20)
        if resp.status_code == 200:
            return resp.json()

        return None

    except Exception as exc:
        log.debug("Screener.in JSON API %s: %s", symbol, exc)
        return None


def _extract_csrf(html: str) -> str:
    """Extract CSRF token from Screener.in login page."""
    import re
    m = re.search(r'csrfmiddlewaretoken.*?value=["\']([^"\']+)', html)
    return m.group(1) if m else ""
