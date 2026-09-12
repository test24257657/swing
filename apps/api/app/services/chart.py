from __future__ import annotations

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import DailyBar, DailyIndicator, Symbol
from app.patterns.support_resistance import detect_sr

TF_DAYS = {"1M": 21, "3M": 63, "6M": 126, "1Y": 252, "3Y": 756}


def _bars(db: Session, symbol_id: int, limit: int) -> pd.DataFrame:
    rows = db.execute(
        select(
            DailyBar.date,
            DailyBar.open,
            DailyBar.high,
            DailyBar.low,
            DailyBar.close,
            DailyBar.volume,
            DailyBar.adj_factor,
        )
        .where(DailyBar.symbol_id == symbol_id)
        .order_by(DailyBar.date.desc())
        .limit(limit)
    ).all()
    if not rows:
        return pd.DataFrame()
    df = pd.DataFrame(rows, columns=["date", "open", "high", "low", "close", "volume", "adj"])
    df["date"] = pd.to_datetime(df["date"])
    for c in ("open", "high", "low", "close", "volume", "adj"):
        df[c] = pd.to_numeric(df[c], errors="coerce")
    df["adj"] = df["adj"].fillna(1.0)
    df = df.set_index("date").sort_index()
    for c in ("open", "high", "low", "close"):
        df[c] = df[c] * df["adj"]
    return df


def symbol_chart(db: Session, nse_symbol: str, tf: str = "6M") -> dict | None:
    sym = db.execute(select(Symbol).where(Symbol.nse_symbol == nse_symbol.upper())).scalar_one_or_none()
    if sym is None:
        return None

    want = TF_DAYS.get(tf, 126)
    df = _bars(db, sym.id, want + 220)  # extra for 200 DMA warm-up
    if df.empty:
        return {"symbol": sym.nse_symbol, "name": sym.name, "bars": [], "mas": {}, "sr": [], "patterns": []}

    sr = detect_sr(df)
    view = df.tail(want)

    ind_rows = db.execute(
        select(DailyIndicator.date, DailyIndicator.sma_20, DailyIndicator.sma_50, DailyIndicator.sma_200)
        .where(DailyIndicator.symbol_id == sym.id, DailyIndicator.date >= view.index[0].date())
        .order_by(DailyIndicator.date)
    ).all()
    mas = {"sma_20": [], "sma_50": [], "sma_200": []}
    for d, s20, s50, s200 in ind_rows:
        t = d.isoformat()
        for key, v in (("sma_20", s20), ("sma_50", s50), ("sma_200", s200)):
            if v is not None:
                mas[key].append({"time": t, "value": round(float(v), 2)})

    # PatternSignal was dropped from app.models with the Plan A migration (patterns are
    # now computed by jobs/screener.py and served from the out/screener.json artifact,
    # not this Postgres-backed path) — this endpoint is parked (see main.py) and never
    # wired up, so patterns just ships empty rather than querying a table that no
    # longer exists.
    patterns: list[dict] = []

    return {
        "symbol": sym.nse_symbol,
        "name": sym.name,
        "tf": tf,
        "bars": [
            {
                "time": d.date().isoformat(),
                "open": round(float(r.open), 2),
                "high": round(float(r.high), 2),
                "low": round(float(r.low), 2),
                "close": round(float(r.close), 2),
                "volume": int(r.volume) if pd.notna(r.volume) else 0,
            }
            for d, r in view.iterrows()
        ],
        "mas": mas,
        "sr": [{"price": s.price, "kind": s.kind, "touches": s.touches, "strength": s.strength} for s in sr],
        "patterns": patterns,
        "as_of": view.index[-1].date().isoformat(),
    }
