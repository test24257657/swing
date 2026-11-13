"""
pipeline/sources/angel_one.py
Angel One SmartAPI — Auth + Historical OHLCV (D / W / M).

Usage:
    from pipeline.sources.angel_one import AngelOneClient, fetch_ohlcv

    client = AngelOneClient()
    bars = client.fetch_ohlcv("RELIANCE", "NSE", interval="ONE_DAY", years=2)
"""
from __future__ import annotations

import json
import logging
import os
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Literal

import pyotp

logger = logging.getLogger(__name__)

# ─── Env / paths ──────────────────────────────────────────────────────────────
_ROOT = Path(__file__).resolve().parent.parent.parent
_ENV_PATH = _ROOT / ".env"
_SESSION_CACHE = _ROOT / "data" / ".angel_session.json"

# Load .env manually so this module works standalone too
def _load_env():
    if not _ENV_PATH.exists():
        return
    for line in _ENV_PATH.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = val

_load_env()

ANGEL_API_KEY    = os.environ.get("API_KEY", "")
ANGEL_CLIENT_ID  = os.environ.get("CLIENT_ID", "")
ANGEL_PIN        = os.environ.get("PIN", "")
ANGEL_TOTP_SECRET = os.environ.get("TOTP_SECRET", "")

# ─── Interval map ─────────────────────────────────────────────────────────────
# Angel One historical API ONLY supports ONE_DAY resolution.
# Weekly and Monthly are computed by aggregating daily candles client-side.
INTERVAL_MAP = {
    "D": "ONE_DAY",
    "W": "ONE_DAY",   # fetch daily, aggregate to weekly
    "M": "ONE_DAY",   # fetch daily, aggregate to monthly
    "ONE_DAY":   "ONE_DAY",
    "ONE_WEEK":  "ONE_DAY",
    "ONE_MONTH": "ONE_DAY",
}

# Angel One max date range per call (ONE_DAY = max 1 year per request)
MAX_DAYS = {
    "ONE_DAY": 365,
}


