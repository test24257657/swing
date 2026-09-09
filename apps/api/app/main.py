from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import store
from app.auth.deps import current_user
from app.bootstrap import bootstrap_db
from app.config import settings
from app.routers import auth, health, pulse

logging.basicConfig(level=settings.log_level)
log = logging.getLogger("swing.api")


@asynccontextmanager
async def lifespan(_: FastAPI):
    bootstrap_db()  # ensure the users table exists + seed the admin from env
    store.load()  # read out/*.json into memory once
    log.info("swing-api starting in %s mode", settings.env)
    yield
    log.info("swing-api shutting down")


app = FastAPI(
    title="Swing Terminal API",
    version="0.2.0",
    summary=(
        "Serves nightly artifacts from memory. Never calls NSE; never queries market "
        "data from a database. Postgres holds users only."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Open: health check + auth.
app.include_router(health.router)
app.include_router(auth.router)

# Everything else needs a bearer token.
protected = [Depends(current_user)]
app.include_router(pulse.router, dependencies=protected)

# ---------------------------------------------------------------------------
# Parked until their phase (see docs/ARCHITECTURE.md §13). These routers still
# query Postgres for market data, which this architecture no longer does — each
# one gets ported to an artifact as its phase lands.
#
#   meta, symbols, screener, market, indices, stocks
# ---------------------------------------------------------------------------


@app.get("/", tags=["system"])
def root() -> dict:
    return {"service": "swing-terminal-api", "docs": "/docs"}
