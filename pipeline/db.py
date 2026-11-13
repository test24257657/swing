"""
pipeline/db.py
Neon PostgreSQL batch upsert & rolling retention cleanup.
Directly aligned with prisma/schema.prisma models.

Uses psycopg2 with DIRECT_URL (non-pooled) for batch writes.
"""

from __future__ import annotations

import json
import logging
import uuid
from contextlib import contextmanager
from datetime import date, datetime, timedelta
from typing import Any, Optional

import psycopg2  # type: ignore
from psycopg2.extras import execute_batch  # type: ignore

import polars as pl

from pipeline.config import (
    DIRECT_URL,
    PATTERN_RETENTION_DAYS,
    INSTITUTIONAL_RETENTION_DAYS,
    BREADTH_RETENTION_DAYS,
    AI_RETENTION_DAYS,
    SPARKLINE_DAYS,
)

log = logging.getLogger("pipeline.db")


@contextmanager
def _conn():
    """Yield a psycopg2 connection; commits on success, rolls back on error."""
    import psycopg2  # type: ignore
    conn = psycopg2.connect(DIRECT_URL)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# ─────────────────────────────────────────────────────────────────────────────
# 1. SYMBOLS UPSERT
# ─────────────────────────────────────────────────────────────────────────────

def upsert_symbols(universe_df: pl.DataFrame) -> int:
    """
    Upsert the Symbol registry into 'symbols' table.
    Handles symbol ticker renames (via immutable ISIN) and in-batch deduplication.
    """
    rows_in = universe_df.to_dicts()
    if not rows_in:
        return 0

    # Dedup by symbol and isin in Python (NSE takes priority)
    rows_by_sym: dict[str, dict] = {}
    rows_by_isin: dict[str, dict] = {}

    for r in rows_in:
        sym = r.get("symbol") or r.get("nse_symbol") or r.get("bse_code")
        if not sym:
            continue
        row = {
            "symbol": sym,
            "bseCode": r.get("bse_code"),
            "isin": r.get("isin"),
            "companyName": r.get("name") or sym,
            "exchange": r.get("exchange", "NSE"),
            "series": r.get("series", "EQ"),
            "sector": r.get("sector") or "Diversified",
            "industry": r.get("industry") or "Diversified",
            "indices": r.get("indices") or ["NIFTY 500"],
            "marketCapCr": r.get("market_cap_cr") or r.get("marketCapCr"),
            "listingDate": r.get("listing_date") or r.get("listingDate"),
            "isFno": r.get("is_fno") or r.get("isFno") or False,
            "isActive": True,
        }
        isin = row["isin"]
        # Symbol deduplication
        if sym in rows_by_sym:
            if row["exchange"] == "NSE" and rows_by_sym[sym]["exchange"] != "NSE":
                rows_by_sym[sym] = row
        else:
            rows_by_sym[sym] = row

        # ISIN deduplication
        if isin:
            if isin in rows_by_isin:
                if row["exchange"] == "NSE" and rows_by_isin[isin]["exchange"] != "NSE":
                    # Remove previous symbol mapping if different
                    old_s = rows_by_isin[isin]["symbol"]
                    if old_s in rows_by_sym and old_s != sym:
                        del rows_by_sym[old_s]
                    rows_by_isin[isin] = row
            else:
                rows_by_isin[isin] = row

    rows = list(rows_by_sym.values())

    sql = """
        INSERT INTO symbols (
            symbol, "bseCode", isin, "companyName", exchange,
            series, sector, industry, indices, "marketCapCr",
            "listingDate", "isFno", "isActive", "updatedAt"
        )
        VALUES (
            %(symbol)s, %(bseCode)s, %(isin)s, %(companyName)s, %(exchange)s,
            %(series)s, %(sector)s, %(industry)s, %(indices)s, %(marketCapCr)s,
            %(listingDate)s, %(isFno)s, %(isActive)s, NOW()
        )
        ON CONFLICT (symbol) DO UPDATE SET
            "bseCode"     = EXCLUDED."bseCode",
            isin          = EXCLUDED.isin,
            "companyName" = EXCLUDED."companyName",
            exchange      = EXCLUDED.exchange,
            series        = EXCLUDED.series,
            sector        = EXCLUDED.sector,
            industry      = EXCLUDED.industry,
            indices       = EXCLUDED.indices,
            "isActive"    = true,
            "updatedAt"   = NOW()
    """

    with _conn() as conn:
        cur = conn.cursor()

        # Handle ticker renames: if isin exists in DB under an old symbol,
        # update DB symbol to new symbol so ON CONFLICT (symbol) works seamlessly.
        cur.execute("SELECT isin, symbol FROM symbols WHERE isin IS NOT NULL")
        existing_isin_map = dict(cur.fetchall())
        for r in rows:
            isin = r.get("isin")
            new_sym = r.get("symbol")
            if isin and isin in existing_isin_map:
                old_sym = existing_isin_map[isin]
                if old_sym != new_sym:
                    log.info("Renaming symbol in DB for ISIN %s: %s -> %s", isin, old_sym, new_sym)
                    cur.execute(
                        'UPDATE symbols SET symbol = %s, "updatedAt" = NOW() WHERE isin = %s',
                        (new_sym, isin),
                    )
                    existing_isin_map[isin] = new_sym

        execute_batch(cur, sql, rows, page_size=200)
        count = len(rows)

    log.info("Upserted %d symbols to Neon DB", count)
    return count