class AngelOneClient:
    """
    Thin wrapper around SmartConnect that:
    - auto-generates TOTP
    - caches the session token to disk (valid ~24 h)
    - exposes `fetch_ohlcv()` for D / W / M candles
    """

    def __init__(self):
        from SmartApi import SmartConnect  # type: ignore
        self._SmartConnect = SmartConnect
        self._api: SmartConnect | None = None
        self._ensure_session()

    # ── Auth ──────────────────────────────────────────────────────────────────

    def _generate_totp(self) -> str:
        return pyotp.TOTP(ANGEL_TOTP_SECRET).now()

    def _load_cached_session(self) -> bool:
        """Return True if a valid cached token is loaded."""
        try:
            if not _SESSION_CACHE.exists():
                return False
            data = json.loads(_SESSION_CACHE.read_text())
            saved_at = datetime.fromisoformat(data["saved_at"])
            if datetime.now() - saved_at > timedelta(hours=23):
                logger.info("Angel One session expired, re-logging in.")
                return False
            # Re-create SmartConnect with cached token
            api = self._SmartConnect(api_key=ANGEL_API_KEY)
            # Strip "Bearer " prefix if present (SmartConnect stores raw JWT)
            raw_token = data["access_token"]
            if raw_token.startswith("Bearer "):
                raw_token = raw_token[len("Bearer "):]
            api.setAccessToken(raw_token)
            api.refresh_token = data["refresh_token"]
            api.feed_token = data.get("feed_token", "")
            self._api = api
            logger.info("Angel One: loaded cached session.")
            return True
        except Exception as exc:
            logger.warning(f"Could not load cached session: {exc}")
            return False

    def _login(self):
        totp = self._generate_totp()
        api = self._SmartConnect(api_key=ANGEL_API_KEY)
        resp = api.generateSession(ANGEL_CLIENT_ID, ANGEL_PIN, totp)
        if not resp or resp.get("status") is False:
            raise RuntimeError(f"Angel One login failed: {resp}")
        # generateSession sets api.access_token automatically (raw JWT)
        api.refresh_token = resp.get("data", {}).get("refreshToken", "")
        try:
            api.feed_token = api.getfeedToken()
        except Exception:
            api.feed_token = ""
        self._api = api
        # Cache raw values
        _SESSION_CACHE.parent.mkdir(parents=True, exist_ok=True)
        _SESSION_CACHE.write_text(json.dumps({
            "access_token": api.access_token,   # raw JWT (no "Bearer " prefix)
            "refresh_token": api.refresh_token,
            "feed_token": api.feed_token,
            "saved_at": datetime.now().isoformat(),
        }))
        logger.info("Angel One: new session created and cached.")

    def _ensure_session(self):
        if not self._load_cached_session():
            self._login()

    # ── Scrip master ──────────────────────────────────────────────────────────

    def _get_scrip_master(self) -> dict[str, str]:
        """
        Returns {EXCHANGE:SYMBOL -> token} mapping.
        Downloads once per day and caches to data/scrip_master.json.
        """
        cache_path = _ROOT / "data" / "scrip_master.json"
        if cache_path.exists():
            age_hours = (time.time() - cache_path.stat().st_mtime) / 3600
            if age_hours < 20:
                return json.loads(cache_path.read_text())

        import urllib.request
        url = "https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json"
        logger.info("Downloading Angel One scrip master...")
        try:
            with urllib.request.urlopen(url, timeout=30) as r:
                raw = json.loads(r.read())
        except Exception as exc:
            logger.warning(f"Could not download scrip master: {exc}")
            if cache_path.exists():
                return json.loads(cache_path.read_text())
            return {}

        mapping: dict[str, str] = {}
        for entry in raw:
            exch = entry.get("exch_seg", "")
            sym  = entry.get("symbol", "").upper()
            tok  = entry.get("token", "")
            if exch and sym and tok:
                mapping[f"{exch}:{sym}"] = tok
                # Also store bare symbol for NSE
                if exch == "NSE":
                    mapping[sym] = tok

        cache_path.parent.mkdir(parents=True, exist_ok=True)
        cache_path.write_text(json.dumps(mapping))
        logger.info(f"Scrip master cached: {len(mapping)} entries.")
        return mapping

    def _resolve_token(self, symbol: str, exchange: str) -> str | None:
        master = self._get_scrip_master()
        # Try NSE-EQ suffix first (most equities)
        for suffix in ["-EQ", ""]:
            key = f"{exchange}:{symbol.upper()}{suffix}"
            if key in master:
                return master[key]
        # Fallback: bare symbol
        if symbol.upper() in master:
            return master[symbol.upper()]
        return None

    # ── OHLCV ─────────────────────────────────────────────────────────────────

    def fetch_ohlcv(
        self,
        symbol: str,
        exchange: str = "NSE",
        interval: Literal["D", "W", "M", "ONE_DAY", "ONE_WEEK", "ONE_MONTH"] = "D",
        years: int = 2,
    ) -> list[dict]:
        """
        Fetch historical OHLCV candles from Angel One.
        Always fetches ONE_DAY from Angel One, then aggregates to W/M client-side.
        Returns list of dicts: {time, open, high, low, close, volume}
        """
        # Normalize interval to D/W/M
        norm = interval.upper()
        if norm in ("ONE_DAY",):   norm = "D"
        if norm in ("ONE_WEEK",):  norm = "W"
        if norm in ("ONE_MONTH",): norm = "M"

        token = self._resolve_token(symbol, exchange)
        if not token:
            logger.warning(f"No token found for {exchange}:{symbol}")
            return []

        # Fetch full history (default 10 years)
        end_dt = datetime.now()
        start_dt = end_dt - timedelta(days=365 * years)
        max_window = 365  # Angel One ONE_DAY: max 1 year per call

        all_bars: list[dict] = []
        chunk_start = start_dt

        while chunk_start < end_dt:
            chunk_end = min(chunk_start + timedelta(days=max_window), end_dt)
            params = {
                "exchange": exchange,
                "symboltoken": token,
                "interval": "ONE_DAY",
                "fromdate": chunk_start.strftime("%Y-%m-%d %H:%M"),
                "todate": chunk_end.strftime("%Y-%m-%d %H:%M"),
            }
            try:
                resp = self._api.getCandleData(params)
                if resp and resp.get("status") and resp.get("data"):
                    for row in resp["data"]:
                        if len(row) < 6:
                            continue
                        dt_str = row[0][:10]  # "YYYY-MM-DD"
                        all_bars.append({
                            "time":   dt_str,
                            "open":   float(row[1]),
                            "high":   float(row[2]),
                            "low":    float(row[3]),
                            "close":  float(row[4]),
                            "volume": int(row[5]),
                        })
            except Exception as exc:
                logger.warning(f"getCandleData failed for {symbol} chunk {chunk_start}: {exc}")

            chunk_start = chunk_end + timedelta(days=1)
            time.sleep(0.4)  # stay under 3 req/s limit

        # Deduplicate by date, sort ascending
        seen: set[str] = set()
        daily: list[dict] = []
        for bar in sorted(all_bars, key=lambda x: x["time"]):
            if bar["time"] not in seen:
                seen.add(bar["time"])
                daily.append(bar)

        if norm == "D":
            return daily
        elif norm == "W":
            return self._aggregate_weekly(daily)
        else:  # M
            return self._aggregate_monthly(daily)

    # ── Aggregation ───────────────────────────────────────────────────────────

    @staticmethod
    def _aggregate_weekly(daily: list[dict]) -> list[dict]:
        """Group daily bars into ISO week candles (Monday date as key)."""
        from collections import defaultdict
        buckets: dict[str, list[dict]] = defaultdict(list)
        for bar in daily:
            y, m, d = map(int, bar["time"].split("-"))
            dt = __import__("datetime").date(y, m, d)
            # ISO week Monday
            monday = dt - __import__("datetime").timedelta(days=dt.weekday())
            buckets[monday.isoformat()].append(bar)
        result = []
        for week_start in sorted(buckets):
            bars = buckets[week_start]
            result.append({
                "time":   week_start,
                "open":   bars[0]["open"],
                "high":   max(b["high"] for b in bars),
                "low":    min(b["low"]  for b in bars),
                "close":  bars[-1]["close"],
                "volume": sum(b["volume"] for b in bars),
            })
        return result

    @staticmethod
    def _aggregate_monthly(daily: list[dict]) -> list[dict]:
        """Group daily bars into monthly candles (first trading day as key)."""
        from collections import defaultdict
        buckets: dict[str, list[dict]] = defaultdict(list)
        for bar in daily:
            month_key = bar["time"][:7] + "-01"  # YYYY-MM-01
            buckets[month_key].append(bar)
        result = []
        for month_key in sorted(buckets):
            bars = buckets[month_key]
            result.append({
                "time":   bars[0]["time"],   # first actual trading day
                "open":   bars[0]["open"],
                "high":   max(b["high"] for b in bars),
                "low":    min(b["low"]  for b in bars),
                "close":  bars[-1]["close"],
                "volume": sum(b["volume"] for b in bars),
            })
        return result


