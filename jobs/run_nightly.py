"""The nightly pipeline. One entry point, run by GitHub Actions.

    python -m jobs.run_nightly

Every stage is wrapped so one broken source degrades one card rather than failing the
run — the previous artifacts stay on disk and the UI shows the stale state.
"""

from __future__ import annotations

import logging
import sys
from datetime import date, timedelta

from jobs import breadth, flows, movers, panel, tiles, writer
from jobs.config import BACKFILL_DAYS, PANEL_DAYS
from jobs.sources import holidays

logging.basicConfig(level="INFO", format="%(levelname)-5s %(name)s  %(message)s")
log = logging.getLogger("jobs.nightly")


def _last_weekday(d: date) -> date:
    while d.weekday() >= 5:
        d -= timedelta(days=1)
    return d


def main() -> int:
    business_date = _last_weekday(date.today())
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
    sources["indices"] = tile_stats
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