# ─────────────────────────────────────────────────────────────────────────────
# 2. LATEST TECHNICAL UPSERT
# ─────────────────────────────────────────────────────────────────────────────

def _val(row: dict, *keys: str, default: Any = 0.0) -> Any:
    for k in keys:
        if k in row and row[k] is not None:
            return row[k]
    return default


def upsert_latest_technical(
    df: pl.DataFrame,
    scored_df: pl.DataFrame,
    pattern_signals: list[dict] | None = None,
) -> int:
    """
    Upsert LatestTechnical rows — one per stock, overwritten nightly.
    """
    sparklines = _build_sparklines(df, SPARKLINE_DAYS)

    vcp_map: dict[str, int] = {}
    pocket_pivot_set: set[str] = set()
    if pattern_signals:
        for p in pattern_signals:
            s_sym = p.get("symbol")
            if not s_sym:
                continue
            stype = str(p.get("setupType") or p.get("pattern") or "").upper()
            if "VCP" in stype:
                vcp_map[s_sym] = int(p.get("vcp_contractions") or p.get("vcpContractions") or 2)
            if "POCKET_PIVOT" in stype:
                pocket_pivot_set.add(s_sym)

    # Latest row per stock (group by isin if present to avoid split symbols on ticker rename)
    group_col = "isin" if "isin" in df.columns else "symbol"
    today_df = df.sort("date").group_by(group_col).last()

    join_col = "isin" if "isin" in scored_df.columns and "isin" in today_df.columns else "symbol"
    merged = today_df.join(scored_df, on=join_col, how="left")

    # Fetch active symbols & ISIN map from DB to ensure FK validity
    with _conn() as conn:
        cur = conn.cursor()
        cur.execute('SELECT symbol, isin FROM symbols')
        db_symbols = cur.fetchall()
        valid_syms = {r[0] for r in db_symbols}
        isin_to_sym = {r[1]: r[0] for r in db_symbols if r[1]}

    rows_by_sym: dict[str, dict] = {}
    for row in merged.to_dicts():
        isin_val = row.get("isin")
        sym = isin_to_sym.get(isin_val) or row.get("symbol") or row.get("nse_symbol")
        if not sym or sym not in valid_syms:
            continue

        close_val = float(_val(row, "close", default=0.0))
        prev_close = float(_val(row, "prev_close", default=close_val))
        chg_pct = ((close_val - prev_close) / prev_close * 100) if prev_close > 0 else 0.0

        spark = sparklines.get(sym, sparklines.get(row.get("isin"), []))

        vcp_c = vcp_map.get(sym, int(_val(row, "vcpContractions", "vcp_contractions", default=0)))
        pp_today = (sym in pocket_pivot_set) or bool(_val(row, "pocketPivotToday", "pocket_pivot_today", default=False))

        rows_by_sym[sym] = {
            "symbol": sym,
            "tradeDate": _val(row, "date", "tradeDate", default=datetime.utcnow().date()),
            "open": float(_val(row, "open", default=close_val)),
            "high": float(_val(row, "high", default=close_val)),
            "low": float(_val(row, "low", default=close_val)),
            "close": close_val,
            "changePct": float(_val(row, "changePct", "change_pct", default=chg_pct)),
            "volume": int(_val(row, "volume", default=0)),
            "turnoverCr": float(_val(row, "turnover_cr", default=float(_val(row, "turnover_lakh", default=0)) / 100)),
            "rvol20d": float(_val(row, "rvol20d", "rvol", default=1.0)),
            "deliveryPct": float(_val(row, "deliveryPct", "delivery_pct", default=0.0)),
            "deliverySpike": float(_val(row, "deliverySpike", "delivery_spike", default=1.0)),
            "ema10": float(_val(row, "ema10", default=close_val)),
            "ema21": float(_val(row, "ema21", default=close_val)),
            "sma50": float(_val(row, "sma50", default=close_val)),
            "sma150": float(_val(row, "sma150", default=close_val)),
            "sma200": float(_val(row, "sma200", default=close_val)),
            "rsi14": float(_val(row, "rsi14", default=50.0)),
            "atr14": float(_val(row, "atr14", default=0.0)),
            "adrPct20d": float(_val(row, "adrPct20d", "adr", default=3.0)),
            "high52w": float(_val(row, "high52w", default=close_val)),
            "low52w": float(_val(row, "low52w", default=close_val)),
            "distFrom52wHighPct": float(_val(row, "distFrom52wHighPct", "from_high52w_pct", default=0.0)),
            "rsRating": int(_val(row, "rsRating", "rs_composite", default=50)),
            "mansfieldRs": float(_val(row, "mansfieldRs", default=0.0)),
            "weinsteinStage": str(_val(row, "weinsteinStage", "weinstein_stage", default="2A")),
            "minerviniPass": bool(_val(row, "minerviniPass", "minervini_pass", default=False)),
            "upDownVolRatio": float(_val(row, "upDownVolRatio", "up_down_vol_ratio", default=1.0)),
            "pocketPivotToday": pp_today,
            "vcpContractions": vcp_c,
            "baseTightnessPct": float(_val(row, "baseTightnessPct", "base_tightness_pct", default=5.0)),
            "sparkline60d": spark,
            "technoFundaScore": int(_val(row, "technoFundaScore", "composite_score", default=70)),
        }

    rows = list(rows_by_sym.values())
    if not rows:
        return 0

    sql = """
        INSERT INTO latest_technicals (
            symbol, "tradeDate", open, high, low, close, "changePct",
            volume, "turnoverCr", rvol20d, "deliveryPct", "deliverySpike",
            ema10, ema21, sma50, sma150, sma200, rsi14, atr14, "adrPct20d",
            high52w, low52w, "distFrom52wHighPct", "rsRating", "mansfieldRs",
            "weinsteinStage", "minerviniPass", "upDownVolRatio", "pocketPivotToday",
            "vcpContractions", "baseTightnessPct", sparkline60d, "technoFundaScore"
        )
        VALUES (
            %(symbol)s, %(tradeDate)s, %(open)s, %(high)s, %(low)s, %(close)s, %(changePct)s,
            %(volume)s, %(turnoverCr)s, %(rvol20d)s, %(deliveryPct)s, %(deliverySpike)s,
            %(ema10)s, %(ema21)s, %(sma50)s, %(sma150)s, %(sma200)s, %(rsi14)s, %(atr14)s, %(adrPct20d)s,
            %(high52w)s, %(low52w)s, %(distFrom52wHighPct)s, %(rsRating)s, %(mansfieldRs)s,
            %(weinsteinStage)s, %(minerviniPass)s, %(upDownVolRatio)s, %(pocketPivotToday)s,
            %(vcpContractions)s, %(baseTightnessPct)s, %(sparkline60d)s, %(technoFundaScore)s
        )
        ON CONFLICT (symbol) DO UPDATE SET
            "tradeDate"          = EXCLUDED."tradeDate",
            open                 = EXCLUDED.open,
            high                 = EXCLUDED.high,
            low                  = EXCLUDED.low,
            close                = EXCLUDED.close,
            "changePct"          = EXCLUDED."changePct",
            volume               = EXCLUDED.volume,
            "turnoverCr"         = EXCLUDED."turnoverCr",
            rvol20d              = EXCLUDED.rvol20d,
            "deliveryPct"        = EXCLUDED."deliveryPct",
            "deliverySpike"      = EXCLUDED."deliverySpike",
            ema10                = EXCLUDED.ema10,
            ema21                = EXCLUDED.ema21,
            sma50                = EXCLUDED.sma50,
            sma150               = EXCLUDED.sma150,
            sma200               = EXCLUDED.sma200,
            rsi14                = EXCLUDED.rsi14,
            atr14                = EXCLUDED.atr14,
            "adrPct20d"          = EXCLUDED."adrPct20d",
            high52w              = EXCLUDED.high52w,
            low52w               = EXCLUDED.low52w,
            "distFrom52wHighPct" = EXCLUDED."distFrom52wHighPct",
            "rsRating"           = EXCLUDED."rsRating",
            "mansfieldRs"        = EXCLUDED."mansfieldRs",
            "weinsteinStage"     = EXCLUDED."weinsteinStage",
            "minerviniPass"      = EXCLUDED."minerviniPass",
            "upDownVolRatio"     = EXCLUDED."upDownVolRatio",
            "pocketPivotToday"   = EXCLUDED."pocketPivotToday",
            "vcpContractions"    = EXCLUDED."vcpContractions",
            "baseTightnessPct"   = EXCLUDED."baseTightnessPct",
            sparkline60d         = EXCLUDED.sparkline60d,
            "technoFundaScore"   = EXCLUDED."technoFundaScore"
    """

    with _conn() as conn:
        cur = conn.cursor()
        execute_batch(cur, sql, rows, page_size=200)
        count = len(rows)

    log.info("Upserted %d LatestTechnical rows to Neon DB", count)
    return count


