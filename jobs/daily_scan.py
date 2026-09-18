"""Daily Scan — "is it safe to buy, and what do I buy tonight?" in one screen.

All rule-based, computed from the panel we already hold; no Gemini calls, so it never
competes with the AI features for the free-tier quota. Every threshold is in config.

* **Market regime** — green/yellow/red from NIFTY 50 vs its 50/200-day averages,
  O'Neil distribution days, and breadth. Most swing losses come from buying
  breakouts into a market that is being sold.
* **RS rating 1-99** — IBD-style relative strength across the whole market.
* **Ready today** — trend template + RS leader + a forming setup just under its pivot.
* **Delivery spikes**, **pocket pivots**, **volume dry-up** — the accumulation tells.
* **Sector leaders** — highest-RS names inside the top-ranked sectors.
"""

from __future__ import annotations

import logging

import numpy as np
import pandas as pd

from jobs.config import (
    DELIVERY_SPIKE_MIN_GAIN_PCT,
    DELIVERY_SPIKE_MIN_PCT,
    DELIVERY_SPIKE_MIN_VOL_MULT,
    DELIVERY_SPIKE_MULT,
    DISTRIBUTION_CAUTION,
    DISTRIBUTION_DAY_MIN_DROP_PCT,
    DISTRIBUTION_WINDOW,
    DRY_UP_MAX_RATIO,
    POCKET_PIVOT_LOOKBACK,
    POCKET_PIVOT_MAX_ABOVE_SMA10_PCT,
    READY_MAX_BELOW_PIVOT_PCT,
    REGIME_BREADTH_OK,
    REGIME_BREADTH_WEAK,
    RS_LEADER_MIN,
    RS_MIN_SESSIONS,
    RS_WEIGHTS,
    SCAN_MIN_TURNOVER_CR,
    SCAN_ROWS,
    SECTOR_LEADER_SECTORS,
    SECTOR_LEADERS_PER_SECTOR,
)
from jobs.panel import wide

log = logging.getLogger("jobs.daily_scan")


def _r(v, dp: int = 2):
    return None if v is None or (isinstance(v, float) and not np.isfinite(v)) or pd.isna(v) else round(float(v), dp)


# --- RS rating -----------------------------------------------------------------


def rs_ratings(close: pd.DataFrame) -> pd.Series:
    """symbol -> 1..99. Weighted returns over each lookback, percentile-ranked across
    every symbol with at least RS_MIN_SESSIONS of history. A lookback longer than a
    symbol's history uses its full history (weights renormalised over what exists)."""
    last = close.iloc[-1]
    n_hist = close.notna().sum()
    score = pd.Series(0.0, index=close.columns)
    wsum = pd.Series(0.0, index=close.columns)
    for back, w in RS_WEIGHTS:
        if len(close) <= back:
            continue
        ret = last / close.iloc[-1 - back] - 1.0
        ok = ret.notna()
        score[ok] += w * ret[ok]
        wsum[ok] += w
    eligible = (n_hist >= RS_MIN_SESSIONS) & (wsum > 0) & last.notna()
    raw = (score[eligible] / wsum[eligible])
    if raw.empty:
        return pd.Series(dtype=float)
    pct = raw.rank(pct=True)
    return (pct * 98 + 1).round().clip(1, 99).astype(int)


# --- trend template (vectorised) ---------------------------------------------


def trend_template_mask(close: pd.DataFrame) -> pd.Series:
    """Minervini's template, same legs as jobs/patterns/base.py::trend_template, for
    every symbol at once. Missing inputs (short history) fail — this list is for
    established uptrends only."""
    last = close.iloc[-1]
    s50 = close.rolling(50).mean().iloc[-1]
    s150 = close.rolling(150).mean().iloc[-1]
    s200_series = close.rolling(200).mean()
    s200 = s200_series.iloc[-1]
    s200_prev = s200_series.iloc[-23] if len(close) >= 23 else pd.Series(np.nan, index=close.columns)
    year = close.tail(252)
    hi, lo = year.max(), year.min()
    return (
        (last > s50) & (last > s150) & (last > s200)
        & (s50 > s150) & (s150 > s200) & (s200 > s200_prev)
        & (last >= lo * 1.25) & (last >= hi * 0.75)
    ).fillna(False)


# --- market regime -----------------------------------------------------------


def distribution_days(index_close: pd.Series, volume: pd.Series) -> int:
    """Sessions in the last DISTRIBUTION_WINDOW where the index fell at least
    DISTRIBUTION_DAY_MIN_DROP_PCT on higher volume than the session before."""
    df = pd.DataFrame({"c": index_close, "v": volume}).dropna()
    chg = df["c"].pct_change() * 100
    dist = (chg <= -DISTRIBUTION_DAY_MIN_DROP_PCT) & (df["v"] > df["v"].shift())
    return int(dist.tail(DISTRIBUTION_WINDOW).sum())


