# CLAUDE.md — how to work in this repo

Read this first, every session. Full detail in [docs/WORKFLOW.md](docs/WORKFLOW.md).

## The standing workflow — every task goes through these steps

Whenever the user gives a new task, feature, module, fix, or change — backend or
frontend — do these in order. Do not skip steps.

### 1. Plan
- Restate the task in one line. Identify which build phase and which layer(s) it touches.
- Check: `design/swing-terminal.dc.html` (layout truth), `docs/phase-*.md`, auto-memory,
  existing code for the pattern already in use.
- List the files you will add/change. If it is non-trivial or has open questions, present
  the plan and wait for sign-off before coding.

### 2. Contract first
- **Data model change** → SQLAlchemy model in `apps/api/app/models/` **and** an Alembic
  migration in the same step. Never let the model and the DB drift.
- **API shape** → keep the `{ data, meta: { source, as_of, stale } }` envelope. Update the
  matching TypeScript in `apps/web/src/lib/api/types.ts` so the two sides stay in sync.

### 3. Backend
- Data from NSE goes through an ingestion **source adapter** (`app/ingestion/sources/`):
  cache the raw response to disk first, degrade to `None`/partial on failure, never raise
  through to a caller. **FastAPI never calls NSE in a request path.**
- Then the job/service, then the router. Indicators & patterns are precomputed by a job
  and written to Postgres — never computed on request.
- Record every ingestion attempt via `ingestion_run(...)` (success / partial / failed).

### 4. Frontend
- Add/extend a hook in `apps/web/src/lib/api/hooks.ts` following the stated convention:
  `isPending` → `<Skeleton>` shaped like the panel · `isError` → inline retry card ·
  `data.meta.stale` → amber treatment.
- Build with the UI primitives in `components/ui/` and **all** number/price formatting
  through `lib/format.ts` (Indian grouping, Unicode `−`, explicit signs, ₹cr, IST stamps).
- Match the design file: light theme, violet accent `#7C3AED`, Inter for UI + JetBrains
  Mono for timestamps / `source:` footers / numeric metadata, tabular numerals on all
  price data, every data panel gets a `<DataSourceFooter>`.
- **SEO — required on every route.** Server pages `export const metadata`; client pages
  get a sibling `layout.tsx` that does. Always go through `screenMetadata()` in
  `lib/seo.ts` (canonical + Open Graph + Twitter). One real `<h1>` per page (via
  `ScreenHeader`), semantic landmarks, descriptive link text. Dynamic routes use
  `generateMetadata`. User-specific/thin pages pass `noindex: true`. Keep
  `robots.ts` / `sitemap.ts` / `manifest.ts` current when add/removing routes.

### 5. Verify (must actually run — report real output)
- API: `cd apps/api && .venv/bin/ruff check app && .venv/bin/pytest -q`
- Web: `cd apps/web && npm run typecheck && npm run lint`
- Run the real endpoint / page and confirm it works.
- Anything touching an indicator, a pattern label, or the composite score: reconcile
  against a reference value and add a golden test. A wrong number is worse than a missing
  feature — real money is traded on this.

### 6. Document
- Update `docs/phase-<n>.md` — move the item from deferred to done, note anything new
  that got deferred.
- New env var → add it to **both** `.env.example` files and `render.yaml`
  (`sync: false` for secrets).

### 7. Commit
- One focused commit per task. Message: `phase N: <what changed>` + why if not obvious.
- End the message with: `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`
- **Do not push** unless the user asks. No `gh` in this environment — pushing needs a
  remote URL from the user.

## Hard rules (from the brief — never violate)

1. FastAPI reads Postgres only. A nightly job ingests NSE; live quotes are the only
   exception (Redis, 60s TTL).
2. No single broken data source takes down a screen — degrade, record, move on.
3. Correctness over speed. Reconcile indicators/patterns/scores before shipping.
4. The backtest harness must beat buying the index (2–3 yrs) before the composite score
   ships. If it does not, the score is decoration.

## Secrets

Real keys (Neon `DATABASE_URL`, `GEMINI_API_KEY`) live only in gitignored `.env` /
`apps/api/.env`. Before every commit, scan the staged diff for them. `.env.example` files
carry blank placeholders only.

## Project map

| Path | What |
|---|---|
| `apps/api/app/models/` · `alembic/` | schema + migrations |
| `apps/api/app/ingestion/` | source adapters, jobs, scheduler |
| `apps/api/app/routers/` · `schemas/` · `services/` | API surface |
| `apps/web/src/app/` | 8 screens (app router) |
| `apps/web/src/components/ui/` · `shell/` | primitives + global shell |
| `apps/web/src/lib/format.ts` | the one formatting module |
| `apps/web/src/lib/api/` · `stores/` | data layer + Zustand |
| `design/swing-terminal.dc.html` | layout source of truth |
| `docs/phase-*.md` | per-phase done/deferred ledger |