# ─────────────────────────────────────────────────────────────────────────────
# 3. PATTERN SIGNALS INSERT
# ─────────────────────────────────────────────────────────────────────────────

def insert_pattern_signals(
    signals: list[dict],
    scored_df: pl.DataFrame | dict | None = None,
) -> int:
    """Insert today's pattern signals into pattern_signals."""
    if not signals:
        return 0

    score_map: dict[str, int] = {}
    if scored_df is not None:
        if isinstance(scored_df, dict):
            score_map = scored_df
        elif isinstance(scored_df, pl.DataFrame):
            for r in scored_df.to_dicts():
                score_val = int(r.get("composite_score") or r.get("technoFundaScore") or 70)
                if r.get("symbol"):
                    score_map[r["symbol"]] = score_val
                if r.get("isin"):
                    score_map[r["isin"]] = score_val

    with _conn() as conn:
        cur = conn.cursor()
        cur.execute('SELECT symbol, isin FROM symbols')
        db_symbols = cur.fetchall()
        valid_syms = {r[0] for r in db_symbols}
        isin_to_sym = {r[1]: r[0] for r in db_symbols if r[1]}

    sql = """
        INSERT INTO pattern_signals (
            id, symbol, "tradeDate", "setupType", "pivotPrice",
            "stopLossPrice", "riskPct", "target1Price", "target2Price",
            "technoFundaScore", "rsRating", rvol, "deliveryPct",
            "catalystSummary", status
        )
        VALUES (
            %(id)s, %(symbol)s, %(tradeDate)s, %(setupType)s, %(pivotPrice)s,
            %(stopLossPrice)s, %(riskPct)s, %(target1Price)s, %(target2Price)s,
            %(technoFundaScore)s, %(rsRating)s, %(rvol)s, %(deliveryPct)s,
            %(catalystSummary)s, %(status)s
        )
        ON CONFLICT (symbol, "tradeDate", "setupType") DO NOTHING
    """

    rows = []
    for s in signals:
        isin_val = s.get("isin")
        sym = isin_to_sym.get(isin_val) or s.get("symbol") or s.get("nse_symbol")
        if not sym or sym not in valid_syms:
            continue

        pivot_price = float(_val(s, "pivotPrice", "pivot", default=0.0))
        stop_price = float(_val(s, "stopLossPrice", "stop", default=0.0))
        diff = pivot_price - stop_price
        default_risk_pct = round(diff / max(pivot_price, 0.01) * 100, 2) if diff > 0 else 5.0
        risk_pct = float(_val(s, "riskPct", default=default_risk_pct))
        t1 = float(_val(s, "target1Price", "target", default=round(pivot_price + 2.0 * diff, 2) if diff > 0 else pivot_price * 1.1))
        t2 = float(_val(s, "target2Price", default=round(pivot_price + 3.5 * diff, 2) if diff > 0 else pivot_price * 1.2))

        funda_score = (
            score_map.get(sym)
            or (score_map.get(s.get("isin")) if s.get("isin") else None)
            or int(_val(s, "composite_score", "technoFundaScore", default=75))
        )

        rows.append({
            "id": s.get("id") or str(uuid.uuid4())[:16],
            "symbol": sym,
            "tradeDate": _val(s, "tradeDate", "date", default=datetime.utcnow().date()),
            "setupType": str(_val(s, "setupType", "pattern", default="VCP")),
            "pivotPrice": pivot_price,
            "stopLossPrice": stop_price,
            "riskPct": risk_pct,
            "target1Price": t1,
            "target2Price": t2,
            "technoFundaScore": funda_score,
            "rsRating": int(_val(s, "rsRating", "rs_composite", default=85)),
            "rvol": float(_val(s, "rvol", default=1.5)),
            "deliveryPct": float(_val(s, "deliveryPct", "delivery_pct", default=40.0)),
            "catalystSummary": s.get("catalystSummary") or s.get("catalyst"),
            "status": s.get("status") or "READY",
        })

    with _conn() as conn:
        cur = conn.cursor()
        execute_batch(cur, sql, rows, page_size=200)
        count = len(rows)

    log.info("Inserted %d PatternSignal rows", count)
    return count


