"""
pipeline/run_morning.py
Master 8:30 AM IST orchestrator — Morning Brief.

Steps:
  1. Fetch global cues (S&P500, Nasdaq, Nikkei, Brent, Gold, USD/INR)
  2. Fetch NIFTY levels + pivot points
  3. Load top setups from Neon DB
  4. Load RRG sector snapshot from DB
  5. Load FII/DII flow data
  6. Call Gemini for Morning Brief (1 call)
  7. Store brief in Neon DB
  8. Send Telegram morning alert
"""

from __future__ import annotations

import json
import logging
import sys
import urllib.request
from datetime import date
from zoneinfo import ZoneInfo

from pipeline.config import IST_TZ, DIRECT_URL

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger("pipeline.morning")

IST = ZoneInfo(IST_TZ)

# Yahoo Finance tickers for global cues
_GLOBAL_TICKERS = {
    "sp500":   "^GSPC",
    "nasdaq":  "^IXIC",
    "dow":     "^DJI",
    "nikkei":  "^N225",
    "hangseng": "^HSI",
    "brent":   "BZ=F",
    "gold":    "GC=F",
    "usdinr":  "USDINR=X",
    "us10y":   "^TNX",
}


def main() -> None:
    today = date.today()
    log.info("Morning Brief pipeline — %s", today)

    # ── Step 1: Global cues ───────────────────────────────────────────────────
    log.info("[1/8] Fetching global cues from Yahoo Finance...")
    global_cues = _fetch_global_cues()
    log.info("Global cues: %s", global_cues)

    # ── Step 2: NIFTY levels ──────────────────────────────────────────────────
    log.info("[2/8] Computing NIFTY levels...")
    nifty_levels = _compute_nifty_levels()

    # ── Step 3: Top setups from DB ────────────────────────────────────────────
    log.info("[3/8] Loading top setups from Neon DB...")
    top_setups = _load_top_setups()

    # ── Step 4: RRG snapshot ──────────────────────────────────────────────────
    log.info("[4/8] Loading RRG sector snapshot from DB...")
    rrg_snapshot = _load_rrg_snapshot()

    # ── Step 5: FII/DII flows ─────────────────────────────────────────────────
    log.info("[5/8] Loading FII/DII flow data...")
    flows = _load_fii_dii_flows()

    # ── Step 6: Call Gemini ───────────────────────────────────────────────────
    log.info("[6/8] Calling Gemini for Morning Brief...")
    context = {
        "date": str(today),
        "global_cues": global_cues,
        "nifty_levels": nifty_levels,
        "sector_rrg": rrg_snapshot,
        "fii_10d_net": flows.get("fii_10d"),
        "dii_10d_net": flows.get("dii_10d"),
        "top_setups": top_setups[:5],
        "india_vix": nifty_levels.get("vix"),
    }

    from pipeline.ai.gemini import generate_morning_brief
    brief = generate_morning_brief(context)

    if brief:
        brief["date"] = str(today)
        brief["context"] = context
        log.info("Morning Brief generated: %s", brief.get("headline", ""))
    else:
        brief = {
            "date": str(today),
            "headline": f"Morning Brief — {today.strftime('%d %b %Y')}",
            "bullets": [
                f"Global: S&P500 {global_cues.get('sp500_chg', '?')}%",
                f"NIFTY pivot: {nifty_levels.get('pivot', '?')}",
                f"FII 10d net: ₹{flows.get('fii_10d', 0):+,.0f} Cr",
            ],
            "bias": "Neutral",
            "context": context,
        }
        log.warning("Gemini unavailable — using rule-based brief")

    # ── Step 7: Store in Neon DB ──────────────────────────────────────────────
    log.info("[7/8] Storing Morning Brief in Neon DB...")
    from pipeline import db
    db.upsert_ai_intelligence(
        cache_key=f"morning_brief_{today}",
        category="MORNING_BRIEF",
        content=brief,
        ttl_days=1,
    )

    # ── Step 8: Telegram ──────────────────────────────────────────────────────
    log.info("[8/8] Sending Telegram morning alert...")
    from pipeline.notify.telegram import send_morning_alert
    send_morning_alert(brief)

    log.info("Morning Brief pipeline complete")


def _fetch_global_cues() -> dict:
    """Fetch last-close values for global indices via yfinance."""
    try:
        import yfinance as yf  # type: ignore
        result = {}
        tickers = yf.Tickers(" ".join(_GLOBAL_TICKERS.values()))
        for key, ticker_sym in _GLOBAL_TICKERS.items():
            try:
                hist = tickers.tickers[ticker_sym].history(period="2d")
                if len(hist) >= 1:
                    last_close = hist["Close"].iloc[-1]
                    prev_close = hist["Close"].iloc[-2] if len(hist) >= 2 else last_close
                    chg_pct = (last_close - prev_close) / prev_close * 100 if prev_close else 0
                    result[key] = round(float(last_close), 2)
                    result[f"{key}_chg"] = round(float(chg_pct), 2)
            except Exception:
                pass
        return result
    except Exception as exc:
        log.warning("Global cues fetch failed: %s", exc)
        return {}


