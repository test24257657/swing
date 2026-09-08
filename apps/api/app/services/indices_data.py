"""Shared read helpers over ``indices`` / ``index_bars``.

RRG and returns for ~22 indices are computed on read from ``index_bars`` (small, no NSE
call), which keeps to the spirit of the precompute rule without a dedicated table.
"""

from __future__ import annotations

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import IndexBar, MarketIndex

TF_DAYS = {"1D": 1, "1W": 5, "1M": 21, "3M": 63, "6M": 126, "1Y": 252}


def index_map(db: Session) -> dict[str, MarketIndex]:
    return {m.symbol: m for m in db.execute(select(MarketIndex)).scalars()}


def close_frame(db: Session, index_ids: list[int]) -> pd.DataFrame:
    """DataFrame of index closes, columns = index_id, index = date, ascending."""
    if not index_ids:
        return pd.DataFrame()
    rows = db.execute(
        select(IndexBar.date, IndexBar.index_id, IndexBar.close).where(IndexBar.index_id.in_(index_ids))
    ).all()
    if not rows:
        return pd.DataFrame()
    df = pd.DataFrame(rows, columns=["date", "index_id", "close"])
    df["date"] = pd.to_datetime(df["date"])
    df["close"] = pd.to_numeric(df["close"], errors="coerce")
    return df.pivot_table(index="date", columns="index_id", values="close").sort_index()


def ohlc_row(db: Session, index_id: int) -> dict | None:
    rows = db.execute(
        select(IndexBar.date, IndexBar.open, IndexBar.high, IndexBar.low, IndexBar.close)
        .where(IndexBar.index_id == index_id)
        .order_by(IndexBar.date.desc())
        .limit(2)
    ).all()
    if not rows:
        return None
    d, o, h, low, c = rows[0]
    prev_c = float(rows[1].close) if len(rows) > 1 and rows[1].close is not None else None
    c = float(c)
    return {
        "date": d,
        "open": _f(o),
        "high": _f(h),
        "low": _f(low),
        "close": c,
        "prev_close": prev_c,
        "change": (c - prev_c) if prev_c is not None else None,
        "change_pct": ((c / prev_c - 1) * 100) if prev_c else None,
    }


def returns_for(series: pd.Series, tf: str) -> float | None:
    n = TF_DAYS.get(tf, 21)
    s = series.dropna()
    if len(s) <= n:
        return None
    return float((s.iloc[-1] / s.iloc[-1 - n] - 1) * 100)


def sparkline(series: pd.Series, points: int = 30) -> list[float]:
    return [round(float(v), 2) for v in series.dropna().tail(points).tolist()]


def percentile_rank(series: pd.Series, window: int = 250) -> float | None:
    s = series.dropna().tail(window)
    if len(s) < 20:
        return None
    last = s.iloc[-1]
    return round(float((s < last).mean() * 100), 1)


def rrg_points(bench: pd.Series, series: pd.Series, weeks: int = 6) -> dict | None:
    """JdK-style RS-Ratio / RS-Momentum, simplified per the design:
    X = 30-day RS ratio vs the benchmark, indexed to 100; Y = 10-week rate-of-change of
    that ratio. Returns the latest point plus ``weeks`` weekly tail points."""
    df = pd.concat([bench.rename("b"), series.rename("s")], axis=1).dropna()
    if len(df) < 130:
        return None
    rs = df["s"] / df["b"]
    rs_ratio = rs / rs.rolling(30).mean() * 100
    rs_mom = rs_ratio.pct_change(50) * 100 + 100  # ~10 weeks
    weekly = pd.concat([rs_ratio.rename("x"), rs_mom.rename("y")], axis=1).dropna()
    weekly = weekly.iloc[::-5][: weeks + 1][::-1]  # every 5th session, most recent last
    if len(weekly) < 2:
        return None
    return {
        "x": round(float(weekly["x"].iloc[-1]), 2),
        "y": round(float(weekly["y"].iloc[-1]), 2),
        "tail": [
            [round(float(x), 2), round(float(y), 2)] for x, y in zip(weekly["x"], weekly["y"], strict=False)
        ],
    }


def _f(v) -> float | None:
    return float(v) if v is not None else None