# ─────────────────────────────────────────────────────────────────────────────
# 4. MARKET BREADTH & SECTOR UPSERT
# ─────────────────────────────────────────────────────────────────────────────

def upsert_market_breadth(breadth: dict) -> None:
    """Upsert one row per trading day to market_breadth_and_sector."""
    sql = """
        INSERT INTO market_breadth_and_sector (
            "tradeDate", "nifty50Close", "nifty50ChangePct", "nifty500Close",
            "nifty500ChangePct", "indiaVix", advances, declines, "pctAbove20Ema",
            "pctAbove50Sma", "pctAbove200Sma", "new52wHighs", "new52wLows",
            "netHighLow", "fiiNetCr", "diiNetCr", "marketRegime", "sectorRrgJson"
        )
        VALUES (
            %(tradeDate)s, %(nifty50Close)s, %(nifty50ChangePct)s, %(nifty500Close)s,
            %(nifty500ChangePct)s, %(indiaVix)s, %(advances)s, %(declines)s, %(pctAbove20Ema)s,
            %(pctAbove50Sma)s, %(pctAbove200Sma)s, %(new52wHighs)s, %(new52wLows)s,
            %(netHighLow)s, %(fiiNetCr)s, %(diiNetCr)s, %(marketRegime)s, %(sectorRrgJson)s
        )
        ON CONFLICT ("tradeDate") DO UPDATE SET
            "nifty50Close"      = EXCLUDED."nifty50Close",
            "nifty50ChangePct"  = EXCLUDED."nifty50ChangePct",
            "nifty500Close"     = EXCLUDED."nifty500Close",
            "nifty500ChangePct" = EXCLUDED."nifty500ChangePct",
            "indiaVix"          = EXCLUDED."indiaVix",
            advances            = EXCLUDED.advances,
            declines            = EXCLUDED.declines,
            "pctAbove20Ema"     = EXCLUDED."pctAbove20Ema",
            "pctAbove50Sma"     = EXCLUDED."pctAbove50Sma",
            "pctAbove200Sma"    = EXCLUDED."pctAbove200Sma",
            "new52wHighs"       = EXCLUDED."new52wHighs",
            "new52wLows"        = EXCLUDED."new52wLows",
            "netHighLow"        = EXCLUDED."netHighLow",
            "fiiNetCr"          = EXCLUDED."fiiNetCr",
            "diiNetCr"          = EXCLUDED."diiNetCr",
            "marketRegime"      = EXCLUDED."marketRegime",
            "sectorRrgJson"     = EXCLUDED."sectorRrgJson"
    """

    data = {
        "tradeDate": _val(breadth, "tradeDate", "date", default=datetime.utcnow().date()),
        "nifty50Close": float(_val(breadth, "nifty50Close", "nifty50_close", "nifty_50_close", default=0.0)),
        "nifty50ChangePct": float(_val(breadth, "nifty50ChangePct", "nifty50_change_pct", default=0.0)),
        "nifty500Close": float(_val(breadth, "nifty500Close", "nifty500_close", "nifty_500_close", default=0.0)),
        "nifty500ChangePct": float(_val(breadth, "nifty500ChangePct", "nifty500_change_pct", default=0.0)),
        "indiaVix": float(_val(breadth, "indiaVix", "india_vix", default=0.0)),
        "advances": int(_val(breadth, "advances", default=0)),
        "declines": int(_val(breadth, "declines", default=0)),
        "pctAbove20Ema": float(_val(breadth, "pctAbove20Ema", "pct_above_20ema", "pct_above20ema", default=0.0)),
        "pctAbove50Sma": float(_val(breadth, "pctAbove50Sma", "pct_above_50dma", "pct_above50dma", default=0.0)),
        "pctAbove200Sma": float(_val(breadth, "pctAbove200Sma", "pct_above_200dma", "pct_above200dma", default=0.0)),
        "new52wHighs": int(_val(breadth, "new52wHighs", "new_52w_highs", default=0)),
        "new52wLows": int(_val(breadth, "new52wLows", "new_52w_lows", default=0)),
        "netHighLow": int(_val(breadth, "netHighLow", "net_high_low", default=0)),
        "fiiNetCr": float(_val(breadth, "fiiNetCr", "fii_net", default=0.0)),
        "diiNetCr": float(_val(breadth, "diiNetCr", "dii_net", default=0.0)),
        "marketRegime": str(_val(breadth, "marketRegime", "market_regime", default="CONFIRMED_UPTREND")),
        "sectorRrgJson": json.dumps(breadth.get("sectorRrgJson") or breadth.get("sector_snapshot") or []),
    }

    with _conn() as conn:
        conn.cursor().execute(sql, data)

    log.info("Upserted MarketBreadthAndSector for %s", data["tradeDate"])


