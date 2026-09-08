from __future__ import annotations

import json
import logging
from dataclasses import asdict
from datetime import date

from app.backtest import BacktestConfig, run_backtest
from app.db.session import SessionLocal
from app.models import BacktestRun
from app.models.screener_score import SCORE_VERSION

log = logging.getLogger("swing.backtest")


def run() -> dict:
    db = SessionLocal()
    try:
        cfg = BacktestConfig()
        report = run_backtest(db, cfg)
        row = BacktestRun(
            score_version=SCORE_VERSION,
            period_start=report.period_start or date.today(),
            period_end=report.period_end or date.today(),
            benchmark=cfg.benchmark,
            config=asdict(cfg),
            strategy_cagr=report.strategy_cagr,
            benchmark_cagr=report.benchmark_cagr,
            excess_cagr=report.excess_cagr,
            max_drawdown=report.max_drawdown,
            sharpe=report.sharpe,
            hit_rate=report.hit_rate,
            beats_benchmark=report.beats_benchmark,
            equity_curve=report.equity_curve,
        )
        db.add(row)
        db.commit()
        out = asdict(report)
        log.info("backtest: %s", json.dumps({k: v for k, v in out.items() if k != "equity_curve"}))
        if report.beats_benchmark is False:
            log.warning(
                "Composite score v%s does NOT beat %s (excess CAGR %s). "
                "It ships as a sort key only until this passes.",
                SCORE_VERSION,
                cfg.benchmark,
                report.excess_cagr,
            )
        return out
    finally:
        db.close()


if __name__ == "__main__":
    logging.basicConfig(level="INFO")
    print(json.dumps({k: v for k, v in run().items() if k != "equity_curve"}, indent=2))
