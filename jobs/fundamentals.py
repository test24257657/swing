"""Quarterly fundamentals — revenue & net income, QoQ, via yfinance.

Only for symbols that already get a chart artifact (screener matches + tiles), not the
whole market — one HTTP fetch per symbol, and the free tier has no room for ~2,000 of
those nightly. Each fetch is wrapped in ``safe()``: one delisted symbol or a yfinance
hiccup degrades to a missing artifact, never crashes the run.
"""

from __future__ import annotations

import logging

import pandas as pd

from jobs.cache import safe
from jobs.filing_verify import verify

log = logging.getLogger("jobs.fundamentals")

REVENUE_ROWS = ["Total Revenue"]
NET_INCOME_ROWS = ["Net Income", "Net Income Common Stockholders"]
EPS_ROWS = ["Basic EPS"]
_FY_QUARTER = {4: 1, 5: 1, 6: 1, 7: 2, 8: 2, 9: 2, 10: 3, 11: 3, 12: 3, 1: 4, 2: 4, 3: 4}


def _quarter_label(ts: pd.Timestamp) -> str:
    """Indian fiscal year (Apr-Mar): a Jun'26 quarter-end is Q1 FY27."""
    fy_end_year = ts.year + 1 if ts.month >= 4 else ts.year
    return f"Q{_FY_QUARTER[ts.month]} FY{str(fy_end_year)[-2:]}"


def _cr(v: float | None) -> float | None:
    return round(float(v) / 1e7, 1) if v is not None and pd.notna(v) else None


def _find_row(df: pd.DataFrame, names: list[str]) -> str | None:
    return next((n for n in names if n in df.index), None)


def _qoq(curr: float | None, prev: float | None) -> float | None:
    return round((curr / prev - 1) * 100, 1) if curr is not None and prev else None


@safe(default=None, label="fundamentals")
def _fetch_one(symbol: str) -> dict | None:
    import yfinance as yf

    df = yf.Ticker(f"{symbol}.NS").quarterly_income_stmt
    if df is None or df.empty:
        return None
    rev_row = _find_row(df, REVENUE_ROWS)
    ni_row = _find_row(df, NET_INCOME_ROWS)
    eps_row = _find_row(df, EPS_ROWS)
    if rev_row is None and ni_row is None:
        return None

    quarters: list[dict] = []
    prev_rev = prev_ni = None
    for col in sorted(df.columns)[-4:]:
        rev = _cr(df.loc[rev_row, col]) if rev_row else None
        ni = _cr(df.loc[ni_row, col]) if ni_row else None
        eps = round(float(df.loc[eps_row, col]), 2) if eps_row and pd.notna(df.loc[eps_row, col]) else None
        quarters.append(
            {
                "label": _quarter_label(col),
                "period_end": col.date().isoformat(),
                "revenue_cr": rev,
                "revenue_qoq_pct": _qoq(rev, prev_rev),
                "net_income_cr": ni,
                "net_income_qoq_pct": _qoq(ni, prev_ni),
                "eps": eps,
            }
        )
        prev_rev = rev if rev is not None else prev_rev
        prev_ni = ni if ni is not None else prev_ni

    if not any(q["revenue_cr"] is not None or q["net_income_cr"] is not None for q in quarters):
        return None
    verification = verify(symbol, quarters[-1]) if quarters else None
    return {"symbol": symbol, "quarters": quarters, "verification": verification}


def build(symbols: list[str]) -> tuple[dict[str, dict], dict]:
    payloads: dict[str, dict] = {}
    unique = list(dict.fromkeys(symbols))
    for symbol in unique:
        data = _fetch_one(symbol)
        if data is not None:
            payloads[symbol] = data
    stats = {"ok": bool(payloads), "symbols": len(unique), "written": len(payloads)}
    log.info("fundamentals: %s of %s symbols", len(payloads), len(unique))
    return payloads, stats
