from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date

from sqlalchemy import Select, and_, distinct, exists, func, select
from sqlalchemy.orm import Session

from app.models import DailyBar, DailyIndicator, PatternSignal, ScreenerScore, Sector, Symbol
from app.models.pattern_signal import PATTERN_CODES
from app.schemas.screener import ScreenerFacets, ScreenerResult, ScreenerRow

SORT_COLUMNS = {
    "composite": ScreenerScore.composite_score,
    "rsi": DailyIndicator.rsi_14,
    "rs": DailyIndicator.rs_vs_sector_1m,
    "delivery": DailyIndicator.delivery_pct_sma_20,
    "rel_volume": DailyIndicator.rel_volume,
    "ret_20d": DailyIndicator.ret_20d,
    "dist_52wh": DailyIndicator.dist_52w_high_pct,
}


@dataclass
class ScreenerQuery:
    sector: str | None = None
    fno_only: bool = False
    mcap_category: list[str] = field(default_factory=list)

    rsi_min: float | None = None
    rsi_max: float | None = None
    dist_52wh_min: float | None = None
    dist_52wh_max: float | None = None
    rel_volume_min: float | None = None
    delivery_min: float | None = None
    min_score: float | None = None
    above_sma_20: bool | None = None
    above_sma_50: bool | None = None
    above_sma_200: bool | None = None

    patterns: list[str] = field(default_factory=list)
    stage: str | None = None  # all | forming | confirmed | extended

    sort: str = "composite"
    order: str = "desc"
    page: int = 1
    per_page: int = 25


def _target_date(db: Session) -> date | None:
    return (
        db.execute(select(func.max(ScreenerScore.date))).scalar_one_or_none()
        or db.execute(select(func.max(DailyIndicator.date))).scalar_one_or_none()
    )


def _base(as_of: date) -> Select:
    ind, sc, bar = DailyIndicator, ScreenerScore, DailyBar
    return (
        select(Symbol, Sector.name.label("sector_name"), ind, sc, bar)
        .join(Sector, Sector.id == Symbol.sector_id, isouter=True)
        .join(ind, and_(ind.symbol_id == Symbol.id, ind.date == as_of), isouter=True)
        .join(sc, and_(sc.symbol_id == Symbol.id, sc.date == as_of), isouter=True)
        .join(bar, and_(bar.symbol_id == Symbol.id, bar.date == as_of), isouter=True)
        .where(Symbol.is_active.is_(True))
    )


def _pattern_predicate(as_of: date, q: ScreenerQuery):
    """EXISTS a pattern_signal today matching the pattern and/or stage filter."""
    conds = [PatternSignal.symbol_id == Symbol.id, PatternSignal.date == as_of]
    if q.patterns:
        conds.append(PatternSignal.pattern_code.in_(q.patterns))
    if q.stage and q.stage != "all":
        conds.append(PatternSignal.stage == q.stage)
    return exists(select(PatternSignal.symbol_id).where(and_(*conds)))


def _apply_filters(stmt: Select, q: ScreenerQuery, as_of: date, *, include_patterns: bool = True) -> Select:
    ind, sc = DailyIndicator, ScreenerScore
    if q.sector:
        stmt = stmt.where(Sector.slug == q.sector)
    if q.fno_only:
        stmt = stmt.where(Symbol.is_fno.is_(True))
    if q.mcap_category:
        stmt = stmt.where(Symbol.mcap_category.in_(q.mcap_category))
    if q.rsi_min is not None:
        stmt = stmt.where(ind.rsi_14 >= q.rsi_min)
    if q.rsi_max is not None:
        stmt = stmt.where(ind.rsi_14 <= q.rsi_max)
    if q.dist_52wh_min is not None:
        stmt = stmt.where(ind.dist_52w_high_pct >= q.dist_52wh_min)
    if q.dist_52wh_max is not None:
        stmt = stmt.where(ind.dist_52w_high_pct <= q.dist_52wh_max)
    if q.rel_volume_min is not None:
        stmt = stmt.where(ind.rel_volume >= q.rel_volume_min)
    if q.delivery_min is not None:
        stmt = stmt.where(ind.delivery_pct_sma_20 >= q.delivery_min)
    if q.min_score is not None:
        stmt = stmt.where(sc.composite_score >= q.min_score)
    for col, val in (
        (ind.above_sma_20, q.above_sma_20),
        (ind.above_sma_50, q.above_sma_50),
        (ind.above_sma_200, q.above_sma_200),
    ):
        if val is not None:
            stmt = stmt.where(col.is_(val))
    if include_patterns and (q.patterns or (q.stage and q.stage != "all")):
        stmt = stmt.where(_pattern_predicate(as_of, q))
    return stmt


def _patterns_by_symbol(db: Session, as_of: date, symbol_ids: list[int]) -> dict[int, list[str]]:
    if not symbol_ids:
        return {}
    rows = db.execute(
        select(PatternSignal.symbol_id, PatternSignal.pattern_code)
        .where(PatternSignal.date == as_of, PatternSignal.symbol_id.in_(symbol_ids))
        .order_by(PatternSignal.confidence.desc())
    ).all()
    out: dict[int, list[str]] = {}
    for sid, code in rows:
        out.setdefault(sid, []).append(code)
    return out


