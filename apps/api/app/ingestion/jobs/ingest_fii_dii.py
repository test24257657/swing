from __future__ import annotations

import logging
from datetime import date

import pandas as pd
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.db.session import SessionLocal
from app.ingestion.calendar import last_trading_day
from app.ingestion.run_context import ingestion_run
from app.ingestion.sources.cache import raw_cache_path
from app.models import FiiDiiFlow

log = logging.getLogger("swing.ingest.fiidii")

JOB = "ingest_fii_dii"


def _to_num(v) -> float | None:
    try:
        f = float(str(v).replace(",", "").strip())
        return f if pd.notna(f) else None
    except (ValueError, TypeError):
        return None


def _fetch() -> pd.DataFrame:
    cache = raw_cache_path("fii_dii", f"activity-{last_trading_day().isoformat()}")
    if cache.exists() and cache.stat().st_size > 0:
        return pd.read_csv(cache)
    from nselib import capital_market

    df = pd.DataFrame(capital_market.fii_dii_trading_activity())
    df.columns = [c.strip().lower() for c in df.columns]
    df.to_csv(cache, index=False)
    return df


def run(business_date: date | None = None) -> None:
    end = business_date or last_trading_day()
    db = SessionLocal()
    try:
        with ingestion_run(db, JOB, end) as run_row:
            df = _fetch()
            date_col = next((c for c in df.columns if "date" in c), None)
            cat_col = next((c for c in df.columns if "categor" in c), None)
            buy_col = next((c for c in df.columns if "buy" in c), None)
            sell_col = next((c for c in df.columns if "sell" in c), None)
            net_col = next((c for c in df.columns if "net" in c), None)
            if not (date_col and cat_col):
                run_row.status = "partial"
                run_row.source_stats = {"note": "unrecognised columns", "columns": list(df.columns)}
                return

            # collapse to one row per date: {date: {fii_*, dii_*}}
            by_date: dict[date, dict] = {}
            for r in df.to_dict("records"):
                d = pd.to_datetime(r[date_col], dayfirst=True, errors="coerce")
                if pd.isna(d):
                    continue
                d = d.date()
                cat = str(r[cat_col]).upper()
                who = "fii" if ("FII" in cat or "FPI" in cat) else "dii" if "DII" in cat else None
                if who is None:
                    continue
                slot = by_date.setdefault(d, {})
                slot[f"{who}_buy"] = _to_num(r.get(buy_col))
                slot[f"{who}_sell"] = _to_num(r.get(sell_col))
                net = _to_num(r.get(net_col))
                if net is None and slot.get(f"{who}_buy") is not None and slot.get(f"{who}_sell") is not None:
                    net = slot[f"{who}_buy"] - slot[f"{who}_sell"]
                slot[f"{who}_net"] = net

            payload = [{"date": d, "segment": "cash", **vals} for d, vals in by_date.items()]
            if payload:
                stmt = pg_insert(FiiDiiFlow).values(payload)
                stmt = stmt.on_conflict_do_update(
                    index_elements=["date", "segment"],
                    set_={
                        c: stmt.excluded[c]
                        for c in ("fii_buy", "fii_sell", "fii_net", "dii_buy", "dii_sell", "dii_net")
                    },
                )
                db.execute(stmt)
                db.commit()

            run_row.rows_written = len(payload)
            run_row.source_stats = {"days": len(payload), "source": "nselib.fii_dii_trading_activity"}
            run_row.status = "success" if payload else "partial"
        log.info("fii_dii: %s days", run_row.rows_written)
    finally:
        db.close()


if __name__ == "__main__":
    logging.basicConfig(level="INFO")
    run()
