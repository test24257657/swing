"""Institutional activity — bulk/block deal disclosures with a repeat-accumulation
flag, and the participant-wise open-interest breakdown (incl. the FII index-futures
long/short ratio). Backs the single /institutional screen.

Both sources are daily static archive files (jobs/sources.py::bulk_deals /
block_deals / participant_oi) — no live quote path, so this fits the same
nightly-batch model as everything else. The 30-session windows (repeat flag, FII
ratio trend) are accumulated into small local parquet stores, the same pattern
jobs/panel.py uses for the OHLC panel.
"""

from __future__ import annotations

import logging
from datetime import date, timedelta

import pandas as pd

from jobs.config import (
    DATA_DIR,
    DEALS_REPEAT_WINDOW_SESSIONS,
    PARTICIPANT_OI_HISTORY_DAYS,
)
from jobs.sources import block_deals, bulk_deals, participant_oi

_DEALS_RETENTION_CALENDAR_DAYS = int(DEALS_REPEAT_WINDOW_SESSIONS / 5 * 7) + 10  # sessions -> calendar days, +buffer

log = logging.getLogger("jobs.institutional")

DEALS_STORE = DATA_DIR / "deals_history.parquet"

_CLIENT_TYPES = ["FII", "DII", "Pro", "Client"]
_POI_SECTIONS = [
    ("Index Futures", "Future Index Long", "Future Index Short"),
    ("Stock Futures", "Future Stock Long", "Future Stock Short"),
    ("Index Options", "Option Index Call Long", "Option Index Call Short"),
    ("Stock Options", "Option Stock Call Long", "Option Stock Call Short"),
]


def _sessions(end: date, back: int) -> list[date]:
    out, d = [], end
    while len(out) < back:
        if d.weekday() < 5:
            out.append(d)
        d -= timedelta(days=1)
    return out


def _normalize_deals(rows: list[dict], kind: str, business_date: date) -> pd.DataFrame:
    if not rows:
        return pd.DataFrame(columns=["date", "symbol", "client", "side", "kind", "qty", "price", "value"])
    df = pd.DataFrame(rows)
    cols = {c.strip().lower(): c for c in df.columns}

    def col(*names):
        for n in names:
            if n in cols:
                return cols[n]
        return None

    sym_c, client_c, side_c, qty_c, price_c = (
        col("symbol"),
        col("client name"),
        col("buy/sell"),
        col("quantity traded"),
        col("trade price / wght. avg. price"),
    )
    if not all([sym_c, client_c, side_c, qty_c, price_c]):
        return pd.DataFrame(columns=["date", "symbol", "client", "side", "kind", "qty", "price", "value"])

    out = pd.DataFrame(
        {
            "date": business_date.isoformat(),
            "symbol": df[sym_c].astype(str).str.strip(),
            "client": df[client_c].astype(str).str.strip(),
            "side": df[side_c].astype(str).str.strip().str.upper(),
            "kind": kind,
            "qty": pd.to_numeric(df[qty_c], errors="coerce"),
            "price": pd.to_numeric(df[price_c], errors="coerce"),
        }
    )
    out["value"] = out["qty"] * out["price"]
    return out.dropna(subset=["symbol", "client", "qty"])


def _load_deals_store() -> pd.DataFrame:
    if DEALS_STORE.exists():
        return pd.read_parquet(DEALS_STORE)
    return pd.DataFrame(columns=["date", "symbol", "client", "side", "kind", "qty", "price", "value"])


def _save_deals_store(df: pd.DataFrame) -> None:
    DEALS_STORE.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(DEALS_STORE, index=False)