def regime(index_close: pd.Series, dist_days: int, pct_above_50: float | None) -> dict:
    last = float(index_close.iloc[-1])
    s50 = float(index_close.tail(50).mean()) if len(index_close) >= 50 else None
    s200 = float(index_close.tail(200).mean()) if len(index_close) >= 200 else None
    above50 = s50 is not None and last > s50
    above200 = s200 is not None and last > s200

    reasons = [
        f"NIFTY 50 is {'above' if above50 else 'below'} its 50-day average"
        + (f" ({(last / s50 - 1) * 100:+.1f}%)" if s50 else ""),
        f"{'above' if above200 else 'below'} its 200-day average"
        + (f" ({(last / s200 - 1) * 100:+.1f}%)" if s200 else ""),
        f"{dist_days} distribution day{'s' if dist_days != 1 else ''} in the last {DISTRIBUTION_WINDOW} sessions"
        + (" — big players are selling" if dist_days >= DISTRIBUTION_CAUTION else ""),
    ]
    if pct_above_50 is not None:
        reasons.append(f"{pct_above_50:.0f}% of stocks are above their 50-day average")

    weak_breadth = pct_above_50 is not None and pct_above_50 < REGIME_BREADTH_WEAK
    ok_breadth = pct_above_50 is None or pct_above_50 >= REGIME_BREADTH_OK
    if not above200 or weak_breadth or (not above50 and dist_days >= DISTRIBUTION_CAUTION):
        light, label, advice = "red", "Stay defensive", "Avoid new buys. Protect open trades with tight stops."
    elif above50 and above200 and dist_days < DISTRIBUTION_CAUTION and ok_breadth:
        light, label, advice = "green", "Good to buy", "Breakouts have the best odds now. Normal position sizes."
    else:
        light, label, advice = "yellow", "Be selective", "Only the strongest setups, smaller size, quicker profits."
    return {
        "light": light,
        "label": label,
        "advice": advice,
        "reasons": reasons,
        "nifty_close": _r(last),
        "distribution_days": dist_days,
        "pct_above_50dma": _r(pct_above_50, 1),
    }


# --- build -------------------------------------------------------------------