def _compute_nifty_levels() -> dict:
    """Compute NIFTY 50 floor pivot levels from yesterday's OHLC."""
    try:
        import yfinance as yf  # type: ignore
        hist = yf.Ticker("^NSEI").history(period="5d")
        if hist.empty:
            return {}

        prev = hist.iloc[-2] if len(hist) >= 2 else hist.iloc[-1]
        h, l, c = float(prev["High"]), float(prev["Low"]), float(prev["Close"])
        pivot = (h + l + c) / 3
        r1 = 2 * pivot - l
        r2 = pivot + (h - l)
        s1 = 2 * pivot - h
        s2 = pivot - (h - l)

        # SMA levels
        sma50 = float(hist["Close"].rolling(50).mean().dropna().iloc[-1]) if len(hist) >= 50 else None
        sma200 = float(hist["Close"].rolling(200).mean().dropna().iloc[-1]) if len(hist) >= 200 else None

        return {
            "spot": round(float(hist["Close"].iloc[-1]), 2),
            "pivot": round(pivot, 2),
            "r1": round(r1, 2),
            "r2": round(r2, 2),
            "s1": round(s1, 2),
            "s2": round(s2, 2),
            "sma50": round(sma50, 2) if sma50 else None,
            "sma200": round(sma200, 2) if sma200 else None,
            "vix": _fetch_vix(),
        }
    except Exception as exc:
        log.warning("NIFTY levels failed: %s", exc)
        return {}


def _fetch_vix() -> float | None:
    """Fetch India VIX."""
    try:
        import yfinance as yf  # type: ignore
        hist = yf.Ticker("^INDIAVIX").history(period="2d")
        if not hist.empty:
            return round(float(hist["Close"].iloc[-1]), 2)
    except Exception:
        pass
    return None


def _load_top_setups() -> list[dict]:
    """Load today's top pattern signals from Neon DB."""
    try:
        import psycopg2  # type: ignore
        conn = psycopg2.connect(DIRECT_URL)
        cur = conn.cursor()
        cur.execute("""
            SELECT ps.symbol, ps."setupType", ps."pivotPrice", ps."stopLossPrice",
                   lt."technoFundaScore", lt."weinsteinStage", lt."rsRating"
            FROM pattern_signals ps
            LEFT JOIN latest_technicals lt ON lt.symbol = ps.symbol
            WHERE ps."tradeDate" >= NOW() - INTERVAL '2 days'
            ORDER BY lt."technoFundaScore" DESC NULLS LAST
            LIMIT 15
        """)
        rows = cur.fetchall()
        conn.close()
        return [
            {
                "symbol": r[0],
                "pattern": r[1],
                "pivot": r[2],
                "stop": r[3],
                "composite_score": r[4],
                "stage": r[5],
                "rs": r[6],
            }
            for r in rows
        ]
    except Exception as exc:
        log.warning("Top setups load failed: %s", exc)
        return []


def _load_rrg_snapshot() -> dict:
    """Load the latest RRG sector snapshot from market_breadth_and_sector."""
    try:
        import psycopg2  # type: ignore
        conn = psycopg2.connect(DIRECT_URL)
        cur = conn.cursor()
        cur.execute("""
            SELECT "sectorRrgJson" FROM market_breadth_and_sector
            ORDER BY "tradeDate" DESC LIMIT 1
        """)
        row = cur.fetchone()
        conn.close()
        if row and row[0]:
            return json.loads(row[0]) if isinstance(row[0], str) else row[0]
    except Exception as exc:
        log.warning("RRG snapshot load failed: %s", exc)
    return {}


def _load_fii_dii_flows() -> dict:
    """Load the 10-session FII/DII net flows from DB."""
    try:
        import psycopg2  # type: ignore
        conn = psycopg2.connect(DIRECT_URL)
        cur = conn.cursor()
        cur.execute("""
            SELECT SUM("fiiNetCr"), SUM("diiNetCr")
            FROM market_breadth_and_sector
            WHERE "tradeDate" >= NOW() - INTERVAL '14 days'
        """)
        row = cur.fetchone()
        conn.close()
        if row:
            return {"fii_10d": row[0] or 0, "dii_10d": row[1] or 0}
    except Exception as exc:
        log.warning("FII/DII flow load failed: %s", exc)
    return {"fii_10d": 0, "dii_10d": 0}


if __name__ == "__main__":
    main()
