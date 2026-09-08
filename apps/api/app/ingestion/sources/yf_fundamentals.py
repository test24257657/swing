from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import date

from app.ingestion.sources.cache import raw_cache_path

log = logging.getLogger("swing.ingest.fundamentals")


@dataclass
class QuarterRow:
    period_end: date
    revenue: float | None
    net_profit: float | None
    eps: float | None


@dataclass
class FundamentalsResult:
    quarters: list[QuarterRow]
    pe: float | None
    pb: float | None
    roe: float | None
    debt_equity: float | None


_REVENUE_KEYS = ("Total Revenue", "TotalRevenue", "Operating Revenue")
_PROFIT_KEYS = ("Net Income", "NetIncome", "Net Income Common Stockholders")
_EPS_KEYS = ("Diluted EPS", "DilutedEPS", "Basic EPS")


def _first_row(df, keys):
    for k in keys:
        if k in df.index:
            return df.loc[k]
    return None


def fetch(nse_symbol: str, *, use_cache: bool = True) -> FundamentalsResult | None:
    """Quarterly revenue / net profit / EPS + a few ratios for one symbol via yfinance.

    yfinance lags NSE by a day or two after results and is US-centric — secondary source.
    Returns None (not an exception) on any failure so the job records a miss and moves on.
    """
    cache = raw_cache_path("fundamentals", nse_symbol, suffix=".json")
    if use_cache and cache.exists() and cache.stat().st_size > 0:
        try:
            return _from_cache(json.loads(cache.read_text()))
        except Exception:  # noqa: BLE001 - a bad cache file should not be fatal
            pass

    try:
        import yfinance as yf

        t = yf.Ticker(f"{nse_symbol}.NS")
        q = t.quarterly_income_stmt
        info = t.info or {}

        quarters: list[QuarterRow] = []
        if q is not None and not q.empty:
            rev = _first_row(q, _REVENUE_KEYS)
            prof = _first_row(q, _PROFIT_KEYS)
            eps = _first_row(q, _EPS_KEYS)
            for col in q.columns:
                pe = col.date() if hasattr(col, "date") else None
                if pe is None:
                    continue
                quarters.append(
                    QuarterRow(
                        period_end=pe,
                        revenue=_num(rev, col),
                        net_profit=_num(prof, col),
                        eps=_num(eps, col),
                    )
                )

        result = FundamentalsResult(
            quarters=sorted(quarters, key=lambda r: r.period_end),
            pe=_info_num(info, "trailingPE"),
            pb=_info_num(info, "priceToBook"),
            roe=_info_num(info, "returnOnEquity", scale=100),
            debt_equity=_info_num(info, "debtToEquity"),
        )
        cache.write_text(json.dumps(_to_cache(result), default=str))
        return result
    except Exception as exc:  # noqa: BLE001
        log.warning("yfinance %s failed: %s", nse_symbol, exc)
        return None


def _num(row, col) -> float | None:
    if row is None:
        return None
    try:
        v = float(row[col])
        return v if v == v else None  # NaN check
    except (KeyError, TypeError, ValueError):
        return None


def _info_num(info: dict, key: str, scale: float = 1.0) -> float | None:
    v = info.get(key)
    try:
        return float(v) * scale if v is not None else None
    except (TypeError, ValueError):
        return None


def _to_cache(r: FundamentalsResult) -> dict:
    return {
        "quarters": [
            {
                "period_end": q.period_end.isoformat(),
                "revenue": q.revenue,
                "net_profit": q.net_profit,
                "eps": q.eps,
            }
            for q in r.quarters
        ],
        "pe": r.pe,
        "pb": r.pb,
        "roe": r.roe,
        "debt_equity": r.debt_equity,
    }


def _from_cache(d: dict) -> FundamentalsResult:
    return FundamentalsResult(
        quarters=[
            QuarterRow(
                period_end=date.fromisoformat(q["period_end"]),
                revenue=q["revenue"],
                net_profit=q["net_profit"],
                eps=q["eps"],
            )
            for q in d.get("quarters", [])
        ],
        pe=d.get("pe"),
        pb=d.get("pb"),
        roe=d.get("roe"),
        debt_equity=d.get("debt_equity"),
    )
