from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy import text

from app.cache import redis as redis_cache
from app.db.session import engine

router = APIRouter(tags=["system"])


@router.get("/health")
def health() -> dict:
    """Liveness + dependency check. Used by docker-compose and the frontend shell."""
    db_ok = False
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_ok = True
    except Exception:  # noqa: BLE001 - health check must never raise
        db_ok = False

    redis_ok = redis_cache.ping()
    status = "ok" if (db_ok and redis_ok) else "degraded"
    return {"status": status, "postgres": db_ok, "redis": redis_ok}
