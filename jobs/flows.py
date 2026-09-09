"""FII / DII cash-segment flows.

The NSE endpoint only returns the latest session, so the job keeps its own rolling
history file and appends to it each night. Values are ₹ crore.
"""

from __future__ import annotations

import json
import logging
from datetime import date

import pandas as pd

from jobs.config import DATA_DIR, FLOW_SESSIONS
from jobs.sources import fii_dii

log = logging.getLogger("jobs.flows")

HISTORY = DATA_DIR / "fii_dii.json"


def _num(v) -> float | None:
    try:
        f = float(str(v).replace(",", "").strip())
        return f if pd.notna(f) else None
    except (ValueError, TypeError):
        return None


def _load() -> dict[str, dict]:
    if HISTORY.exists():
        try:
            return {r["date"]: r for r in json.loads(HISTORY.read_text())}
        except (json.JSONDecodeError, KeyError):
            return {}
    return {}


def compute(business_date: date) -> tuple[dict, dict]:
    """Returns (flow_card, stats). Appends today's reading to the rolling history."""
    history = _load()
    df = fii_dii()
    added = 0

    if df is not None and not df.empty:
        cat_col = next((c for c in df.columns if "categor" in c), None)
        date_col = next((c for c in df.columns if "date" in c), None)
        buy_col = next((c for c in df.columns if "buy" in c), None)
        sell_col = next((c for c in df.columns if "sell" in c), None)
        net_col = next((c for c in df.columns if "net" in c), None)

        if cat_col:
            for r in df.to_dict("records"):
                d = business_date.isoformat()
                if date_col:
                    parsed = pd.to_datetime(r[date_col], dayfirst=True, errors="coerce")
                    if pd.notna(parsed):
                        d = parsed.date().isoformat()
                cat = str(r[cat_col]).upper()
                who = "fii" if ("FII" in cat or "FPI" in cat) else "dii" if "DII" in cat else None
                if who is None:
                    continue
                slot = history.setdefault(d, {"date": d})
                net = _num(r.get(net_col)) if net_col else None
                if net is None and buy_col and sell_col:
                    b, s = _num(r.get(buy_col)), _num(r.get(sell_col))
                    net = (b - s) if (b is not None and s is not None) else None
                slot[f"{who}_net"] = net
                added = 1

    if history:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        HISTORY.write_text(json.dumps(sorted(history.values(), key=lambda r: r["date"]), indent=0))

    series = sorted(history.values(), key=lambda r: r["date"])[-FLOW_SESSIONS:]
    fii = [r.get("fii_net") for r in series if r.get("fii_net") is not None]
    dii = [r.get("dii_net") for r in series if r.get("dii_net") is not None]

    card = {
        "series": [
            {"date": r["date"], "fii_net": r.get("fii_net"), "dii_net": r.get("dii_net")}
            for r in series
        ],
        "fii_10_session_net": round(sum(fii), 1) if fii else None,
        "dii_10_session_net": round(sum(dii), 1) if dii else None,
    }
    return card, {"ok": bool(series), "sessions": len(series), "added_today": added}
