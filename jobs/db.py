"""Minimal Postgres access for the job.

Everything else in jobs/ never touches Postgres — market data lives in file artifacts.
This is the one exception: reading which symbols users have watchlisted (so their
charts get built) and writing alert triggers, both user-generated config, not market
data. jobs/ has no SQLAlchemy dependency, so this is plain psycopg + SQL.
"""

from __future__ import annotations

import logging
import os

log = logging.getLogger("jobs.db")


def _dsn() -> str | None:
    url = os.environ.get("DATABASE_URL")
    if not url:
        return None
    return url.replace("postgresql+psycopg://", "postgresql://")


def connect():
    """A psycopg connection, or ``None`` if ``DATABASE_URL`` isn't set — local runs
    without it still work, just without watchlist chart artifacts or alert evaluation."""
    dsn = _dsn()
    if not dsn:
        log.warning("DATABASE_URL not set — skipping watchlist symbols + alert evaluation")
        return None
    import psycopg

    try:
        return psycopg.connect(dsn, connect_timeout=10)
    except Exception:
        log.exception("could not connect to Postgres")
        return None
