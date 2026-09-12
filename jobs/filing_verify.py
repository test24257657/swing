"""Filing verification — cross-checks yfinance's quarterly numbers against the
official NSE filing (XBRL), on the three figures with a stable taxonomy tag: revenue,
net profit, basic EPS. A wrong divergence flag is worse than a missing one, so any
symbol whose filing doesn't parse cleanly ships as unavailable rather than guessed.
"""

from __future__ import annotations

import logging
from datetime import datetime

from jobs.cache import safe
from jobs.config import FILING_VERIFY_TOLERANCE_PCT
from jobs.sources import financial_results, xbrl_financials

log = logging.getLogger("jobs.filing_verify")


def _pct_diff(yf: float | None, nse: float | None) -> float | None:
    if yf is None or nse is None or nse == 0:
        return None
    return round((yf - nse) / abs(nse) * 100, 1)


def _pick_filing(rows: list[dict], period_end: str) -> dict | None:
    """The consolidated quarterly filing whose reporting period ends on the same date
    as the yfinance quarter we're comparing against — not just 'the latest filing',
    which could be a different quarter than the one on screen."""
    candidates = [
        r for r in rows if r.get("consolidated") == "Consolidated" and r.get("period") == "Quarterly" and r.get("xbrl")
    ]
    for r in candidates:
        to_date = r.get("toDate")  # 'DD-Mon-YYYY'
        if not to_date:
            continue
        try:
            # NSE's own wall-clock date, no timezone in the source (same convention
            # as jobs/news.py's an_dt parsing).
            parsed = datetime.strptime(to_date.strip(), "%d-%b-%Y").date().isoformat()  # noqa: DTZ007
        except ValueError:
            continue
        if parsed == period_end:
            return r
    return None


@safe(default=None, label="filing verification")
def verify(symbol: str, latest_quarter: dict) -> dict | None:
    period_end = latest_quarter.get("period_end")
    if not period_end:
        return None
    rows = financial_results(symbol)
    filing = _pick_filing(rows, period_end)
    if filing is None:
        return None
    xbrl = xbrl_financials(filing["xbrl"])
    if xbrl is None:
        return None

    checks = []
    for label, yf_val, nse_raw, is_cr in [
        ("Revenue", latest_quarter.get("revenue_cr"), xbrl.get("revenue"), True),
        ("Net profit", latest_quarter.get("net_income_cr"), xbrl.get("net_profit"), True),
        ("EPS", latest_quarter.get("eps"), xbrl.get("eps"), False),
    ]:
        nse_val = round(nse_raw / 1e7, 1) if (is_cr and nse_raw is not None) else nse_raw
        diff_pct = _pct_diff(yf_val, nse_val)
        checks.append(
            {
                "label": label,
                "yfinance": yf_val,
                "nse_filing": nse_val,
                "diff_pct": diff_pct,
                "divergent": diff_pct is not None and abs(diff_pct) > FILING_VERIFY_TOLERANCE_PCT,
            }
        )

    if not any(c["yfinance"] is not None and c["nse_filing"] is not None for c in checks):
        return None

    return {
        "quarter_label": latest_quarter.get("label"),
        "filed_at": filing.get("filingDate"),
        "filing_url": filing.get("xbrl"),
        "checks": checks,
        "divergence_count": sum(1 for c in checks if c["divergent"]),
    }
