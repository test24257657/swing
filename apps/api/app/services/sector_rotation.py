from __future__ import annotations

from datetime import timedelta

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.models import DailyBar, IndexConstituent, MarketIndex, Sector, Symbol
from app.services.indices_data import TF_DAYS, close_frame, returns_for, rrg_points

BENCH = "NIFTY 500"


def sector_rotation(db: Session, tf: str = "1M") -> dict:
    tf = tf if tf in TF_DAYS else "1M"
    sectors = (
        db.execute(select(Sector).where(Sector.nse_index_symbol.isnot(None)).order_by(Sector.name))
        .scalars()
        .all()
    )
    idx_by_symbol = {m.symbol: m for m in db.execute(select(MarketIndex)).scalars()}

    ids = [idx_by_symbol[s.nse_index_symbol].id for s in sectors if s.nse_index_symbol in idx_by_symbol]
    bench_mi = idx_by_symbol.get(BENCH)
    if bench_mi:
        ids.append(bench_mi.id)
    frame = close_frame(db, ids)
    if frame.empty:
        return {"tf": tf, "as_of": None, "sectors": [], "ranked": [], "rrg": []}

    as_of = frame.index[-1].date()
    bench_series = frame[bench_mi.id] if bench_mi and bench_mi.id in frame else None

    # constituent counts + today's advancers per sector
    counts = dict(
        db.execute(select(IndexConstituent.index_id, func.count()).group_by(IndexConstituent.index_id)).all()
    )
    # advancers today, per sector (symbols mapped to that sector via symbols.sector_id)
    adv = dict(
        db.execute(
            select(
                Symbol.sector_id,
                func.sum(case((DailyBar.close > DailyBar.prev_close, 1), else_=0)),
            )
            .join(DailyBar, DailyBar.symbol_id == Symbol.id)
            .where(DailyBar.date == as_of, Symbol.sector_id.isnot(None), DailyBar.prev_close.isnot(None))
            .group_by(Symbol.sector_id)
        ).all()
    )

    rows = []
    for s in sectors:
        mi = idx_by_symbol.get(s.nse_index_symbol)
        if mi is None or mi.id not in frame:
            continue
        series = frame[mi.id]
        r_tf = returns_for(series, tf)
        r_3m = returns_for(series, "3M")
        rows.append(
            {
                "slug": s.slug,
                "name": s.name,
                "index_symbol": s.nse_index_symbol,
                "return_tf": round(r_tf, 2) if r_tf is not None else None,
                "return_3m": round(r_3m, 2) if r_3m is not None else None,
                "constituents": counts.get(mi.id, 0),
                "advancers": adv.get(s.id),
                "_series": series,
                "_mi_id": mi.id,
            }
        )

    ranked_now = sorted(
        [r for r in rows if r["return_tf"] is not None], key=lambda r: r["return_tf"], reverse=True
    )
    # rank ~3 weeks ago
    cutoff = as_of - timedelta(days=21)
    past = {}
    for r in rows:
        s = r["_series"]
        s_past = s[s.index.date <= cutoff]
        past[r["slug"]] = returns_for(s_past, tf) if len(s_past) > TF_DAYS[tf] else None
    ranked_past = sorted(
        [r for r in rows if past.get(r["slug"]) is not None],
        key=lambda r: past[r["slug"]],
        reverse=True,
    )
    past_rank = {r["slug"]: i for i, r in enumerate(ranked_past)}

    ranked = []
    for i, r in enumerate(ranked_now):
        pr = past_rank.get(r["slug"])
        ranked.append(
            {
                "rank": i + 1,
                "slug": r["slug"],
                "name": r["name"],
                "return_tf": r["return_tf"],
                "return_3m": r["return_3m"],
                "rank_change": (pr - i) if pr is not None else None,
            }
        )

    rrg = []
    if bench_series is not None:
        for r in rows:
            pt = rrg_points(bench_series, r["_series"])
            if pt:
                rrg.append({"slug": r["slug"], "name": r["name"], **pt})

    heatmap = [
        {
            "slug": r["slug"],
            "name": r["name"],
            "return_tf": r["return_tf"],
            "constituents": r["constituents"],
            "advancers": r["advancers"],
        }
        for r in rows
    ]
    return {"tf": tf, "as_of": as_of.isoformat(), "sectors": heatmap, "ranked": ranked, "rrg": rrg}
