"""Recently listed IPOs — one year of them, each with its own price history.

Source is NSE's own past-issues feed (`/api/public-past-issues`), not a third party:
it carries the issue price and price band the exchange recorded, and it reaches back
years. Trendlyne's recently-listed API was evaluated first and rejected — it is capped
at the latest 100 rows (~2 months) with no working page parameter.

Only EQ/BE issues get charts: SME (SM/ST series) and bonds/InvITs never enter the
panel, so we have no price history for them. They are dropped rather than listed
without data — a chart screen full of blank cards is worse than a shorter list.

The IPO-base detector runs here rather than in the screener: a first base only means
something for a recently listed stock, which is exactly this universe.
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta

import pandas as pd

from jobs.config import IPO_LOOKBACK_DAYS, IPO_MIN_SESSIONS
from jobs.indicators import sma, wilder_atr
from jobs.patterns import ipo_base
from jobs.patterns.base import DetectContext
from jobs.sources import past_issues

log = logging.getLogger("jobs.ipos")

CHARTED_SERIES = {"EQ", "BE"}


def _round(v, dp: int = 2):
    return None if v is None or pd.isna(v) else round(float(v), dp)


def _pct(a, b):
    if a is None or b in (None, 0) or pd.isna(a) or pd.isna(b):
        return None
    return round((float(a) / float(b) - 1.0) * 100.0, 2)


def _price(raw) -> float | None:
    """NSE writes the issue price as a padded string ("    99") and occasionally "-"."""
    try:
        return float(str(raw).strip())
    except (TypeError, ValueError):
        return None


def parse_issue(row: dict) -> dict | None:
    listed = row.get("listingDate")
    try:
        listing_date = datetime.strptime(str(listed).strip(), "%d-%b-%Y").date()  # noqa: DTZ007 — a listing date has no time or zone
    except (TypeError, ValueError):
        return None
    return {
        "symbol": str(row.get("symbol", "")).strip().upper(),
        "company": str(row.get("company", "")).strip(),
        "listing_date": listing_date,
        "series": str(row.get("securityType", "")).strip().upper(),
        "issue_price": _price(row.get("issuePrice")),
        "price_range": str(row.get("priceRange", "")).strip() or None,
    }


def build(panel: pd.DataFrame, business_date: date) -> tuple[dict, dict[str, dict], dict]:
    cutoff = business_date - timedelta(days=IPO_LOOKBACK_DAYS)
    issues = [i for r in past_issues() if (i := parse_issue(r)) and i["listing_date"] >= cutoff]
    issues.sort(key=lambda i: i["listing_date"], reverse=True)
    charted = [i for i in issues if i["series"] in CHARTED_SERIES]

    by_symbol = {s: g.sort_values("date") for s, g in panel[panel["symbol"].isin({i["symbol"] for i in charted})].groupby("symbol")}
    rows = []
    for issue in charted:
        df = by_symbol.get(issue["symbol"])
        if df is None or len(df) < IPO_MIN_SESSIONS:
            continue
        # Only the life of the listing — an IPO chart that starts before the IPO is wrong.
        df = df[df["date"].dt.date >= issue["listing_date"]]
        if len(df) < IPO_MIN_SESSIONS:
            continue

        bars = [
            {
                "time": r["date"].date().isoformat(),
                "open": _round(r.get("open")),
                "high": _round(r.get("high")),
                "low": _round(r.get("low")),
                "close": _round(r["close"]),
                "volume": int(r["volume"]) if pd.notna(r.get("volume")) else 0,
            }
            for _, r in df.iterrows()
        ]
        first, last = df.iloc[0], df.iloc[-1]
        high_since, low_since = float(df["high"].max()), float(df["low"].min())

        indexed = df.set_index("date")[["high", "low", "close", "volume"]]
        ctx = DetectContext(
            listing_date=issue["listing_date"],
            vol_sma_20=_round(sma(df["volume"], 20).iloc[-1]) if len(df) >= 20 else None,
            high_52w=high_since,
            atr_14=_round(wilder_atr(df["high"], df["low"], df["close"], 14).iloc[-1]) if len(df) >= 15 else None,
        )
        match = ipo_base.detect(indexed, ctx)

        rows.append(
            {
                "symbol": issue["symbol"],
                "name": issue["company"],
                "series": issue["series"],
                "listing_date": issue["listing_date"].isoformat(),
                "sessions": len(df),
                "issue_price": issue["issue_price"],
                "price_range": issue["price_range"],
                "listing_open": _round(first.get("open")),
                "listing_close": _round(first.get("close")),
                "ltp": _round(last["close"]),
                "change_pct": _pct(last["close"], last.get("prev_close")),
                # Two different questions: what the IPO allottee made, and what someone
                # who bought on listing day made. Both are quoted on IPO screens.
                "gain_since_ipo_pct": _pct(last["close"], issue["issue_price"]),
                "gain_since_listing_pct": _pct(last["close"], first.get("close")),
                "listing_pop_pct": _pct(first.get("close"), issue["issue_price"]),
                "high_since_listing": _round(high_since),
                "low_since_listing": _round(low_since),
                "from_high_pct": _pct(last["close"], high_since),
                "above_listing_close": bool(last["close"] >= first.get("close")),
                "pattern": (
                    {
                        "stage": match.stage,
                        "confidence": match.confidence,
                        "pivot_price": match.pivot_price,
                        "stop_suggestion": match.stop_suggestion,
                        "target_suggestion": match.target_suggestion,
                        "base_weeks": match.base_weeks,
                    }
                    if match
                    else None
                ),
                "bars": bars,
            }
        )

    # Bars ride in their own per-symbol artifact: keeping them in the list made it
    # 1.4 MB, committed nightly, when a page only ever renders 10 charts.
    charts = {r["symbol"]: {"symbol": r["symbol"], "name": r["name"], "bars": r.pop("bars")} for r in rows}

    payload = {
        "as_of": business_date.isoformat(),
        "lookback_days": IPO_LOOKBACK_DAYS,
        "counts": {
            "issues": len(issues),
            "charted": len(rows),
            "sme_skipped": sum(1 for i in issues if i["series"] not in CHARTED_SERIES),
            "with_base": sum(1 for r in rows if r["pattern"]),
        },
        "ipos": rows,
    }
    stats = {"ok": bool(rows), **payload["counts"]}
    log.info("ipos: %s", stats)
    return payload, charts, stats