# ─── Standalone helper (called from get_stock_bars.py) ────────────────────────

def fetch_bars_for_symbol(
    symbol: str,
    interval: str = "D",
    years: int = 2,
) -> list[dict]:
    """
    Public entry point: returns OHLCV bars for one symbol.
    Adds SMA20 / SMA50 / SMA200 / EMA21 overlay columns.
    
    For W/M: fetches 2Y daily bars and aggregates client-side.
    Angel One historical API only supports ONE_DAY resolution.
    """
    # Normalize
    norm = interval.upper()
    if norm in ("ONE_DAY", "DAILY"):    norm = "D"
    if norm in ("ONE_WEEK", "WEEKLY"):  norm = "W"
    if norm in ("ONE_MONTH", "MONTHLY"): norm = "M"

    client = AngelOneClient()
    bars = client.fetch_ohlcv(symbol, exchange="NSE", interval=norm, years=years)
    if not bars:
        # Try BSE fallback
        bars = client.fetch_ohlcv(symbol, exchange="BSE", interval=norm, years=years)
    if not bars:
        return []

    # Compute MAs inline (no pandas needed — simple rolling)
    closes = [b["close"] for b in bars]

    def sma(arr: list[float], period: int, idx: int) -> float | None:
        if idx < period - 1:
            return None
        window = arr[idx - period + 1 : idx + 1]
        return round(sum(window) / period, 2)

    def ema(arr: list[float], period: int) -> list[float | None]:
        result: list[float | None] = [None] * len(arr)
        k = 2 / (period + 1)
        # Seed with SMA
        if len(arr) < period:
            return result
        result[period - 1] = sum(arr[:period]) / period
        for i in range(period, len(arr)):
            prev = result[i - 1]
            if prev is None:
                result[i] = None
            else:
                result[i] = round(arr[i] * k + prev * (1 - k), 2)
        return result

    ema21 = ema(closes, 21)

    for i, bar in enumerate(bars):
        bar["sma20"]  = sma(closes, 20, i)
        bar["sma50"]  = sma(closes, 50, i)
        bar["sma200"] = sma(closes, 200, i)
        bar["ema21"]  = ema21[i]

    return bars


# ─── CLI self-test ────────────────────────────────────────────────────────────

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    sym = sys.argv[1] if len(sys.argv) > 1 else "RELIANCE"
    tf  = sys.argv[2] if len(sys.argv) > 2 else "D"
    print(f"Testing Angel One OHLCV for {sym} [{tf}]...")
    bars = fetch_bars_for_symbol(sym, interval=tf)
    print(f"Got {len(bars)} bars")
    if bars:
        print("First:", bars[0])
        print("Last: ", bars[-1])
