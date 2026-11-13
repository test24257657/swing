"""
pipeline/run_nightly.py
Master 7:00 PM IST orchestrator — runs every Mon–Fri via GitHub Actions.

Steps:
  1.  Universe hygiene (ISIN dedup, ETF filter, price/liquidity filter)
  2.  Pull ohlcv_2y.parquet from GitHub Release
  3.  Fetch today's NSE+BSE bhavcopy
  4.  Apply split adjustments
  5.  Append today's bars → updated parquet
  6.  Compute all indicators (Polars, one pass)
  7.  Compute Relative Strength percentiles (1-99)
  8.  Classify Weinstein Stage
  9.  Detect VCP, Pocket Pivot, 52WH, 21EMA, IPO Base patterns
  10. Compute RRG sector coordinates
  11. Fetch bulk/block deals
  12. Run 100-pt composite scorer
  13. Compute market breadth
  14. Upsert to Neon DB (symbols, technicals, patterns, breadth, institutional)
  15. Save updated parquet to GitHub Release
  16. Call Gemini for Top 5 Picks (1 batched call)
  17. Send Telegram evening alert
"""

from __future__ import annotations

import logging
import sys
from datetime import date, datetime
from zoneinfo import ZoneInfo

import polars as pl

from pipeline.config import IST_TZ

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    stream=sys.stdout,
)
log = logging.getLogger("pipeline.nightly")

IST = ZoneInfo(IST_TZ)


