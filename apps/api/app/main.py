from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import health, meta, screener, symbols

logging.basicConfig(level=settings.log_level)
log = logging.getLogger("swing.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("swing-api starting in %s mode", settings.env)
    yield
    log.info("swing-api shutting down")


app = FastAPI(
    title="Swing Terminal API",
    version="0.1.0",
    summary="Reads Postgres only. A nightly job ingests NSE; the API never calls NSE directly.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(meta.router)
app.include_router(symbols.router)
app.include_router(screener.router)


@app.get("/", tags=["system"])
def root() -> dict:
    return {"service": "swing-terminal-api", "docs": "/docs"}