def _pattern_facets(db: Session, q: ScreenerQuery, as_of: date) -> tuple[dict[str, int], dict[str, int]]:
    """Count matching symbols per pattern and per stage over the filtered set, but
    *ignoring* the pattern/stage filter itself so toggling one doesn't zero the others."""
    base = _apply_filters(_base(as_of), q, as_of, include_patterns=False)
    sub = base.with_only_columns(Symbol.id).order_by(None).subquery()
    stage_chosen = bool(q.stage and q.stage != "all")

    by_pattern = dict(
        db.execute(
            select(PatternSignal.pattern_code, func.count(distinct(PatternSignal.symbol_id)))
            .where(
                PatternSignal.date == as_of,
                PatternSignal.symbol_id.in_(select(sub.c.id)),
                *([PatternSignal.stage == q.stage] if q.stage and q.stage != "all" else []),
            )
            .group_by(PatternSignal.pattern_code)
        ).all()
    )
    by_stage: dict[str, int] = {}
    if not stage_chosen:
        by_stage = dict(
            db.execute(
                select(PatternSignal.stage, func.count(distinct(PatternSignal.symbol_id)))
                .where(
                    PatternSignal.date == as_of,
                    PatternSignal.symbol_id.in_(select(sub.c.id)),
                    *([PatternSignal.pattern_code.in_(q.patterns)] if q.patterns else []),
                )
                .group_by(PatternSignal.stage)
            ).all()
        )
    # ensure every known code appears (0 when absent)
    for code in PATTERN_CODES:
        by_pattern.setdefault(code, 0)
    return by_pattern, by_stage


def run_screener(db: Session, q: ScreenerQuery) -> ScreenerResult:
    as_of = _target_date(db)
    empty_facets = ScreenerFacets(sectors={}, verdicts={}, patterns={}, stages={})
    if as_of is None:
        return ScreenerResult(
            rows=[],
            total=0,
            page=q.page,
            per_page=q.per_page,
            as_of=None,
            score_validated=False,
            facets=empty_facets,
        )

    filtered = _apply_filters(_base(as_of), q, as_of)
    total = db.execute(select(func.count()).select_from(filtered.order_by(None).subquery())).scalar_one()

    sort_col = SORT_COLUMNS.get(q.sort, ScreenerScore.composite_score)
    sort_col = sort_col.desc() if q.order == "desc" else sort_col.asc()
    page = max(1, q.page)
    rows = db.execute(
        filtered.order_by(sort_col.nulls_last()).limit(q.per_page).offset((page - 1) * q.per_page)
    ).all()

    sub = filtered.order_by(None).subquery()
    sector_counts = dict(
        db.execute(
            select(sub.c.sector_name, func.count())
            .where(sub.c.sector_name.isnot(None))
            .group_by(sub.c.sector_name)
        ).all()
    )
    verdict_counts = dict(
        db.execute(
            select(sub.c.verdict, func.count()).where(sub.c.verdict.isnot(None)).group_by(sub.c.verdict)
        ).all()
    )
    pattern_counts, stage_counts = _pattern_facets(db, q, as_of)

    page_symbol_ids = [sym.id for sym, *_ in rows]
    patterns_map = _patterns_by_symbol(db, as_of, page_symbol_ids)

    out: list[ScreenerRow] = []
    for sym, sector_name, ind, sc, bar in rows:
        ltp = float(bar.close) if bar and bar.close is not None else None
        prev = float(bar.prev_close) if bar and bar.prev_close is not None else None
        out.append(
            ScreenerRow(
                symbol=sym.nse_symbol,
                name=sym.name,
                sector=sector_name,
                is_fno=sym.is_fno,
                ltp=ltp,
                change_pct=((ltp / prev - 1) * 100) if ltp and prev else None,
                composite_score=_f(sc and sc.composite_score),
                verdict=sc.verdict if sc else None,
                inputs_present=sc.inputs_present if sc else None,
                rank_overall=sc.rank_overall if sc else None,
                momentum_score=_f(sc and sc.momentum_score),
                delivery_quality_score=_f(sc and sc.delivery_quality_score),
                relative_strength_score=_f(sc and sc.relative_strength_score),
                earnings_trend_score=_f(sc and sc.earnings_trend_score),
                rsi_14=_f(ind and ind.rsi_14),
                rs_vs_sector_1m=_f(ind and ind.rs_vs_sector_1m),
                dist_52w_high_pct=_f(ind and ind.dist_52w_high_pct),
                delivery_pct_sma_20=_f(ind and ind.delivery_pct_sma_20),
                rel_volume=_f(ind and ind.rel_volume),
                ret_20d=_f(ind and ind.ret_20d),
                above_sma_20=ind.above_sma_20 if ind else None,
                above_sma_50=ind.above_sma_50 if ind else None,
                above_sma_200=ind.above_sma_200 if ind else None,
                patterns=patterns_map.get(sym.id, []),
            )
        )

    return ScreenerResult(
        rows=out,
        total=total,
        page=page,
        per_page=q.per_page,
        as_of=as_of,
        score_validated=False,
        facets=ScreenerFacets(
            sectors=sector_counts,
            verdicts=verdict_counts,
            patterns=pattern_counts,
            stages=stage_counts,
        ),
    )


def _f(v) -> float | None:
    return float(v) if v is not None else None
