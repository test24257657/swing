# Swing Terminal

A swing/momentum trading terminal for Indian equities (NSE). Retail traders holding
3–15 day positions use it after market close to find setups and at the open to check
what is triggering.

Core loop: **rank sectors → screen for chart patterns inside strong sectors → confirm
with fundamentals, delivery and F&O positioning → size the position → watchlist + alerts.**

## The data rule (shapes the whole architecture)

None of the data sources (`nselib`, `jugaad-data`, `yfinance`) are official APIs — they
scrape NSE. If the frontend triggered a live NSE call per request the server IP would be
blocked within a day.

So: **FastAPI reads from Postgres, never from NSE directly.** A nightly job ingests the
full-market bhavcopy, computes every indicator and pattern, and writes results to Postgres.
Live quotes are the only exception and go through Redis with a 60-second TTL.

Indicators and patterns are **precomputed**, not calculated on request. The schema is
designed around that.

## Layout

```
apps/
  web/      Next.js (app router) frontend — React Query, Zustand, Tailwind
  api/      FastAPI backend — Postgres, Redis, SQLAlchemy, Alembic, APScheduler
design/     Claude Design wireframe (swing-terminal.dc.html) — the layout source of truth
infra/      docker-compose for Postgres + Redis
docs/       phase notes
```

## Quick start

```bash
cp .env.example .env
docker compose up -d                 # postgres + redis

# API
cd apps/api
python -m venv .venv && source .venv/bin/activate
pip install -e '.[dev]'
alembic upgrade head
python -m app.ingestion.jobs.sync_symbols        # symbol master + sectors
python -m app.ingestion.jobs.ingest_bhavcopy     # one day of bhavcopy
uvicorn app.main:app --reload

# Web
cd apps/web
npm install
cp .env.local.example .env.local
npm run dev
```

## Build order

Phase **0 foundation** → 1 core screener → 2 pattern detection → 3 charts → 4 stock
detail → 5 watchlist/alerts → 6 market context → 7 news → 8 institutional/F&O → 9 hardening.

Before the scoring system ships there is a backtest harness: if the composite score does
not beat buying the index over 2–3 years of history, the score is decoration.

## Principles

- **Correctness over speed.** A wrong RSI or a mislabelled pattern is worse than a missing
  feature — real money is traded on the output.
- **No single broken data source takes down a screen.** Every source can fail or return
  nulls; ingestion degrades gracefully and records what it got.
- Every API payload carries provenance: `{ data, meta: { source, as_of, stale } }`.