# ─────────────────────────────────────────────────────────────────────────────
# 5. INSTITUTIONAL ACTIVITY UPSERT
# ─────────────────────────────────────────────────────────────────────────────

def upsert_institutional(deals: list[dict]) -> int:
    """Insert bulk/block deals into institutional_activity."""
    if not deals:
        return 0

    sql = """
        INSERT INTO institutional_activity (
            id, symbol, "tradeDate", "dealType", "clientOrCategory",
            action, quantity, price, "valueCr", headline
        )
        VALUES (
            %(id)s, %(symbol)s, %(tradeDate)s, %(dealType)s, %(clientOrCategory)s,
            %(action)s, %(quantity)s, %(price)s, %(valueCr)s, %(headline)s
        )
    """

    rows = []
    for d in deals:
        sym = d.get("symbol") or d.get("nse_symbol")
        if not sym:
            continue
        rows.append({
            "id": d.get("id") or str(uuid.uuid4())[:16],
            "symbol": sym,
            "tradeDate": d.get("tradeDate") or d.get("date") or datetime.utcnow().date(),
            "dealType": d.get("dealType") or d.get("kind") or "BULK",
            "clientOrCategory": d.get("clientOrCategory") or d.get("client") or "Institutional Client",
            "action": d.get("action") or "BUY",
            "quantity": int(d.get("quantity") or 0) if d.get("quantity") else None,
            "price": float(d.get("price") or d.get("price_paid") or 0.0) if d.get("price") else None,
            "valueCr": float(d.get("valueCr") or d.get("value") or 0.0) if d.get("valueCr") or d.get("value") else None,
            "headline": d.get("headline") or d.get("notes"),
        })

    with _conn() as conn:
        cur = conn.cursor()
        execute_batch(cur, sql, rows, page_size=200)
        count = len(rows)

    log.info("Upserted %d InstitutionalActivity rows", count)
    return count


