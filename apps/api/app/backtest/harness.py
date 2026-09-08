"""Backtest harness for the composite score.

The rule from the brief: if the score does not beat buying the index over 2–3 years of
history net of costs, it is decoration. This harness is how we check.

Strategy under test: on each rebalance date, hold an equal-weight basket of the top
``top_n`` symbols by composite score; hold to the next rebalance. Compared against
buy-and-hold of the benchmark index (default NIFTY 500).

Caveats it does not yet handle (documented, not hidden): survivorship bias (uses the
current symbol master), point-in-time index membership, and a short history window if the
backfill is shallow. The run report states the actual window length.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date

import numpy as np
import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import DailyBar, IndexBar, MarketIndex, ScreenerScore


@dataclass
class BacktestConfig:
    top_n: int = 20
    rebalance_days: int = 5  # weekly
    cost_bps: float = 15.0  # per side
    benchmark: str = "NIFTY 500"
    min_composite: float = 0.0
    hold_min_score: float | None = None  # exit a name if its score drops below this


@dataclass
class BacktestReport:
    period_start: date | None
    period_end: date | None
    trading_days: int
    strategy_cagr: float | None
    benchmark_cagr: float | None
    excess_cagr: float | None
    max_drawdown: float | None
    sharpe: float | None
    hit_rate: float | None
    beats_benchmark: bool | None
    note: str
    equity_curve: dict = field(default_factory=dict)


def _score_matrix(db: Session) -> pd.DataFrame:
    rows = db.execute(
        select(ScreenerScore.date, ScreenerScore.symbol_id, ScreenerScore.composite_score)
    ).all()
    if not rows:
        return pd.DataFrame()
    df = pd.DataFrame(rows, columns=["date", "symbol_id", "score"])
    df["date"] = pd.to_datetime(df["date"])
    return df.pivot_table(index="date", columns="symbol_id", values="score").sort_index()


def _price_matrix(db: Session, symbol_ids: list[int]) -> pd.DataFrame:
    rows = db.execute(
        select(DailyBar.date, DailyBar.symbol_id, DailyBar.close, DailyBar.adj_factor).where(
            DailyBar.symbol_id.in_(symbol_ids)
        )
    ).all()
    df = pd.DataFrame(rows, columns=["date", "symbol_id", "close", "adj"])
    df["date"] = pd.to_datetime(df["date"])
    df["px"] = pd.to_numeric(df["close"], errors="coerce") * pd.to_numeric(df["adj"], errors="coerce").fillna(
        1.0
    )
    return df.pivot_table(index="date", columns="symbol_id", values="px").sort_index()


def _benchmark_series(db: Session, symbol: str) -> pd.Series:
    idx = db.execute(select(MarketIndex.id).where(MarketIndex.symbol == symbol)).scalar_one_or_none()
    if idx is None:
        return pd.Series(dtype=float)
    rows = db.execute(
        select(IndexBar.date, IndexBar.close).where(IndexBar.index_id == idx).order_by(IndexBar.date)
    ).all()
    s = pd.Series([float(c) for _, c in rows], index=pd.to_datetime([d for d, _ in rows]))
    return s


def _cagr(equity: pd.Series) -> float | None:
    if len(equity) < 2 or equity.iloc[0] <= 0:
        return None
    years = (equity.index[-1] - equity.index[0]).days / 365.25
    if years <= 0:
        return None
    return float((equity.iloc[-1] / equity.iloc[0]) ** (1 / years) - 1) * 100.0


def _max_dd(equity: pd.Series) -> float | None:
    if equity.empty:
        return None
    return float((equity / equity.cummax() - 1.0).min()) * 100.0


def run_backtest(db: Session, cfg: BacktestConfig | None = None) -> BacktestReport:
    cfg = cfg or BacktestConfig()
    scores = _score_matrix(db)
    if scores.empty or len(scores) < cfg.rebalance_days * 3:
        return BacktestReport(
            None,
            None,
            len(scores),
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            note=(
                "Not enough score history to backtest. Backfill bhavcopy, run "
                "`compute_indicators --full` and `compute_scores --backfill`, then re-run."
            ),
        )

    price = _price_matrix(db, [int(c) for c in scores.columns])
    price = price.reindex(scores.index).ffill()
    daily_ret = price.pct_change(fill_method=None)

    rebal_dates = scores.index[:: cfg.rebalance_days]
    equity = 1.0
    curve: list[tuple[pd.Timestamp, float]] = []
    holdings: list[int] = []
    period_returns: list[float] = []

    for i, d in enumerate(scores.index):
        if d in rebal_dates:
            row = scores.loc[d].dropna()
            row = row[row >= cfg.min_composite]
            new = list(row.sort_values(ascending=False).head(cfg.top_n).index)
            turnover = len(set(new) ^ set(holdings)) / max(len(new), 1)
            equity *= 1 - turnover * cfg.cost_bps / 10_000 * 2
            holdings = new
        if holdings:
            r = daily_ret.loc[d, holdings].mean(skipna=True)
            if pd.notna(r):
                equity *= 1 + r
                if d in rebal_dates and i > 0:
                    period_returns.append(r)
        curve.append((d, equity))

    strat = pd.Series([v for _, v in curve], index=[t for t, _ in curve])

    bench = _benchmark_series(db, cfg.benchmark).reindex(strat.index).ffill().dropna()
    bench_norm = (bench / bench.iloc[0]) if not bench.empty else pd.Series(dtype=float)

    strat_cagr = _cagr(strat)
    bench_cagr = _cagr(bench_norm) if not bench_norm.empty else None
    rets = strat.pct_change(fill_method=None).dropna()
    sharpe = float(rets.mean() / rets.std() * np.sqrt(252)) if rets.std() > 0 else None
    hit = float(np.mean([1.0 if r > 0 else 0.0 for r in period_returns]) * 100.0) if period_returns else None
    excess = strat_cagr - bench_cagr if strat_cagr is not None and bench_cagr is not None else None

    return BacktestReport(
        period_start=strat.index[0].date(),
        period_end=strat.index[-1].date(),
        trading_days=len(strat),
        strategy_cagr=round(strat_cagr, 2) if strat_cagr is not None else None,
        benchmark_cagr=round(bench_cagr, 2) if bench_cagr is not None else None,
        excess_cagr=round(excess, 2) if excess is not None else None,
        max_drawdown=round(_max_dd(strat), 2) if _max_dd(strat) is not None else None,
        sharpe=round(sharpe, 3) if sharpe is not None else None,
        hit_rate=round(hit, 2) if hit is not None else None,
        beats_benchmark=(excess is not None and excess > 0),
        note=(
            f"Window {strat.index[0].date()}–{strat.index[-1].date()} "
            f"({(strat.index[-1] - strat.index[0]).days / 365.25:.1f}y). "
            "Not survivorship-bias adjusted; uses the current symbol master."
        ),
        equity_curve={
            "dates": [d.strftime("%Y-%m-%d") for d in strat.index[::5]],
            "strategy": [round(v, 4) for v in strat.values[::5]],
            "benchmark": (
                [round(v, 4) for v in bench_norm.reindex(strat.index).ffill().values[::5]]
                if not bench_norm.empty
                else []
            ),
        },
    )
