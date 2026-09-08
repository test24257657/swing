from __future__ import annotations

import logging
from datetime import date, datetime

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.ingestion.run_context import ingestion_run
from app.ingestion.sectors_seed import SECTORS
from app.ingestion.sources.cache import raw_cache_path
from app.models import Sector, Symbol

log = logging.getLogger("swing.ingest.symbols")

JOB = "sync_symbols"


def _upsert_sectors(db: Session) -> dict[str, Sector]:
    existing = {s.slug: s for s in db.execute(select(Sector)).scalars()}
    for row in SECTORS:
        s = existing.get(row["slug"])
        if s is None:
            s = Sector(name=row["name"], slug=row["slug"], nse_index_symbol=row["index_symbol"])
            db.add(s)
            existing[row["slug"]] = s
        else:
            s.name = row["name"]
            s.nse_index_symbol = row["index_symbol"]
    db.commit()
    return existing


def _fetch_equity_list() -> pd.DataFrame:
    cache = raw_cache_path("equity_list", "nse-equity-list")
    if cache.exists() and cache.stat().st_size > 0:
        return pd.read_csv(cache)
    from nselib import capital_market

    df = pd.DataFrame(capital_market.equity_list())
    df.columns = [c.strip().upper() for c in df.columns]
    df.to_csv(cache, index=False)
    return df


def _fetch_fno_symbols() -> set[str]:
    try:
        from nselib import capital_market

        df = pd.DataFrame(capital_market.fno_equity_list())
        df.columns = [c.strip().lower() for c in df.columns]
        col = next((c for c in df.columns if "symbol" in c), None)
        return {str(v).strip().upper() for v in df[col]} if col else set()
    except Exception as exc:  # noqa: BLE001
        log.warning("F&O list unavailable: %s", exc)
        return set()


def _map_sector_constituents(db: Session, sectors: dict[str, Sector]) -> int:
    """Best-effort: assign symbols to sectors from each sectoral index's constituents."""
    from nselib import capital_market

    mapped = 0
    symbols_by_name = {s.nse_symbol: s for s in db.execute(select(Symbol)).scalars()}
    for slug, sector in sectors.items():
        if not sector.nse_index_symbol:
            continue
        try:
            raw = capital_market.index_data(sector.nse_index_symbol)
            df = pd.DataFrame(raw)
            df.columns = [c.strip().lower() for c in df.columns]
            col = next((c for c in df.columns if c in {"symbol", "indexsymbol"}), None)
            if not col:
                continue
            for sym in df[col]:
                s = symbols_by_name.get(str(sym).strip().upper())
                if s is not None and s.sector_id is None:
                    s.sector_id = sector.id
                    mapped += 1
        except Exception as exc:  # noqa: BLE001 - never let one index break the job
            log.warning("constituents for %s failed: %s", sector.nse_index_symbol, exc)
    db.commit()
    return mapped


def run(business_date: date | None = None) -> None:
    business_date = business_date or date.today()
    db = SessionLocal()
    try:
        with ingestion_run(db, JOB, business_date) as run_row:
            sectors = _upsert_sectors(db)

            df = _fetch_equity_list()
            fno = _fetch_fno_symbols()

            existing = {s.nse_symbol: s for s in db.execute(select(Symbol)).scalars()}
            written = 0
            for r in df.to_dict("records"):
                sym = str(r.get("SYMBOL", "")).strip().upper()
                if not sym:
                    continue
                listing = None
                raw_listing = str(r.get("DATE OF LISTING", "")).strip()
                for fmt in ("%d-%b-%Y", "%d-%b-%y", "%Y-%m-%d"):
                    try:
                        listing = datetime.strptime(raw_listing, fmt).date()
                        break
                    except ValueError:
                        continue

                s = existing.get(sym)
                if s is None:
                    s = Symbol(nse_symbol=sym, name=str(r.get("NAME OF COMPANY", sym)).strip())
                    db.add(s)
                    existing[sym] = s
                s.name = str(r.get("NAME OF COMPANY", s.name)).strip()
                s.isin = (str(r.get("ISIN NUMBER", "")).strip() or None)
                s.series = str(r.get(" SERIES", r.get("SERIES", "EQ"))).strip() or "EQ"
                s.listing_date = listing
                s.is_fno = sym in fno
                s.is_active = True
                written += 1

            db.commit()
            mapped = _map_sector_constituents(db, sectors)

            run_row.rows_written = written
            run_row.source_stats = {
                "symbols": written,
                "fno_flagged": len(fno),
                "sector_constituents_mapped": mapped,
                "sources": ["nselib.equity_list", "nselib.fno_equity_list", "nselib.index_data"],
            }
            run_row.status = "success" if written else "partial"
        log.info("sync_symbols done: %s symbols", run_row.rows_written)
    finally:
        db.close()


if __name__ == "__main__":
    logging.basicConfig(level="INFO")
    run()