def main() -> None:
    started_at = datetime.now(IST)
    trading_date = date.today()
    log.info("=" * 60)
    log.info("Swing Terminal v2 — Nightly Pipeline")
    log.info("Date: %s | Started: %s IST", trading_date, started_at.strftime("%H:%M:%S"))
    log.info("=" * 60)

    # ── Step 1: Load existing parquet ─────────────────────────────────────────
    log.info("[1/17] Loading existing ohlcv_2y.parquet from GitHub Release...")
    from pipeline.storage import load_parquet
    existing_parquet = load_parquet()
    log.info(
        "Existing parquet: %s rows",
        f"{len(existing_parquet):,}" if existing_parquet is not None else "None (first run)"
    )

    # ── Step 2: Universe hygiene ──────────────────────────────────────────────
    log.info("[2/17] Building clean equity universe...")
    from pipeline.sources.universe import build_universe
    universe_df = build_universe(trading_date, existing_parquet)
    universe_isins = set(universe_df["isin"].to_list())
    log.info("Universe: %d stocks", len(universe_isins))

    # ── Step 3: Fetch today's bhavcopy ────────────────────────────────────────
    log.info("[3/17] Fetching NSE/BSE Bhavcopy...")
    from pipeline.sources.nse_bhavcopy import fetch_bhavcopy as nse_bhavcopy
    from pipeline.sources.bse_bhavcopy import fetch_bhavcopy as bse_bhavcopy

    nse_df = nse_bhavcopy(trading_date, allow_lookback=True)
    bse_df = bse_bhavcopy(trading_date, allow_lookback=True)

    if nse_df is None and bse_df is None:
        log.error("Both NSE and BSE bhavcopy failed — aborting")
        sys.exit(1)

    # Build today's bars from bhavcopy
    today_bars = _build_today_bars(nse_df, bse_df, universe_isins, trading_date)
    log.info("Today's bars: %d rows", len(today_bars))

    # ── Step 4: Fetch corporate actions (splits/bonuses) ──────────────────────
    log.info("[4/17] Fetching split/bonus adjustments...")
    splits = _fetch_splits()

    # ── Step 5: Append today + apply splits ──────────────────────────────────
    log.info("[5/17] Appending today's bars to parquet...")
    from pipeline.storage import append_daily_bars, apply_split_adjustments
    parquet = append_daily_bars(existing_parquet, today_bars)
    if splits:
        parquet = apply_split_adjustments(parquet, splits)
        log.info("Applied %d split adjustments", len(splits))

    # Filter to universe ISINs only
    parquet = parquet.filter(pl.col("isin").is_in(universe_isins))
    log.info("Parquet after universe filter: %d rows, %d stocks",
             len(parquet), parquet["isin"].n_unique())

    # ── Step 6: Compute indicators ────────────────────────────────────────────
    log.info("[6/17] Computing technical indicators...")
    from pipeline.compute.indicators import compute_all, compute_weinstein_stage
    parquet = compute_all(parquet)

    # ── Step 7: Relative Strength ─────────────────────────────────────────────
    log.info("[7/17] Computing Relative Strength percentiles...")
    benchmark_df = _fetch_benchmark_closes()
    if benchmark_df is not None:
        from pipeline.compute.indicators import compute_relative_strength
        parquet = compute_relative_strength(parquet, benchmark_df)
    else:
        log.warning("Benchmark data unavailable — RS scores will be 50 (neutral)")

    # ── Step 8: Weinstein Stage ───────────────────────────────────────────────
    log.info("[8/17] Classifying Weinstein Stage...")
    parquet = compute_weinstein_stage(parquet)

    # ── Step 9: Pattern Detection ─────────────────────────────────────────────
    log.info("[9/17] Detecting patterns (VCP, Pocket Pivot, 52WH, 21EMA, IPO Base)...")
    from pipeline.compute.patterns import detect_all_patterns
    pattern_signals = detect_all_patterns(parquet, universe_isins)
    log.info("Found %d pattern signals today", len(pattern_signals))
    pattern_df = pl.DataFrame(pattern_signals) if pattern_signals else pl.DataFrame()

    # ── Step 10: Sector RRG ───────────────────────────────────────────────────
    log.info("[10/17] Computing Sector RRG...")
    rrg_data = {}
    if benchmark_df is not None:
        from pipeline.compute.rrg import compute_sector_rrg, get_latest_rrg_snapshot
        rrg_data = compute_sector_rrg(parquet, benchmark_df)
        rrg_snapshot = get_latest_rrg_snapshot(rrg_data)
        # Attach RRG quadrant to parquet rows
        parquet = _attach_rrg_quadrants(parquet, rrg_snapshot)
    else:
        rrg_snapshot = {}

    # ── Step 11: Bulk/Block Deals ─────────────────────────────────────────────
    log.info("[11/17] Fetching bulk/block deals...")
    from pipeline.sources.bulk_deals import fetch_bulk_deals, fetch_block_deals
    bulk_df = fetch_bulk_deals(trading_date)
    block_df = fetch_block_deals(trading_date)

    institutional_rows = _build_institutional_rows(bulk_df, block_df, universe_df)

    # ── Step 12: 100-pt Composite Scorer ─────────────────────────────────────
    log.info("[12/17] Running 100-point composite scorer...")
    from pipeline.compute.scorer import score_all, get_top_n

    # Get latest technical state (one row per stock)
    today_technical = (
        parquet.sort("date")
               .group_by("isin")
               .last()
    )

    # Load fundamentals from DB
    fundamental_df = _load_fundamentals_from_db(universe_isins)
    institutional_pl = pl.DataFrame(institutional_rows) if institutional_rows else pl.DataFrame()

    scored_df = score_all(
        technical_df=today_technical,
        fundamental_df=fundamental_df,
        pattern_df=pattern_df,
        institutional_df=institutional_pl,
    )

    # ── Step 13: Market Breadth ───────────────────────────────────────────────
    log.info("[13/17] Computing market breadth...")
    breadth = _compute_breadth(parquet, trading_date, rrg_snapshot, rrg_data=rrg_data)

    # ── Step 14: Upsert to Neon DB ────────────────────────────────────────────
    log.info("[14/17] Upserting to Neon DB...")
    from pipeline import db

    db.upsert_symbols(universe_df)
    db.upsert_latest_technical(parquet, scored_df, pattern_signals=pattern_signals)
    if pattern_signals:
        db.insert_pattern_signals(pattern_signals, scored_df=scored_df)
    db.upsert_market_breadth(breadth)
    if institutional_rows:
        db.upsert_institutional(institutional_rows)

    pruned = db.prune_old_rows()
    log.info("Pruned rows: %s", pruned)

    # ── Step 15: Save updated parquet ────────────────────────────────────────
    log.info("[15/17] Saving updated parquet to GitHub Release...")
    from pipeline.storage import save_parquet
    ok = save_parquet(parquet)
    log.info("Parquet save: %s", "OK" if ok else "FAILED (local only)")

    # ── Step 16: Gemini Top 5 Picks ───────────────────────────────────────────
    log.info("[16/17] Calling Gemini for Top 5 Picks...")
    top15 = get_top_n(scored_df, n=15)
    shortlist = _build_shortlist(top15, parquet, fundamental_df)

    from pipeline.ai.gemini import rank_top_picks
    picks = rank_top_picks(shortlist) or []

    if picks:
        shortlist_map = {s["symbol"]: s for s in shortlist}
        enriched_picks = []
        for p in picks:
            s_info = shortlist_map.get(p.get("symbol"), {})
            close_price = float(s_info.get("close") or 0.0)
            adr_val = float(s_info.get("adr") or 3.0)
            stop_loss = round(close_price * (1 - min(adr_val * 1.5, 7.0) / 100), 1)
            target1 = round(close_price + 2 * (close_price - stop_loss), 1)

            enriched = {
                "rank": p.get("rank", 1),
                "symbol": p.get("symbol"),
                "setupType": s_info.get("pattern") or f"Stage {s_info.get('weinstein_stage', '2B')}",
                "convictionScore": int(s_info.get("composite_score") or 85),
                "entryZone": f"₹{round(close_price * 0.995, 1)} - ₹{round(close_price * 1.01, 1)}",
                "stopLoss": stop_loss,
                "target1": target1,
                "riskReward": "1:2.0",
                "technicalThesis": p.get("reason") or f"Stage {s_info.get('weinstein_stage')} setup with RVOL {s_info.get('rvol')}x",
                "fundamentalCatalyst": f"ROCE {s_info.get('roce')}% | EPS QoQ {s_info.get('eps_qoq')}%" if s_info.get('roce') else "Consistent operating metrics",
                "keyRisk": f"Breach below stop loss at ₹{stop_loss}",
            }
            enriched_picks.append(enriched)

        from pipeline import db
        db.upsert_ai_intelligence(
            cache_key=f"top_picks_{trading_date}",
            category="TOP_PICKS",
            content={"picks": enriched_picks, "shortlist_count": len(shortlist)},
            ttl_days=1,
        )
        log.info("Top %d picks stored: %s", len(enriched_picks), [p.get("symbol") for p in enriched_picks])

    # ── Step 17: Telegram alert ───────────────────────────────────────────────
    log.info("[17/17] Sending Telegram evening alert...")
    from pipeline.notify.telegram import send_evening_alert
    send_evening_alert(
        picks=picks,
        breakouts=pattern_signals[:10],
        market_regime=breadth.get("marketRegime", "CONFIRMED_UPTREND"),
        fii_net=breadth.get("fiiNetCr"),
    )

    elapsed = (datetime.now(IST) - started_at).seconds
    log.info("=" * 60)
    log.info("Nightly pipeline complete in %dm %ds", elapsed // 60, elapsed % 60)
    log.info("=" * 60)


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def _build_today_bars(
    nse_df,
    bse_df,
    universe_isins: set[str],
    trading_date: date,
) -> pl.DataFrame:
    """Merge NSE + BSE into today's bars DataFrame."""
    parts = []

    if nse_df is not None:
        nse_bars = nse_df.with_columns([
            pl.lit(str(trading_date)).str.to_date().alias("date"),
            pl.lit("NSE").alias("exchange"),
            pl.lit(1.0).alias("adj_factor"),
        ]).filter(pl.col("isin").is_in(universe_isins))
        parts.append(nse_bars.select([
            "isin", "symbol", "exchange", "date",
            "open", "high", "low", "close", "volume",
            pl.col("turnover_lakh"),
            pl.col("delivery_pct").fill_null(0.0),
            "adj_factor",
        ]))

    if bse_df is not None:
        # BSE-exclusive stocks only
        bse_exclusive_isins = universe_isins - (
            set(nse_df["isin"].to_list()) if nse_df is not None else set()
        )
        bse_bars = bse_df.with_columns([
            pl.lit(str(trading_date)).str.to_date().alias("date"),
            pl.lit("BSE").alias("exchange"),
            pl.lit(1.0).alias("adj_factor"),
            pl.lit(0.0).alias("delivery_pct"),
        ]).filter(pl.col("isin").is_in(bse_exclusive_isins))

        if "name" in bse_bars.columns and "symbol" not in bse_bars.columns:
            bse_bars = bse_bars.rename({"name": "symbol"})

        if "bse_code" in bse_bars.columns:
            bse_bars = bse_bars.rename({"bse_code": "symbol"}) if "symbol" not in bse_bars.columns else bse_bars

        parts.append(bse_bars.select([
            "isin", "symbol", "exchange", "date",
            "open", "high", "low", "close", "volume",
            pl.col("turnover_lakh").fill_null(0.0),
            "delivery_pct",
            "adj_factor",
        ]))

    if not parts:
        return pl.DataFrame()

    return pl.concat(parts, how="diagonal")


def _fetch_splits() -> list[dict]:
    """Fetch recent corporate actions (splits/bonuses) from NSE."""
    try:
        import urllib.request
        url = "https://www.nseindia.com/api/corporates-pit?index=equities&period=1"
        req = urllib.request.Request(url, headers={
            "User-Agent": "Mozilla/5.0",
            "Referer": "https://www.nseindia.com/",
        })
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = __import__("json").loads(resp.read())
            splits = []
            for item in data.get("data", []):
                if item.get("purpose", "").upper() in ("SPLIT", "BONUS"):
                    splits.append({
                        "isin": item.get("isin", ""),
                        "ex_date": item.get("exDate", ""),
                        "adj_factor": _parse_split_ratio(item.get("faceValue", "")),
                    })
            return [s for s in splits if s["adj_factor"] != 1.0]
    except Exception as exc:
        log.warning("Split fetch failed: %s", exc)
        return []


def _parse_split_ratio(face_value_str: str) -> float:
    """Parse face value change to adjustment factor (e.g., 10→2 → 0.2)."""
    try:
        parts = str(face_value_str).replace(" ", "").split("→")
        if len(parts) == 2:
            old, new = float(parts[0]), float(parts[1])
            return new / old if old > 0 else 1.0
    except Exception:
        pass
    return 1.0


def _fetch_benchmark_closes() -> pl.DataFrame | None:
    """Fetch Nifty 500 close history for RS computation."""
    try:
        import yfinance as yf  # type: ignore
        import pandas as pd
        ticker = yf.Ticker("^CRSLDX")  # Nifty 500 Total Return
        hist = ticker.history(period="2y")
        if hist.empty:
            ticker = yf.Ticker("^NSEI")  # Fallback to Nifty 50
            hist = ticker.history(period="2y")
        if hist.empty:
            return None
        hist.index = pd.to_datetime(hist.index).date
        hist_df = hist.reset_index()
        date_col = "Date" if "Date" in hist_df.columns else "index"
        hist_df = hist_df.rename(columns={date_col: "date", "Close": "close"})
        df = pl.from_pandas(hist_df[["date", "close"]])
        return df
    except Exception as exc:
        log.warning("Benchmark fetch failed: %s", exc)
        return None


def _attach_rrg_quadrants(parquet: pl.DataFrame, rrg_snapshot: dict) -> pl.DataFrame:
    """Attach RRG quadrant to stocks based on SECTOR_INDICES and sector column."""
    from pipeline.compute.rrg import SECTOR_INDICES

    symbol_quad_map = {}
    sector_quad_map = {sec.upper(): data.get("quadrant") for sec, data in rrg_snapshot.items()}

    for sector, symbols in SECTOR_INDICES.items():
        quad = sector_quad_map.get(sector.upper())
        if quad:
            for s in symbols:
                symbol_quad_map[s] = quad

    symbols_in_df = parquet["symbol"].to_list() if "symbol" in parquet.columns else []
    sectors_in_df = parquet["sector"].to_list() if "sector" in parquet.columns else [None] * len(parquet)

    quadrants = []
    for sym, sec in zip(symbols_in_df, sectors_in_df):
        q = symbol_quad_map.get(sym)
        if not q and sec:
            q = sector_quad_map.get(str(sec).upper())
        quadrants.append(q)

    return parquet.with_columns([
        pl.Series("rrg_quadrant", quadrants, dtype=pl.Utf8),
    ])


def _build_institutional_rows(bulk_df, block_df, universe_df) -> list[dict]:
    """Merge bulk + block deals into InstitutionalActivity rows."""
    rows = []
    isin_map = {
        row["nse_symbol"]: row["isin"]
        for row in universe_df.to_dicts()
        if row.get("nse_symbol")
    }

    for df, deal_type in [(bulk_df, "BULK"), (block_df, "BLOCK")]:
        if df is None or len(df) == 0:
            continue
        for row in df.to_dicts():
            symbol = str(row.get("symbol", "")).split("-")[0].strip()
            isin = isin_map.get(symbol)
            if not isin:
                continue

            buy_sell = str(row.get("buy_sell", "")).upper()
            action = "BUY" if "BUY" in buy_sell else "SELL"
            kind = f"{deal_type}_BUY" if action == "BUY" else f"{deal_type}_SELL"
            deal_date = row.get("deal_date") or row.get("date")
            val_cr = row.get("value_cr") or row.get("value")
            client = row.get("client") or "Institutional Client"

            rows.append({
                "symbol": symbol,
                "isin": isin,
                "tradeDate": deal_date,
                "date": deal_date,
                "dealType": deal_type,
                "action": action,
                "kind": kind,
                "clientOrCategory": client,
                "client": client,
                "quantity": row.get("quantity"),
                "valueCr": val_cr,
                "value": val_cr,
                "price": row.get("price"),
                "price_paid": row.get("price"),
                "stake_pct": None,
                "is_repeat_buyer": False,
                "headline": f"{deal_type} deal by {client}",
                "notes": f"{deal_type} deal",
            })

    return rows


def _load_fundamentals_from_db(universe_isins: set[str]) -> pl.DataFrame:
    """Load the latest Fundamental rows from Neon DB."""
    try:
        import psycopg2  # type: ignore
        from pipeline.config import DIRECT_URL
        conn = psycopg2.connect(DIRECT_URL)
        cur = conn.cursor()
        cur.execute("""
            SELECT f.symbol, s.isin, f."epsGrowthQoQ", f."epsGrowthYoY",
                   f."salesGrowthQoQ", f."salesGrowthYoY", f.roce, f.roe,
                   f."debtToEquity", f."promoterPledgePct", f."fiiPct",
                   f."fiiChangeQoQ", f."diiPct", f."diiChangeQoQ",
                   f."fundamentalScore"
            FROM fundamentals f
            JOIN symbols s ON s.symbol = f.symbol
        """)
        rows = cur.fetchall()
        conn.close()

        if not rows:
            return pl.DataFrame()

        cols = [
            "symbol", "isin", "eps_qoq", "eps_yoy", "revenue_qoq", "revenue_yoy",
            "roce", "roe", "debt_equity", "promoter_pledge", "fii_holding",
            "fii_qoq", "dii_holding", "dii_qoq", "fundamental_score"
        ]
        return pl.DataFrame([dict(zip(cols, r)) for r in rows])

    except Exception as exc:
        log.warning("Failed to load fundamentals from DB: %s", exc)
        return pl.DataFrame()


def _build_shortlist(top15: pl.DataFrame, parquet: pl.DataFrame, fund_df: pl.DataFrame) -> list[dict]:
    """Build the Gemini shortlist payload from the top 15 stocks."""
    top_isins = set(top15["isin"].to_list())
    fund_dict = {r["isin"]: r for r in fund_df.to_dicts()} if len(fund_df) > 0 else {}

    latest_tech = (
        parquet.filter(pl.col("isin").is_in(top_isins))
               .sort("date")
               .group_by("isin")
               .last()
               .to_dicts()
    )

    shortlist = []
    for row in latest_tech:
        isin = row["isin"]
        score_row = top15.filter(pl.col("isin") == isin).to_dicts()
        fund = fund_dict.get(isin, {})

        entry = {
            "symbol": row.get("symbol", isin),
            "composite_score": score_row[0].get("composite_score", 0) if score_row else 0,
            "weinstein_stage": row.get("weinstein_stage", "?"),
            "rs_composite": round(row.get("rs_composite", 50) or 50, 1),
            "close": row.get("close"),
            "rvol": round(row.get("rvol", 1) or 1, 2),
            "adr": round(row.get("adr", 0) or 0, 2),
            "eps_qoq": fund.get("eps_qoq"),
            "roce": fund.get("roce"),
            "fii_qoq": fund.get("fii_qoq"),
            "debt_equity": fund.get("debt_equity"),
        }
        shortlist.append(entry)

    return sorted(shortlist, key=lambda x: x.get("composite_score", 0), reverse=True)


def _compute_breadth(
    parquet: pl.DataFrame,
    trading_date: date,
    rrg_snapshot: dict,
    rrg_data: dict | None = None,
) -> dict:
    """Compute market breadth statistics from today's bars and live index data."""
    today = parquet.sort("date").group_by("isin").last()
    prev = parquet.sort("date").group_by("isin").agg(pl.col("close").shift(1).last().alias("prev_close"))
    merged = today.join(prev, on="isin", how="left")

    advances = merged.filter(pl.col("close") > pl.col("prev_close")).height
    declines = merged.filter(pl.col("close") < pl.col("prev_close")).height
    unchanged = merged.filter(pl.col("close") == pl.col("prev_close")).height
    total = max(advances + declines + unchanged, 1)

    above20 = 0
    if "ema21" in today.columns:
        above20 = today.filter(pl.col("close") > pl.col("ema21")).height
    elif "sma20" in today.columns:
        above20 = today.filter(pl.col("close") > pl.col("sma20")).height

    above50 = 0
    if "sma50" in today.columns:
        above50 = today.filter(pl.col("close") > pl.col("sma50")).height

    above200 = 0
    if "sma200" in today.columns:
        above200 = today.filter(pl.col("close") > pl.col("sma200")).height

    pct_above20 = round(above20 / total * 100, 1)
    pct_above50 = round(above50 / total * 100, 1)
    pct_above200 = round(above200 / total * 100, 1)

    new52h = 0
    new52l = 0
    if "high52w" in today.columns:
        new52h = today.filter(pl.col("close") >= pl.col("high52w") * 0.995).height
    if "low52w" in today.columns:
        new52l = today.filter(pl.col("close") <= pl.col("low52w") * 1.005).height
    net_high_low = new52h - new52l

    # Fetch real live/EOD quotes for Nifty 50, Nifty 500, India VIX
    nifty50_close = None
    nifty50_change_pct = 0.0
    nifty500_close = None
    nifty500_change_pct = 0.0
    india_vix = None

    try:
        import yfinance as yf
        tickers = yf.Tickers("^NSEI ^CRSLDX ^INDIAVIX")
        nsei = tickers.tickers.get("^NSEI")
        if nsei:
            h = nsei.history(period="5d")
            if not h.empty and len(h) >= 1:
                nifty50_close = round(float(h["Close"].iloc[-1]), 2)
                if len(h) >= 2:
                    p_close = float(h["Close"].iloc[-2])
                    nifty50_change_pct = round((nifty50_close - p_close) / p_close * 100, 2)

        crsldx = tickers.tickers.get("^CRSLDX")
        if crsldx:
            h = crsldx.history(period="5d")
            if not h.empty and len(h) >= 1:
                nifty500_close = round(float(h["Close"].iloc[-1]), 2)
                if len(h) >= 2:
                    p_close = float(h["Close"].iloc[-2])
                    nifty500_change_pct = round((nifty500_close - p_close) / p_close * 100, 2)

        vix = tickers.tickers.get("^INDIAVIX")
        if vix:
            h = vix.history(period="5d")
            if not h.empty and len(h) >= 1:
                india_vix = round(float(h["Close"].iloc[-1]), 2)
    except Exception as exc:
        log.warning("Index/VIX fetch failed in breadth calculation: %s", exc)

    # Market regime mapping
    if pct_above50 > 60:
        regime = "CONFIRMED_UPTREND"
    elif pct_above50 >= 45:
        regime = "UPTREND_UNDER_PRESSURE"
    elif pct_above50 >= 30:
        regime = "PULLBACK_SWING"
    else:
        regime = "CORRECTION_CASH"

    # Sector RRG UI payload
    sector_ui_payload = []
    if rrg_data:
        from pipeline.compute.rrg import build_rrg_ui_payload
        sector_ui_payload = build_rrg_ui_payload(rrg_data)

    return {
        "tradeDate": trading_date,
        "date": trading_date,
        "advances": advances,
        "declines": declines,
        "unchanged": unchanged,
        "ad_ratio": round(advances / max(declines, 1), 2),
        "pctAbove20Ema": pct_above20,
        "pctAbove50Sma": pct_above50,
        "pctAbove200Sma": pct_above200,
        "new52wHighs": new52h,
        "new52wLows": new52l,
        "netHighLow": net_high_low,
        "nifty50Close": nifty50_close or 24850.0,
        "nifty50ChangePct": nifty50_change_pct,
        "nifty500Close": nifty500_close or 23200.0,
        "nifty500ChangePct": nifty500_change_pct,
        "indiaVix": india_vix or 13.0,
        "fiiNetCr": 0.0,
        "diiNetCr": 0.0,
        "sectorRrgJson": sector_ui_payload if sector_ui_payload else rrg_snapshot,
        "marketRegime": regime,
    }


if __name__ == "__main__":
    main()