def build(
    panel: pd.DataFrame,
    names: dict[str, str],
    screener_payload: dict,
    sector_payload: dict,
    breadth_card: dict | None,
    nifty: pd.DataFrame | None,
    nifty_constituents: list[str],
) -> tuple[dict, dict]:
    # Stocks only. The bhavcopy's EQ series also carries ~350 ETFs, liquid and index
    # funds (BANKBEES, silver/gold ETFs...) — they always show high delivery and would
    # top the delivery-spike list, and they distort RS ranks. NSE's equity list
    # (`names`) contains none of them.
    if names:
        panel = panel[panel["symbol"].isin(names.keys())]
    close = wide(panel, "close")
    volume = wide(panel, "volume")
    turnover = wide(panel, "turnover") if "turnover" in panel.columns else None
    delivery = wide(panel, "delivery_pct") if "delivery_pct" in panel.columns else None
    as_of = close.index[-1].date().isoformat()

    last = close.iloc[-1]
    prev = close.iloc[-2]
    chg_pct = (last / prev - 1) * 100
    vol_avg20 = volume.tail(21).iloc[:-1].mean()
    rel_vol = volume.iloc[-1] / vol_avg20
    liquid = (
        (turnover.tail(20).median() / 1e7 >= SCAN_MIN_TURNOVER_CR)
        if turnover is not None
        else pd.Series(True, index=close.columns)
    ).reindex(close.columns).fillna(False)

    rs = rs_ratings(close)
    template = trend_template_mask(close)
    dry_up = (volume.tail(5).mean() / volume.tail(50).mean()) <= DRY_UP_MAX_RATIO

    def row(sym: str, **extra) -> dict:
        return {
            "symbol": sym,
            "name": names.get(sym, sym),
            "ltp": _r(last.get(sym)),
            "change_pct": _r(chg_pct.get(sym)),
            "rs": int(rs[sym]) if sym in rs.index else None,
            "rel_volume": _r(rel_vol.get(sym)),
            **extra,
        }

    # --- ready today ---
    patterns = {r["symbol"]: r["patterns"][0] for r in screener_payload.get("rows", []) if r.get("patterns")}
    ready = []
    for sym, p in patterns.items():
        if sym not in rs.index or rs[sym] < RS_LEADER_MIN or not template.get(sym, False) or not liquid.get(sym, False):
            continue
        pivot = p.get("pivot_price")
        if p.get("stage") != "forming" or not pivot:
            continue
        gap = (last[sym] / pivot - 1) * 100
        if not (-READY_MAX_BELOW_PIVOT_PCT <= gap <= 0):
            continue
        ready.append(
            row(
                sym,
                pattern=p.get("code"),
                pivot=_r(pivot),
                gap_to_pivot_pct=_r(gap),
                stop=_r(p.get("stop_suggestion")),
                dry_up=bool(dry_up.get(sym, False)),
            )
        )
    ready.sort(key=lambda r: (-(r["rs"] or 0), -(r["gap_to_pivot_pct"] or -99)))

    # --- RS leaders (in a proper uptrend, liquid) ---
    leaders_idx = [s for s in rs.sort_values(ascending=False).index if template.get(s, False) and liquid.get(s, False)]
    rs_leaders = [row(s) for s in leaders_idx[:SCAN_ROWS]]

    # --- delivery spikes ---
    spikes = []
    if delivery is not None:
        d_last = delivery.iloc[-1]
        d_avg = delivery.tail(21).iloc[:-1].mean()
        mask = (
            (d_last >= d_avg * DELIVERY_SPIKE_MULT)
            & (d_last >= DELIVERY_SPIKE_MIN_PCT)
            & (chg_pct >= DELIVERY_SPIKE_MIN_GAIN_PCT)
            & (rel_vol >= DELIVERY_SPIKE_MIN_VOL_MULT)
            & liquid
        ).fillna(False)
        hits = sorted(mask[mask].index, key=lambda s: -(d_last[s] / d_avg[s]))
        spikes = [row(s, delivery_pct=_r(d_last[s], 1), delivery_avg_pct=_r(d_avg[s], 1)) for s in hits[:SCAN_ROWS]]

    # --- pocket pivots ---
    down = close.diff() < 0
    prior_vol = volume.iloc[-1 - POCKET_PIVOT_LOOKBACK : -1]
    prior_down = down.iloc[-1 - POCKET_PIVOT_LOOKBACK : -1]
    max_down_vol = prior_vol.where(prior_down).max()
    sma10 = close.rolling(10).mean().iloc[-1]
    sma50 = close.rolling(50).mean().iloc[-1]
    pp = (
        (last > prev)
        & (volume.iloc[-1] > max_down_vol)
        & (last > sma50)
        & ((last / sma10 - 1) * 100 <= POCKET_PIVOT_MAX_ABOVE_SMA10_PCT)
        & liquid
    ).fillna(False)
    pp_syms = sorted(pp[pp].index, key=lambda s: -(rs.get(s, 0)))
    pocket = [row(s) for s in pp_syms[:SCAN_ROWS]]

    # --- sector leaders ---
    sector_leaders = []
    for sec in (sector_payload.get("sectors") or [])[:SECTOR_LEADER_SECTORS]:
        members = [c["symbol"] for c in sec.get("constituents") or [] if c.get("symbol") in rs.index]
        top = sorted(members, key=lambda s: -rs[s])[:SECTOR_LEADERS_PER_SECTOR]
        sector_leaders.append(
            {"sector": sec.get("name"), "rank": sec.get("rank"), "return_1m": sec.get("return_1m"),
             "stocks": [row(s) for s in top]}
        )

    # --- regime ---
    market = None
    if nifty is not None and not nifty.empty:
        idx = nifty.set_index("date")["close"].sort_index()
        members = [s for s in nifty_constituents if s in volume.columns]
        nifty_vol = volume[members].sum(axis=1) if members else pd.Series(dtype=float)
        # Index volume proxy = combined volume of its constituents, aligned by date.
        dist = distribution_days(idx, nifty_vol.reindex(idx.index)) if not nifty_vol.empty else 0
        market = regime(idx, dist, (breadth_card or {}).get("pct_above_50dma"))

    payload = {
        "as_of": as_of,
        "market": market,
        "ready": ready[:SCAN_ROWS],
        "rs_leaders": rs_leaders,
        "delivery_spikes": spikes,
        "pocket_pivots": pocket,
        "sector_leaders": sector_leaders,
        "counts": {
            "rated": len(rs),
            "trend_template": int(template.sum()),
            "ready": len(ready),
            "delivery_spikes": len(spikes),
            "pocket_pivots": int(pp.sum()),
        },
    }
    stats = {"ok": market is not None, **payload["counts"]}
    log.info("daily_scan: %s", stats)
    return payload, stats
