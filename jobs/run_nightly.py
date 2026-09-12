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
    alerts,
    breadth,
    charts,
    flows,
    fundamentals,
    indices,
    movers,
    news,
    panel,
    quotes,
    screener,
    sectors,
    tiles,
    writer,
)
from jobs.config import BACKFILL_DAYS, PANEL_DAYS, TILE_INDICES
from jobs.sources import holidays, symbol_names

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
