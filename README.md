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

So: **FastAPI never calls NSE.** A nightly GitHub Action ingests the full-market bhavcopy,
computes every indicator and pattern, and writes small JSON artifacts to `out/`, which it
commits back to the repo. The API loads those files into memory at startup and serves them
— a lookup layer, not a compute layer. Postgres (Neon) holds the `users` table only.

Indicators and patterns are **precomputed**, never calculated on request. See
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Layout

```
apps/
  web/      Next.js (app router) frontend — React Query, Zustand, Tailwind
  api/      FastAPI backend — serves out/*.json from memory; Neon for auth
jobs/       the nightly pipeline — sources, panel, detectors, artifact writers
out/        the committed artifacts the API serves (written by GitHub Actions)
data/       gitignored job working files — the rolling OHLC panel + raw NSE downloads
design/     Claude Design wireframe (swing-terminal.dc.html) — the layout source of truth
docs/       phase notes
```

## Quick start

**`out/` is production data**, owned by the nightly GitHub Action — Render serves it
straight from the repo. `jobs/config.py` only defaults there when `GITHUB_ACTIONS=true`
(set automatically by the Action); a bare local `python -m jobs.run_nightly` writes to
gitignored `data/out/` instead, so a local run can never dirty git by accident. The API
still defaults to `out/` (it has to, in production), so point it at the same place
locally with `OUT_DIR=data/out`.

```bash
cp .env.example .env                 # fill DATABASE_URL with your Neon string

# nightly job — builds the panel and the artifacts (writes to data/out/ by default)
pip install -r jobs/requirements.txt
BACKFILL_DAYS=260 python -m jobs.run_nightly   # first run; then 5

# API (run from the repo root — .env is resolved relative to the working directory)
cd apps/api && python -m venv .venv && source .venv/bin/activate && pip install -e '.[dev]'
cd ../.. && OUT_DIR=data/out uvicorn app.main:app --reload

# Web
cd apps/web
bun install
cp .env.local.example .env.local
bun run dev
```

The API reads the artifacts once at startup, so restart uvicorn after re-running the job.

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