def _build_deals(business_date: date) -> tuple[list[dict], dict]:
    today = pd.concat(
        [
            _normalize_deals(bulk_deals(), "Bulk", business_date),
            _normalize_deals(block_deals(), "Block", business_date),
        ],
        ignore_index=True,
    )

    store = _load_deals_store()
    store = store[store["date"] != business_date.isoformat()]  # idempotent reruns
    store = pd.concat([store, today], ignore_index=True)
    cutoff = (business_date - timedelta(days=_DEALS_RETENTION_CALENDAR_DAYS)).isoformat()
    store = store[store["date"] >= cutoff]
    _save_deals_store(store)

    prior = store[store["date"] < business_date.isoformat()]
    prior_counts = prior.groupby(["symbol", "client"]).size() if not prior.empty else pd.Series(dtype=int)

    deals: list[dict] = []
    for _, row in today.sort_values("value", ascending=False).iterrows():
        prior_n = int(prior_counts.get((row["symbol"], row["client"]), 0))
        deals.append(
            {
                "date": row["date"],
                "symbol": row["symbol"],
                "client": row["client"],
                "side": row["side"],
                "kind": row["kind"],
                "qty": int(row["qty"]),
                "price": round(float(row["price"]), 2),
                "value": round(float(row["value"]), 2),
                "repeat": prior_n > 0,
                "repeat_count": prior_n,
            }
        )

    summary = {
        "deals_today": len(today),
        "bulk_count": int((today["kind"] == "Bulk").sum()) if not today.empty else 0,
        "block_count": int((today["kind"] == "Block").sum()) if not today.empty else 0,
        "total_value": round(float(today["value"].sum()), 2) if not today.empty else 0.0,
        "repeat_count": sum(1 for d in deals if d["repeat"]),
    }
    return deals, summary


def _build_participant_oi(business_date: date) -> dict | None:
    history: list[dict] = []
    for d in _sessions(business_date, PARTICIPANT_OI_HISTORY_DAYS + 5):
        row = participant_oi(d)
        if row is None:
            continue
        history.append({"date": d.isoformat(), **row})
        if len(history) >= PARTICIPANT_OI_HISTORY_DAYS:
            break
    if not history:
        return None
    history.sort(key=lambda r: r["date"])

    latest = history[-1]
    sections = []
    for name, long_key, short_key in _POI_SECTIONS:
        # total_long == 0 is a real (if practically unheard-of) possibility on a session
        # with no reported long OI in this instrument type — skip the section rather
        # than divide by zero, but don't conflate it with a missing client-type row.
        total_long = sum(latest[ct][long_key] for ct in _CLIENT_TYPES if ct in latest)
        if total_long <= 0:
            continue
        parts = [
            {
                "who": ct,
                "pct": round(latest[ct][long_key] / total_long * 100, 1),
                "side": "net long" if latest[ct][long_key] >= latest[ct][short_key] else "net short",
            }
            for ct in _CLIENT_TYPES
            if ct in latest
        ]
        if parts:
            net_note = max(parts, key=lambda p: p["pct"])
            sections.append({"name": name, "parts": parts, "note": f"{net_note['who']} led · {net_note['pct']}% of long OI"})

    fii_ratio_series = []
    for row in history:
        fii = row.get("FII")
        if fii is None or fii.get("Future Index Short") is None:
            continue
        short = fii["Future Index Short"]
        if short == 0:
            # Fully covered — a real, notable reading, but a ratio isn't representable;
            # drop this single point from the trend rather than divide by zero.
            continue
        fii_ratio_series.append({"date": row["date"], "ratio": round(fii["Future Index Long"] / short, 2)})

    return {
        "as_of": latest["date"],
        "sections": sections,
        "fii_index_futures_ratio": fii_ratio_series,
    }


def build(business_date: date) -> tuple[dict, dict]:
    deals, deal_summary = _build_deals(business_date)
    participant = _build_participant_oi(business_date)

    payload = {
        "as_of": business_date.isoformat(),
        "deal_summary": deal_summary,
        "deals": deals,
        "participant_oi": participant,
    }
    stats = {
        "ok": bool(deals) or participant is not None,
        "deals": len(deals),
        "participant_oi_sessions": len(participant["fii_index_futures_ratio"]) if participant else 0,
    }
    log.info("institutional: %s deals, participant OI %s", len(deals), "ok" if participant else "missing")
    return payload, stats
