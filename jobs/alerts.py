"""Watchlist symbols + alert evaluation.

There is no live intraday feed in this architecture, so alerts are evaluated once,
nightly, against that session's high/low from the bhavcopy panel — "triggered" means
"crossed at some point during today's session," not real time. An alert auto-disables
once it fires so it doesn't refire every night; the user re-enables (or deletes and
re-adds) it from the watchlist screen.
"""

from __future__ import annotations

import logging
from datetime import date

import pandas as pd

from jobs.db import connect

log = logging.getLogger("jobs.alerts")


def watchlist_symbols() -> list[str]:
    """Every symbol any user has watchlisted — folded into the chart-artifact set so
    watchlist rows can always open their chart, not just screener/mover symbols."""
    conn = connect()
    if conn is None:
        return []
    try:
        with conn, conn.cursor() as cur:
            cur.execute("SELECT DISTINCT symbol FROM watchlist_items")
            return [r[0] for r in cur.fetchall()]
    except Exception:
        log.exception("could not read watchlist symbols")
        return []
    finally:
        conn.close()


def evaluate(panel: pd.DataFrame, business_date: date) -> dict:
    conn = connect()
    if conn is None:
        return {"ok": False, "evaluated": 0, "triggered": 0}
    if panel.empty:
        conn.close()
        return {"ok": True, "evaluated": 0, "triggered": 0}

    latest = panel[panel["date"] == panel["date"].max()].set_index("symbol")
    evaluated = triggered = 0
    try:
        with conn, conn.cursor() as cur:
            cur.execute(
                """
                SELECT a.id, w.symbol, a.kind, a.threshold
                FROM alerts a
                JOIN watchlist_items w ON w.id = a.watchlist_item_id
                WHERE a.enabled = true
                """
            )
            for alert_id, symbol, kind, threshold in cur.fetchall():
                if symbol not in latest.index:
                    continue
                bar = latest.loc[symbol]
                high, low = bar.get("high"), bar.get("low")
                evaluated += 1
                hit_price = None
                if kind == "price_above" and pd.notna(high) and high >= threshold:
                    hit_price = float(high)
                elif kind == "price_below" and pd.notna(low) and low <= threshold:
                    hit_price = float(low)
                if hit_price is not None:
                    cur.execute(
                        "UPDATE alerts SET triggered_at=%s, triggered_price=%s, enabled=false WHERE id=%s",
                        (business_date, hit_price, alert_id),
                    )
                    triggered += 1
    except Exception:
        log.exception("alert evaluation failed")
        conn.close()
        return {"ok": False, "evaluated": evaluated, "triggered": triggered}
    conn.close()
    log.info("alerts: %s evaluated, %s triggered", evaluated, triggered)
    return {"ok": True, "evaluated": evaluated, "triggered": triggered}
