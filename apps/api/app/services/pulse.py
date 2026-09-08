from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import FiiDiiFlow, MarketBreadth
from app.services.indices_data import (
    close_frame,
    index_map,
    ohlc_row,
    percentile_rank,
    sparkline,
)

TILE_SYMBOLS = ["NIFTY 50", "NIFTY BANK", "NIFTY 500", "INDIA VIX"]


def _vix_verdict(value: float, pctile: float | None) -> tuple[str, str]:
    if value < 13:
        return "Low volatility — trend-friendly", "Favour breakout continuation; wider stops unnecessary."
    if value < 18:
        return "Moderate volatility", "Normal conditions; standard position sizing."
    if value < 24:
        return "Elevated volatility", "Trim size; expect wider swings and more failed breakouts."
    return "High volatility — defensive", "Momentum setups fail more often here; wait for it to cool."


def market_pulse(db: Session) -> dict:
    imap = index_map(db)
    tiles = []
    for sym in TILE_SYMBOLS:
        mi = imap.get(sym)
        if mi is None:
            continue
        row = ohlc_row(db, mi.id)
        if row is None:
            continue
        series = close_frame(db, [mi.id])
        spark = sparkline(series[mi.id], 30) if not series.empty and mi.id in series else []
        tiles.append(
            {
                "symbol": sym,
                "name": mi.name,
                "value": row["close"],
                "change": row["change"],
                "change_pct": row["change_pct"],
                "spark": spark,
                "as_of": row["date"].isoformat(),
            }
        )

    breadth_row = db.execute(
        select(MarketBreadth).order_by(MarketBreadth.date.desc()).limit(1)
    ).scalar_one_or_none()
    breadth = None
    if breadth_row:
        adv, dec = breadth_row.advances, breadth_row.declines
        breadth = {
            "date": breadth_row.date.isoformat(),
            "advances": adv,
            "declines": dec,
            "unchanged": breadth_row.unchanged,
            "traded": breadth_row.traded,
            "ad_ratio": round(adv / dec, 2) if dec else None,
            "pct_above_50dma": _f(breadth_row.pct_above_50dma),
            "pct_above_200dma": _f(breadth_row.pct_above_200dma),
            "new_52w_highs": breadth_row.new_52w_highs,
            "new_52w_lows": breadth_row.new_52w_lows,
        }

    flow_rows = (
        db.execute(
            select(FiiDiiFlow).where(FiiDiiFlow.segment == "cash").order_by(FiiDiiFlow.date.desc()).limit(10)
        )
        .scalars()
        .all()
    )
    flows = list(
        reversed(
            [
                {
                    "date": r.date.isoformat(),
                    "fii_net": _f(r.fii_net),
                    "dii_net": _f(r.dii_net),
                }
                for r in flow_rows
            ]
        )
    )
    fii_10 = sum(f["fii_net"] for f in flows if f["fii_net"] is not None) or None
    dii_10 = sum(f["dii_net"] for f in flows if f["dii_net"] is not None) or None

    vix = None
    vmi = imap.get("INDIA VIX")
    if vmi is not None:
        row = ohlc_row(db, vmi.id)
        series = close_frame(db, [vmi.id])
        if row is not None:
            pctile = percentile_rank(series[vmi.id], 250) if vmi.id in series else None
            headline, advice = _vix_verdict(row["close"], pctile)
            vix = {
                "value": row["close"],
                "change": row["change"],
                "change_pct": row["change_pct"],
                "percentile_250d": pctile,
                "verdict": headline,
                "advice": advice,
            }

    return {
        "tiles": tiles,
        "breadth": breadth,
        "flows": {"series": flows, "fii_10_session_net": fii_10, "dii_10_session_net": dii_10},
        "vix": vix,
    }


def _f(v) -> float | None:
    return float(v) if v is not None else None