insert_institutional_activity = upsert_institutional


# ─────────────────────────────────────────────────────────────────────────────
# 6. AI INTELLIGENCE UPSERT
# ─────────────────────────────────────────────────────────────────────────────

def upsert_ai_intelligence(
    cache_key: str,
    category: str,
    content: Any,
    symbol: Optional[str] = None,
    ttl_days: int = 1,
    model_used: str = "gemini-2.5-flash",
) -> None:
    """Store a Gemini response in the AiIntelligence cache."""
    expires_at = datetime.utcnow() + timedelta(days=ttl_days)

    sql = """
        INSERT INTO ai_intelligence (
            id, "cacheKey", category, symbol, payload,
            "modelUsed", "tokensUsed", "expiresAt", "createdAt"
        )
        VALUES (
            %(id)s, %(cacheKey)s, %(category)s, %(symbol)s, %(payload)s,
            %(modelUsed)s, %(tokensUsed)s, %(expiresAt)s, NOW()
        )
        ON CONFLICT ("cacheKey") DO UPDATE SET
            payload     = EXCLUDED.payload,
            "expiresAt" = EXCLUDED."expiresAt"
    """

    with _conn() as conn:
        conn.cursor().execute(sql, {
            "id": str(uuid.uuid4())[:16],
            "cacheKey": cache_key,
            "category": category,
            "symbol": symbol,
            "payload": json.dumps(content),
            "modelUsed": model_used,
            "tokensUsed": 250,
            "expiresAt": expires_at,
        })

    log.info("Upserted AiIntelligence [%s] (%s)", category, cache_key)


