"""F&O — per-stock buildup classification (near-month futures) and the live option
chain with max-OI support/resistance strikes. Both only apply to F&O-eligible
underlyings (~210 stocks), a small subset of the full chart universe.
"""

from __future__ import annotations

import logging
from datetime import date

import pandas as pd

from jobs.cache import safe
from jobs.config import FNO_BUILDUP_FLAT_PCT, OPTION_CHAIN_STRIKES_EACH_SIDE
from jobs.sources import fno_bhavcopy, fno_expiries, option_chain

log = logging.getLogger("jobs.fno")


def _classify_buildup(price_chg_pct: float, oi_chg_pct: float) -> tuple[str, str]:
    price_up = price_chg_pct > FNO_BUILDUP_FLAT_PCT
    price_down = price_chg_pct < -FNO_BUILDUP_FLAT_PCT
    oi_up = oi_chg_pct > FNO_BUILDUP_FLAT_PCT
    oi_down = oi_chg_pct < -FNO_BUILDUP_FLAT_PCT

    if price_up and oi_up:
        return "long_buildup", "Fresh longs — price and open interest are both rising together."
    if price_down and oi_up:
        return "short_buildup", "Fresh shorts — open interest is rising as price falls."
    if price_up and oi_down:
        return "short_covering", "Shorts are closing out — open interest is falling as price rises."
    if price_down and oi_down:
        return "long_unwinding", "Longs are exiting — open interest is falling as price falls."
    return "neutral", "No clear buildup — price and open interest are both roughly flat."


def _stock_futures(d: date) -> pd.DataFrame | None:
    df = fno_bhavcopy(d)
    if df is None:
        return None
    stf = df[df["FinInstrmTp"] == "STF"].copy()
    return stf if not stf.empty else None


def buildup_for(symbol: str, stf: pd.DataFrame) -> dict | None:
    rows = stf[stf["TckrSymb"] == symbol]
    if rows.empty:
        return None
    near = rows.sort_values("XpryDt").iloc[0]
    close, prev_close = float(near["ClsPric"]), float(near["PrvsClsgPric"])
    oi, oi_chg = float(near["OpnIntrst"]), float(near["ChngInOpnIntrst"])
    prev_oi = oi - oi_chg
    if prev_close <= 0 or prev_oi <= 0:
        return None

    price_chg_pct = round((close - prev_close) / prev_close * 100, 2)
    oi_chg_pct = round(oi_chg / prev_oi * 100, 2)
    label, note = _classify_buildup(price_chg_pct, oi_chg_pct)

    return {
        "label": label,
        "note": note,
        "expiry": pd.Timestamp(near["XpryDt"]).date().isoformat(),
        "price_chg_pct": price_chg_pct,
        "oi_chg_pct": oi_chg_pct,
        "open_interest": int(oi),
        "close": close,
    }


def _chain_for(symbol: str, expiry: str) -> dict | None:
    payload = option_chain(symbol, expiry)
    if payload is None:
        return None
    records = payload.get("records") or {}
    data = records.get("data") or []
    underlying = records.get("underlyingValue")

    rows = []
    for row in data:
        ce, pe = row.get("CE"), row.get("PE")
        if not ce and not pe:
            continue
        rows.append(
            {
                "strike": row.get("strikePrice"),
                "call_oi": (ce or {}).get("openInterest", 0),
                "call_oi_chg": (ce or {}).get("changeinOpenInterest", 0),
                "put_oi": (pe or {}).get("openInterest", 0),
                "put_oi_chg": (pe or {}).get("changeinOpenInterest", 0),
            }
        )
    if not rows:
        return None
    rows.sort(key=lambda r: r["strike"])

    total_call_oi = sum(r["call_oi"] for r in rows)
    total_put_oi = sum(r["put_oi"] for r in rows)
    max_call = max(rows, key=lambda r: r["call_oi"])
    max_put = max(rows, key=lambda r: r["put_oi"])

    if underlying:
        atm_idx = min(range(len(rows)), key=lambda i: abs(rows[i]["strike"] - underlying))
        lo = max(0, atm_idx - OPTION_CHAIN_STRIKES_EACH_SIDE)
        hi = min(len(rows), atm_idx + OPTION_CHAIN_STRIKES_EACH_SIDE + 1)
        rows = rows[lo:hi]

    return {
        "expiry": expiry,
        "underlying_value": underlying,
        "rows": rows,
        "pcr": round(total_put_oi / total_call_oi, 2) if total_call_oi else None,
        "total_call_oi": total_call_oi,
        "total_put_oi": total_put_oi,
        "max_call_oi_strike": max_call["strike"],
        "max_put_oi_strike": max_put["strike"],
    }


@safe(default=None, label="F&O artifact")
def _build_one(symbol: str, stf: pd.DataFrame, expiry: str) -> dict | None:
    buildup = buildup_for(symbol, stf)
    chain = _chain_for(symbol, expiry)
    if buildup is None and chain is None:
        return None
    return {"symbol": symbol, "buildup": buildup, "option_chain": chain}


def build(business_date: date, symbols: list[str]) -> tuple[dict[str, dict], dict]:
    stf = _stock_futures(business_date)
    expiries = fno_expiries()
    if stf is None or not expiries:
        return {}, {"ok": False, "symbols": len(symbols), "written": 0}

    eligible = set(stf["TckrSymb"].unique())
    universe = [s for s in dict.fromkeys(symbols) if s in eligible]

    payloads: dict[str, dict] = {}
    for symbol in universe:
        data = _build_one(symbol, stf, expiries[0])
        if data is not None:
            payloads[symbol] = data

    stats = {"ok": bool(payloads), "eligible": len(eligible), "symbols": len(universe), "written": len(payloads)}
    log.info("fno: %s of %s F&O-eligible symbols in universe", len(payloads), len(universe))
    return payloads, stats
