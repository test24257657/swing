"""The nightly pipeline. One entry point, run by GitHub Actions.

    python -m jobs.run_nightly

Every stage is wrapped so one broken source degrades one card rather than failing the
run — the previous artifacts stay on disk and the UI shows the stale state.
"""

from __future__ import annotations

import logging
import sys
from datetime import date, timedelta

from jobs import (
    ai_insights,
    ai_top_picks,
    alerts,
    breadth,
    charts,
    daily_scan,
    depth,
    flows,
    fno,
    fundamentals,
    indices,
    institutional,
    movers,
    news,
    panel,
    quotes,
    results_calendar,
    screener,
    sectors,
    tiles,
    weekly_outlook,
    writer,
)
from jobs.config import BACKFILL_DAYS, PANEL_DAYS, TILE_INDICES, WEEKLY_OUTLOOK_WEEKDAY
from jobs.sources import holidays, index_constituents, index_history, symbol_names

logging.basicConfig(level="INFO", format="%(levelname)-5s %(name)s  %(message)s")
log = logging.getLogger("jobs.nightly")


def _last_weekday(d: date) -> date:
    while d.weekday() >= 5:
        d -= timedelta(days=1)
    return d


def main() -> int:
    business_date = _last_weekday(date.today())  # noqa: DTZ011
    log.info("nightly run for %s", business_date)
    sources: dict[str, dict] = {}

    # 1. calendar (cheap, and the status pill needs it even if everything else fails)
    cal = holidays()
    sources["holidays"] = {"ok": bool(cal), "count": len(cal)}
    writer.write_calendar(cal)

    # 2. panel — append missing sessions from the bhavcopy
    df, panel_stats = panel.build(business_date, BACKFILL_DAYS)
    sources["bhavcopy"] = panel_stats
    if df.empty:
        log.error("panel is empty — leaving existing artifacts untouched")
        writer.write_meta(sources)
        return 1
    panel.save(df)

    # 3. index tiles + volatility card
    tile_rows, vix, tile_stats = tiles.build(PANEL_DAYS)
    sources["tiles"] = tile_stats
    sources["vix"] = {"ok": vix is not None}

    # 4. breadth
    breadth_card = breadth.compute(df)
    sources["breadth"] = {"ok": breadth_card is not None}

    # 5. flows
    flow_card, flow_stats = flows.compute(business_date)
    sources["fii_dii"] = flow_stats

    # 6. movers
    active = movers.most_active(df)
    breakouts = movers.breakouts_52w(df)
    sources["movers"] = {"ok": bool(active), "most_active": len(active), "breakouts": len(breakouts)}

    # 7. setup-pattern screener (VCP, IPO base, 52w breakout, near pivot)
    screener_payload, screener_stats = screener.build(df)
    sources["screener"] = screener_stats
    writer.write("screener.json", screener_payload)

    # 8. sector rotation — 1M/3M ranking, rank deltas, simplified RRG tail
    sector_payload, sector_stats = sectors.build(df)
    sources["sectors"] = sector_stats
    writer.write("sectors.json", sector_payload)

    # 8b. Daily Scan — market regime light, RS ratings, "ready today", delivery spikes,
    #     pocket pivots, sector leaders. Rule-based, no Gemini calls.
    scan_payload, scan_stats = daily_scan.build(
        df,
        symbol_names(),
        screener_payload,
        sector_payload,
        breadth_card,
        index_history("NIFTY 50", PANEL_DAYS),
        index_constituents("NIFTY 50"),
    )
    sources["daily_scan"] = scan_stats
    writer.write("daily_scan.json", scan_payload)

    # 9. indices screen — every broad-market + sector index, list metadata
    indices_payload, indices_stats = indices.build()
    sources["indices"] = indices_stats
    writer.write("indices.json", indices_payload)

    # 10. per-instrument chart artifacts — Pulse movers, every screener match, anything
    #     on a user's watchlist, and every index on the Indices/Sectors screens
    watchlisted = alerts.watchlist_symbols()
    mover_symbols = (
        [r["symbol"] for r in active]
        + [r["symbol"] for r in breakouts]
        + [r["symbol"] for r in screener_payload.get("rows", [])]
        + watchlisted
    )
    all_tile_indices = list(dict.fromkeys(TILE_INDICES + indices.ALL_INDICES))
    writer.clear_dir("charts")
    charted, chart_stats = charts.build(df, all_tile_indices, mover_symbols, PANEL_DAYS)
    sources["charts"] = chart_stats
    log.info("chart artifacts: %s", len(charted))

    # 9. quarterly fundamentals (yfinance) — same symbol set as the stock charts
    writer.clear_dir("fundamentals")
    fund_payloads, fund_stats = fundamentals.build([s for s in charted if s not in all_tile_indices])
    sources["fundamentals"] = fund_stats
    for symbol, payload in fund_payloads.items():
        writer.write(f"fundamentals/{charts.slug(symbol)}.json", payload)
    log.info("fundamentals artifacts: %s", len(fund_payloads))

    # 10. whole-panel quote lookup — any watchlisted symbol, not just the ones above
    quotes_payload = quotes.build(df, symbol_names())
    writer.write("quotes.json", quotes_payload)
    sources["quotes"] = {"ok": bool(quotes_payload), "count": len(quotes_payload)}

    # 11. alert evaluation — nightly, against today's high/low (no live intraday feed)
    alert_stats = alerts.evaluate(df, business_date)
    sources["alerts"] = alert_stats

    # 12. news — corporate announcements for the same "interesting" symbol universe as
    #     the chart artifacts, filtered + AI-classified
    news_payload, news_stats = news.build(list(dict.fromkeys(mover_symbols)))
    sources["news"] = news_stats
    writer.write("news.json", news_payload)

    # 13. institutional activity — bulk/block deals (repeat-accumulation flag) +
    #     participant-wise OI / FII derivatives ratio. Whole-market, not scoped to
    #     the chart universe: the deals feed is inherently every listed symbol.
    institutional_payload, institutional_stats = institutional.build(business_date)
    sources["institutional"] = institutional_stats
    writer.write("institutional.json", institutional_payload)

    # 14. F&O — buildup + option chain, F&O-eligible symbols in the chart universe only
    writer.clear_dir("fno")
    fno_payloads, fno_stats = fno.build(business_date, [s for s in charted if s not in all_tile_indices])
    sources["fno"] = fno_stats
    for symbol, payload in fno_payloads.items():
        writer.write(f"fno/{charts.slug(symbol)}.json", payload)
    log.info("fno artifacts: %s", len(fno_payloads))

    # 15. market depth — best-effort (see jobs/depth.py); same stock universe as
    #     fundamentals.
    writer.clear_dir("depth")
    depth_payloads, depth_stats = depth.build([s for s in charted if s not in all_tile_indices])
    sources["depth"] = depth_stats
    for symbol, payload in depth_payloads.items():
        writer.write(f"depth/{charts.slug(symbol)}.json", payload)
    log.info("depth artifacts: %s", len(depth_payloads))

    # 16. AI stock narrative — nightly, same "interesting universe" as fundamentals/
    #     F&O (movers/screener/watchlist), not the whole ~2,900-stock traded market.
    #     Whole-market was tried and reverted: it pushed the nightly run to ~60-90
    #     min (dominated by ~2,900 sequential NSE filing lookups), and fixing that
    #     properly needs real concurrency — a bigger, riskier change than this scope
    #     is worth. Technicals come straight off the in-memory panel and fundamentals
    #     from NSE's own XBRL filings (never yfinance, never guessed) — see
    #     jobs/ai_insights.py. A second opinion alongside the rule-based technical
    #     verdict, not a replacement.
    writer.clear_dir("ai_summary")
    ai_payloads, ai_stats = ai_insights.build(df, [s for s in charted if s not in all_tile_indices], screener_payload, news_payload)
    sources["ai_insights"] = ai_stats
    for symbol, payload in ai_payloads.items():
        writer.write(f"ai_summary/{charts.slug(symbol)}.json", payload)
    log.info("ai_summary artifacts: %s", len(ai_payloads))

    # 16b. AI top 5 for the dashboard — rules gate the same universe (uptrend, not
    #      stretched, profitable, growing), then AI picks the best 5 of the shortlist.
    top_picks_payload, top_picks_stats = ai_top_picks.build(
        df,
        [s for s in charted if s not in all_tile_indices],
        screener_payload,
        fund_payloads,
        ai_payloads,
        symbol_names(),
        business_date,
    )
    sources["ai_top_picks"] = top_picks_stats
    writer.write("ai_top_picks.json", top_picks_payload)

    # 17. weekly AI market outlook — Fridays only (see jobs/weekly_outlook.py for why
    #     it's scoped to breadth/volatility/flows/sectors/indices, not news/deals).
    if business_date.weekday() == WEEKLY_OUTLOOK_WEEKDAY:
        outlook_payload, outlook_stats = weekly_outlook.build(
            business_date, breadth_card, vix, flow_card, sector_payload, indices_payload
        )
        sources["weekly_outlook"] = outlook_stats
        if outlook_payload is not None:
            writer.write("weekly_outlook.json", outlook_payload)

    # 18. results calendar — whole market, ±30 days. Upcoming board meetings shown
    #     unconditionally; already-filed results only shown if AI judges them good.
    calendar_payload, calendar_stats = results_calendar.build(business_date)
    sources["results_calendar"] = calendar_stats
    writer.write("results_calendar.json", calendar_payload)

    writer.write_pulse(
        {
            "as_of": panel.latest_session(df).date().isoformat(),
            "tiles": tile_rows,
            "breadth": breadth_card,
            "flows": flow_card,
            "vix": vix,
            "most_active": active,
            "breakouts_52w": breakouts,
        }
    )
    writer.write_meta(sources)

    failed = [k for k, v in sources.items() if not v.get("ok", True)]
    log.info("done — %s sources ok, degraded: %s", len(sources) - len(failed), failed or "none")
    return 0


if __name__ == "__main__":
    sys.exit(main())
