# Phase 0 — Foundation

Status: **scaffolded**. Everything below is in place; nothing here is the finished
product — it is the frame the later phases hang off.

## Done

### Repo
- Monorepo: `apps/web` (Next.js app router), `apps/api` (FastAPI), `design/`, `infra` via
  root `docker-compose.yml` (Postgres 16 + Redis 7), `Makefile`, `.env.example`.
- Postgres is Neon (connection string in the gitignored `apps/api/.env`); Redis runs
  locally via `docker compose up -d redis`.

### API (`apps/api`)
- `app/config.py` — pydantic-settings, reads `.env`.
- `app/db/` — SQLAlchemy 2.0 declarative base with an explicit naming convention,
  request-scoped sessions.
- `app/cache/redis.py` — the one live-data path (60s quote TTL), unused until Phase 1.
- Models: `Symbol`, `Sector`, `DailyBar`, `IngestionRun`. `daily_bars` has a composite PK
  `(symbol_id, date)` + a `date` index for the two query shapes; partition-by-year is a
  documented later migration. Prices are `NUMERIC`, stored raw, `adj_factor` reserved for
  corp-action adjustment.
- Alembic wired to `Base.metadata`; migration `0001_initial` creates all four tables.
- Response envelope `{ data, meta: { source, as_of, stale } }` — `app/schemas/envelope.py`
  plus `app/services/freshness.py` which derives `stale` from the latest `IngestionRun`.
- Routers: `/health`, `/meta/ingestion`, `/symbols`, `/symbols/{sym}`, `/sectors`.
- Ingestion:
  - `sources/nse_bhavcopy.py` — nselib primary, jugaad-data fallback, raw CSV cached to
    disk first so recompute never re-hits NSE; `normalize()` degrades unknown columns to
    `None` rather than dropping rows.
  - `jobs/sync_symbols.py` — seeds ~15 sectors, upserts the NSE equity list, flags F&O
    names, best-effort sector-constituent mapping.
  - `jobs/ingest_bhavcopy.py` — one day or a back-fill range, Postgres `ON CONFLICT`
    upsert, per-day failures recorded not fatal.
  - `run_context.py` — every attempt writes an `IngestionRun` (success / partial / failed).
  - `scheduler.py` — APScheduler cron (IST): symbols 18:45, bhavcopy 19:15, weekdays.
- One unit test: `tests/test_bhavcopy_normalize.py` (mapping + row filtering, no network).

### Web (`apps/web`)
- Next 15 / React 19 / TypeScript, Tailwind v4 (`@theme` tokens from the design),
  Inter + JetBrains Mono via `next/font`.
- `lib/format.ts` — the single formatting source: Indian digit grouping, Unicode minus
  `−`, explicit signs, ₹-crore compaction, IST stamps.
- `lib/api/` — typed client (`apiGet`), query-key registry, React Query hooks with a
  stated loading (`Skeleton`) / error (retry card) / stale (`meta.stale`) convention.
- Providers: React Query (EOD-tuned defaults, no retry on 4xx) + nuqs adapter.
- Stores (Zustand): `filters` (screener), `view` (persisted view modes), `watchlist`
  (persisted, client-side until Phase 5).
- UI primitives: `Button`, `Card`, `Table`/`Row` (CSS-grid), `Chip`, `Segmented`,
  `Accordion`, `Tooltip`, `Skeleton`, `EmptyState`, `DataSourceFooter`.
- App shell: 64→220px hover icon rail, 56px sticky top bar with the 4-state
  market-status pill + a live "data as of" stamp from `/meta/ingestion`.
- Aceternity UI: `motion` + `@tabler/icons-react` installed, `lib/utils.ts` shim for its
  `cn` import; add components into `components/aceternity/` via the shadcn registry.
- All 8 routes exist and are walkable. Screener + Stock Detail + Watchlist are wired to
  the live API (symbol master); the rest are `PhaseStub`s naming their target phase.

## Deferred (with the phase that owns it)

| Item | Phase |
|---|---|
| `daily_indicators` table + nightly compute (RSI/ATR/ADX/DMA/RS/…) | 1 |
| Screener scoring, `screener_scores`, saved screens, TanStack Virtual list | 1 |
| Real NSE holiday calendar (replaces the weekend-only rule) | 1 |
| `pattern_signals` + the 4 detectors (VCP, IPO base, 52WH breakout, near-pivot) | 2 |
| Lightweight Charts wrapper + SVG annotation layer | 3 |
| Corp-action adjustment (`corp_actions`, `adj_factor` maintenance) | 3 |
| Stock-detail panels, option chain, filing verification | 4/8 |
| Watchlist + alerts API, alert evaluation cadence (see open question) | 5 |
| Market Pulse / Sector Rotation / Indices data + RRG | 6 |
| News ingest + AI impact classification | 7 |
| Bulk/block deals, participant OI, FII derivative stats | 8 |
| Backtest harness (must beat the index before the score ships) | before 1 ships |

## Open questions still outstanding (from the design review)

Composite score formula; alert evaluation cadence (1-min vs EOD contradiction); "relative
strength" benchmark; stage thresholds; chart annotation approach; official-filing source
for verification; news classification model. None block Phase 0.