# ─────────────────────────────────────────────────────────────────────────────
# 7. FUNDAMENTALS UPSERT
# ─────────────────────────────────────────────────────────────────────────────

def upsert_fundamentals(fund_df: pl.DataFrame) -> int:
    """Upsert Fundamental rows into 'fundamentals' table."""
    rows_in = fund_df.to_dicts()
    if not rows_in:
        return 0

    rows = []
    for r in rows_in:
        sym = r.get("symbol") or r.get("nse_symbol")
        if not sym:
            continue
        rows.append({
            "symbol": sym,
            "pe": float(r["pe"]) if r.get("pe") else None,
            "industryPe": float(r["industry_pe"]) if r.get("industry_pe") else None,
            "pb": float(r["pb"]) if r.get("pb") else None,
            "roce": float(r["roce"]) if r.get("roce") else None,
            "roe": float(r["roe"]) if r.get("roe") else None,
            "debtToEquity": float(r["debt_equity"]) if r.get("debt_equity") else None,
            "opmPct": float(r["opm"]) if r.get("opm") else None,
            "opmChangeYoY": float(r["opm_yoy"]) if r.get("opm_yoy") else None,
            "salesGrowthQoQ": float(r["revenue_qoq"]) if r.get("revenue_qoq") else None,
            "salesGrowthYoY": float(r["revenue_yoy"]) if r.get("revenue_yoy") else None,
            "epsGrowthQoQ": float(r["eps_qoq"]) if r.get("eps_qoq") else None,
            "epsGrowthYoY": float(r["eps_yoy"]) if r.get("eps_yoy") else None,
            "promoterPct": float(r["promoter_holding"]) if r.get("promoter_holding") else None,
            "promoterChangeQoQ": float(r["promoter_change"]) if r.get("promoter_change") else None,
            "promoterPledgePct": float(r["promoter_pledge"]) if r.get("promoter_pledge") else None,
            "fiiPct": float(r["fii_holding"]) if r.get("fii_holding") else None,
            "fiiChangeQoQ": float(r["fii_qoq"]) if r.get("fii_qoq") else None,
            "diiPct": float(r["dii_holding"]) if r.get("dii_holding") else None,
            "diiChangeQoQ": float(r["dii_qoq"]) if r.get("dii_qoq") else None,
            "institutionalBoughtRecently": bool(r.get("institutional_bought_recently") or False),
            "nextResultsDate": r.get("next_results_date"),
            "fundamentalScore": int(r.get("fundamental_score") or 25),
        })

    sql = """
        INSERT INTO fundamentals (
            symbol, pe, "industryPe", pb, roce, roe, "debtToEquity",
            "opmPct", "opmChangeYoY", "salesGrowthQoQ", "salesGrowthYoY",
            "epsGrowthQoQ", "epsGrowthYoY", "promoterPct", "promoterChangeQoQ",
            "promoterPledgePct", "fiiPct", "fiiChangeQoQ", "diiPct", "diiChangeQoQ",
            "institutionalBoughtRecently", "nextResultsDate", "fundamentalScore", "updatedAt"
        )
        VALUES (
            %(symbol)s, %(pe)s, %(industryPe)s, %(pb)s, %(roce)s, %(roe)s, %(debtToEquity)s,
            %(opmPct)s, %(opmChangeYoY)s, %(salesGrowthQoQ)s, %(salesGrowthYoY)s,
            %(epsGrowthQoQ)s, %(epsGrowthYoY)s, %(promoterPct)s, %(promoterChangeQoQ)s,
            %(promoterPledgePct)s, %(fiiPct)s, %(fiiChangeQoQ)s, %(diiPct)s, %(diiChangeQoQ)s,
            %(institutionalBoughtRecently)s, %(nextResultsDate)s, %(fundamentalScore)s, NOW()
        )
        ON CONFLICT (symbol) DO UPDATE SET
            pe                            = EXCLUDED.pe,
            "industryPe"                  = EXCLUDED."industryPe",
            pb                            = EXCLUDED.pb,
            roce                          = EXCLUDED.roce,
            roe                           = EXCLUDED.roe,
            "debtToEquity"                = EXCLUDED."debtToEquity",
            "opmPct"                      = EXCLUDED."opmPct",
            "opmChangeYoY"                = EXCLUDED."opmChangeYoY",
            "salesGrowthQoQ"              = EXCLUDED."salesGrowthQoQ",
            "salesGrowthYoY"              = EXCLUDED."salesGrowthYoY",
            "epsGrowthQoQ"                = EXCLUDED."epsGrowthQoQ",
            "epsGrowthYoY"                = EXCLUDED."epsGrowthYoY",
            "promoterPct"                 = EXCLUDED."promoterPct",
            "promoterChangeQoQ"           = EXCLUDED."promoterChangeQoQ",
            "promoterPledgePct"           = EXCLUDED."promoterPledgePct",
            "fiiPct"                      = EXCLUDED."fiiPct",
            "fiiChangeQoQ"                = EXCLUDED."fiiChangeQoQ",
            "diiPct"                      = EXCLUDED."diiPct",
            "diiChangeQoQ"                = EXCLUDED."diiChangeQoQ",
            "institutionalBoughtRecently" = EXCLUDED."institutionalBoughtRecently",
            "nextResultsDate"             = EXCLUDED."nextResultsDate",
            "fundamentalScore"            = EXCLUDED."fundamentalScore",
            "updatedAt"                   = NOW()
    """

    with _conn() as conn:
        cur = conn.cursor()
        execute_batch(cur, sql, rows, page_size=200)
        count = len(rows)

    log.info("Upserted %d Fundamental rows to Neon DB", count)
    return count


