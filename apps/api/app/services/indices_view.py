from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import DailyBar, IndexBar, IndexConstituent, MarketIndex, Symbol
from app.services.indices_data import (
    TF_DAYS,
    close_frame,
    index_map,
    ohlc_row,
    returns_for,
    sparkline,
)

CATEGORIES = {"broad", "sectoral", "thematic", "strategy"}


def indices_list(db: Session, category: str | None = None) -> dict:
    q = select(MarketIndex).order_by(MarketIndex.category, MarketIndex.name)
    if category and category in CATEGORIES:
        q = q.where(MarketIndex.category == category)
    indices = db.execute(q).scalars().all()
    ids = [m.id for m in indices]
    frame = close_frame(db, ids)
    as_of = frame.index[-1].date().isoformat() if not frame.empty else None

    rows = []
    for m in indices:
        row = ohlc_row(db, m.id)
        if row is None:
            continue
        series = frame.get(m.id)
        rows.append(
            {
                "symbol": m.symbol,
                "name": m.name,
                "category": m.category,
                "value": row["close"],
                "change": row["change"],
                "change_pct": row["change_pct"],
                "open": row["open"],
                "high": row["high"],
                "low": row["low"],
                "prev_close": row["prev_close"],
                "ret_1w": _r(series, "1W"),
                "ret_1m": _r(series, "1M"),
                "ret_3m": _r(series, "3M"),
                "dist_52w_high_pct": _dist_52wh(series),
                "spark": sparkline(series, 30) if series is not None else [],
            }
        )
    return {"as_of": as_of, "count": len(rows), "indices": rows}


def index_detail(db: Session, symbol: str, tf: str = "3M") -> dict | None:
    mi = index_map(db).get(symbol.upper())
    if mi is None:
        return None
    n = TF_DAYS.get(tf, 63)
    bars = db.execute(
        select(IndexBar.date, IndexBar.open, IndexBar.high, IndexBar.low, IndexBar.close)
        .where(IndexBar.index_id == mi.id)
        .order_by(IndexBar.date.desc())
        .limit(n + 5)
    ).all()
    bars = list(reversed(bars))
    head = ohlc_row(db, mi.id)
    return {
        "symbol": mi.symbol,
        "name": mi.name,
        "category": mi.category,
        "head": head,
        "bars": [
            {
                "date": d.isoformat(),
                "open": _f(o),
                "high": _f(h),
                "low": _f(low),
                "close": _f(c),
            }
            for d, o, h, low, c in bars
        ],
    }


def index_constituents(db: Session, symbol: str) -> dict | None:
    mi = index_map(db).get(symbol.upper())
    if mi is None:
        return None
    members = db.execute(
        select(Symbol, IndexConstituent.weight)
        .join(IndexConstituent, IndexConstituent.symbol_id == Symbol.id)
        .where(IndexConstituent.index_id == mi.id)
    ).all()
    if not members:
        return {"symbol": mi.symbol, "name": mi.name, "constituents": [], "note": "membership unavailable"}

    ids = [s.id for s, _ in members]
    last_date = db.execute(
        select(func.max(DailyBar.date)).where(DailyBar.symbol_id.in_(ids))
    ).scalar_one_or_none()
    bars = {
        sid: (float(c), float(p) if p is not None else None)
        for sid, c, p in db.execute(
            select(DailyBar.symbol_id, DailyBar.close, DailyBar.prev_close).where(
                DailyBar.symbol_id.in_(ids), DailyBar.date == last_date
            )
        ).all()
    }
    equal_w = 100.0 / len(members)
    out = []
    for s, w in members:
        c, p = bars.get(s.id, (None, None))
        chg = ((c / p - 1) * 100) if c and p else None
        weight = float(w) if w is not None else equal_w
        out.append(
            {
                "symbol": s.nse_symbol,
                "name": s.name,
                "ltp": c,
                "change_pct": round(chg, 2) if chg is not None else None,
                "weight": round(weight, 3),
                "points": round(weight / 100 * chg, 3) if chg is not None else None,
            }
        )
    out.sort(key=lambda r: (r["points"] is None, -(r["points"] or 0)))
    return {
        "symbol": mi.symbol,
        "name": mi.name,
        "as_of": last_date.isoformat() if last_date else None,
        "constituents": out,
        "weights_estimated": all(w is None for _, w in members),
    }


def index_compare(db: Session, symbols: list[str], tf: str = "3M") -> dict:
    imap = index_map(db)
    picked = [imap[s.upper()] for s in symbols if s.upper() in imap][:5]
    n = TF_DAYS.get(tf, 63)
    frame = close_frame(db, [m.id for m in picked])
    series = []
    dates: list[str] = []
    for m in picked:
        if m.id not in frame:
            continue
        s = frame[m.id].dropna().tail(n)
        if s.empty:
            continue
        if not dates:
            dates = [d.strftime("%Y-%m-%d") for d in s.index]
        base = s.iloc[0]
        series.append(
            {
                "symbol": m.symbol,
                "name": m.name,
                "normalized": [round(float(v / base * 100), 2) for v in s],
                "return_pct": round(float((s.iloc[-1] / base - 1) * 100), 2),
            }
        )
    return {"tf": tf, "dates": dates, "series": series}


def _r(series, tf: str):
    if series is None:
        return None
    r = returns_for(series, tf)
    return round(r, 2) if r is not None else None


def _dist_52wh(series):
    if series is None:
        return None
    s = series.dropna().tail(252)
    if len(s) < 20:
        return None
    return round(float((s.iloc[-1] / s.max() - 1) * 100), 2)


def _f(v):
    return float(v) if v is not None else None
