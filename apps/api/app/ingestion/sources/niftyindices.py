from __future__ import annotations

import logging
from io import StringIO

import httpx
import pandas as pd

from app.ingestion.sources.cache import raw_cache_path

log = logging.getLogger("swing.ingest.niftyindices")

BASE = "https://niftyindices.com/IndexConstituent"

# NSE index symbol -> the niftyindices.com constituent CSV file.
CSV_FILE: dict[str, str] = {
    "NIFTY 50": "ind_nifty50list.csv",
    "NIFTY NEXT 50": "ind_niftynext50list.csv",
    "NIFTY 100": "ind_nifty100list.csv",
    "NIFTY 200": "ind_nifty200list.csv",
    "NIFTY 500": "ind_nifty500list.csv",
    "NIFTY MIDCAP 150": "ind_niftymidcap150list.csv",
    "NIFTY SMALLCAP 250": "ind_niftysmallcap250list.csv",
    "NIFTY AUTO": "ind_niftyautolist.csv",
    "NIFTY BANK": "ind_niftybanklist.csv",
    "NIFTY FINANCIAL SERVICES": "ind_niftyfinancialservices25_50list.csv",
    "NIFTY FMCG": "ind_niftyfmcglist.csv",
    "NIFTY HEALTHCARE INDEX": "ind_niftyhealthcarelist.csv",
    "NIFTY IT": "ind_niftyitlist.csv",
    "NIFTY MEDIA": "ind_niftymedialist.csv",
    "NIFTY METAL": "ind_niftymetallist.csv",
    "NIFTY OIL & GAS": "ind_niftyoilgaslist.csv",
    "NIFTY PHARMA": "ind_niftypharmalist.csv",
    "NIFTY PSU BANK": "ind_niftypsubanklist.csv",
    "NIFTY PRIVATE BANK": "ind_nifty_privatebanklist.csv",
    "NIFTY REALTY": "ind_niftyrealtylist.csv",
    "NIFTY CONSUMER DURABLES": "ind_niftyconsumerdurableslist.csv",
    "NIFTY CAPITAL MARKETS": "ind_niftycapitalmarketslist.csv",
}

_HEADERS = {"User-Agent": "Mozilla/5.0", "Referer": "https://niftyindices.com/"}


def constituents(index_symbol: str, *, use_cache: bool = True) -> list[str]:
    """List of NSE symbols in ``index_symbol``. Returns [] on any failure."""
    fname = CSV_FILE.get(index_symbol)
    if not fname:
        return []
    cache = raw_cache_path("index_constituents", index_symbol)
    if use_cache and cache.exists() and cache.stat().st_size > 0:
        df = pd.read_csv(cache)
    else:
        try:
            r = httpx.get(f"{BASE}/{fname}", headers=_HEADERS, timeout=20, follow_redirects=True)
            r.raise_for_status()
            df = pd.read_csv(StringIO(r.text))
            cache.write_text(r.text)
        except Exception as exc:  # noqa: BLE001
            log.warning("constituents for %s failed: %s", index_symbol, exc)
            return []

    col = next((c for c in df.columns if c.strip().lower() == "symbol"), None)
    if col is None:
        return []
    return [str(s).strip().upper() for s in df[col] if str(s).strip()]