# ─────────────────────────────────────────────────────────────────────────────
# 8. RETENTION PRUNING
# ─────────────────────────────────────────────────────────────────────────────

def prune_old_rows() -> dict[str, int]:
    """Delete rows older than their retention policy."""
    prune_rules = [
        ("pattern_signals",           '"tradeDate"',  PATTERN_RETENTION_DAYS),
        ("institutional_activity",    '"tradeDate"',  INSTITUTIONAL_RETENTION_DAYS),
        ("market_breadth_and_sector", '"tradeDate"',  BREADTH_RETENTION_DAYS),
        ("ai_intelligence",           '"createdAt"',  AI_RETENTION_DAYS),
    ]

    counts: dict[str, int] = {}
    with _conn() as conn:
        cur = conn.cursor()
        for table, col, days in prune_rules:
            cutoff = datetime.utcnow() - timedelta(days=days)
            sql = f"DELETE FROM {table} WHERE {col} < %s"
            try:
                cur.execute(sql, (cutoff,))
                counts[table] = cur.rowcount
            except Exception as e:
                log.warning("Pruning %s failed: %s", table, e)

    log.info("Pruned old rows: %s", counts)
    return counts


# ─────────────────────────────────────────────────────────────────────────────
# 9. GETTERS / READERS
# ─────────────────────────────────────────────────────────────────────────────

def get_active_symbols() -> pl.DataFrame:
    """Return all active symbols from the Symbol registry."""
    with _conn() as conn:
        cur = conn.cursor()
        cur.execute('SELECT symbol, "bseCode", isin, exchange FROM symbols WHERE "isActive" = true')
        rows = cur.fetchall()

    if not rows:
        return pl.DataFrame()

    return pl.DataFrame(
        rows,
        schema=["symbol", "bse_code", "isin", "exchange"],
        orient="row",
    )


def _build_sparklines(df: pl.DataFrame, n_days: int) -> dict[str, list[float]]:
    """Build a mapping of symbol/isin -> list of last N closing prices."""
    sparklines: dict[str, list[float]] = {}
    if df.is_empty():
        return sparklines

    target_col = "symbol" if "symbol" in df.columns else "isin"

    try:
        grouped = (
            df.sort("date")
              .group_by(target_col)
              .agg(pl.col("close").tail(n_days).alias("closes"))
        )
        for r in grouped.to_dicts():
            closes = r.get("closes", [])
            key = str(r.get(target_col))
            sparklines[key] = [round(float(c), 2) for c in closes if c is not None]
    except Exception as exc:
        log.warning("Sparkline construction error: %s", exc)

    return sparklines
