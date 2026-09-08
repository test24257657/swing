# Workflow — the steps every task runs through

This is the long form of the checklist in [CLAUDE.md](../CLAUDE.md). It applies to every
new task, feature, module, bug fix or change, backend or frontend. The point is that each
task is done the same way, so nothing important gets skipped and the codebase stays
coherent.

---

## Step 1 — Plan

**Goal: know exactly what changes before touching a file.**

- Restate the task in one sentence.
- Locate it: which build phase (0–9), which layer — ingestion / model / API / store /
  component / screen. Most features touch a vertical slice of several.
- Read the relevant context:
  - `design/swing-terminal.dc.html` — the layout and interaction truth. Open it in a
    browser if the feature is visual.
  - `docs/phase-<n>.md` — what that phase owns and what is already done/deferred.
  - auto-memory — standing decisions and corrections from past sessions.
  - the existing code for the nearest equivalent — match the pattern that is already there.
- Write the file list: what you will add, what you will change.
- If the task is non-trivial, has more than one reasonable approach, or has an open
  question from the design review (score formula, alert cadence, RS benchmark, …), write
  the plan out and wait for the user before coding.

## Step 2 — Contract first

**Goal: the database, the API and the TypeScript never disagree.**

- **Schema change:** add or edit the SQLAlchemy model in `apps/api/app/models/`, register
  it in `models/__init__.py`, and write the Alembic migration **in the same step**:
  ```bash
  cd apps/api && .venv/bin/alembic revision --autogenerate -m "add <thing>"
  ```
  Review the generated migration by hand — autogenerate misses index changes, server
  defaults and partitioning. Then `alembic upgrade head` against Neon.
- **API response:** every endpoint returns `Envelope[T]` = `{ data, meta }`. `meta` comes
  from `meta_for_job(db, "<job>", "<human source>")`. Do not invent a second response
  shape.
- **Frontend types:** mirror the new/changed shape in
  `apps/web/src/lib/api/types.ts`. This file is hand-maintained against the Pydantic
  schemas — keep them identical.

## Step 3 — Backend

**Goal: the API is fast and safe because the work already happened overnight.**

Order of construction: **source adapter → job → service → router.**

- **Source adapter** (`app/ingestion/sources/`): one module per upstream. It must
  - write the raw response to `raw_cache_path(...)` before parsing, so recompute replays
    from disk and never re-hits NSE;
  - try the primary source, then the fallback (nselib → jugaad, etc.);
  - return `None` or a partial result on failure — **never raise** past the job;
  - normalise unknown/renamed columns to `None` rather than dropping the row.
- **Job** (`app/ingestion/jobs/`): wrap the whole run in `ingestion_run(db, "<job>", date)`
  so success / partial / failed is always recorded with `source_stats`. Upsert with
  `ON CONFLICT`. One bad symbol or one bad day must not fail the run.
- **Precompute, don't compute on request.** Indicators, patterns, scores, rankings — all
  written to Postgres by a job. A router does `SELECT`, never a calculation loop and never
  a network call.
- **Service** (`app/services/`): read-side query logic that more than one router needs.
- **Router** (`app/routers/`): thin. Parse query params (Pydantic), call the service,
  wrap in `envelope(...)`. Register it in `app/main.py`.
- **Scheduler:** if the job runs nightly, add it to `app/scheduler.py` (local/VPS) **and**
  the `swing-ingest` cron in `render.yaml` (production). Times are IST in the scheduler,
  UTC in `render.yaml`.

## Step 4 — Frontend

**Goal: it looks like the design and behaves consistently with every other screen.**

- **Hook** (`lib/api/hooks.ts`): one hook per endpoint, keyed via `lib/api/query-keys.ts`.
  EOD data → long `staleTime`. Never call `apiGet` from a component.
- **Loading / error / empty / stale — the convention, everywhere:**
  | state | render |
  |---|---|
  | `isPending` | `<Skeleton>` composed to the shape of the real panel — not a spinner |
  | `isError` | inline card: message + `<Button onClick={refetch}>Retry</Button>` |
  | empty `data` | `<EmptyState>` that routes to the next action, not a dead end |
  | `data.meta.stale` | amber `<DataSourceFooter>`, dim the numbers |
- **Formatting:** every number, price, percent, ₹ value and timestamp goes through
  `lib/format.ts`. Never call `toLocaleString` or `toFixed` in a component. Pair numeric
  cells with the `.tnum` class.
- **Components:** build from `components/ui/` primitives. New shared primitive → add it
  there and export from `components/ui/index.ts`. Aceternity components go in
  `components/aceternity/` via the shadcn registry, used sparingly (see its README).
- **Design fidelity:** light theme, violet accent `#7C3AED`, Inter for UI, JetBrains Mono
  for timestamps / `source:` lines / numeric metadata, tabular numerals on all price data,
  explicit `+`/`−` on percentages, every data panel ends with a `<DataSourceFooter>`.
- **URL vs store:** filters that make a screen shareable (screener patterns, stage,
  sector, ranges; indices category/timeframe; news filters) belong in the URL via `nuqs`.
  Transient UI (open accordion, expanded row, drawer, remembered view mode) belongs in a
  Zustand store.

## Step 5 — Verify

**Goal: "it works" means it was actually run.**

```bash
# API
cd apps/api
.venv/bin/ruff check app
.venv/bin/pytest -q

# Web
cd apps/web
npm run typecheck
npm run lint
```

- Run the real thing: hit the endpoint (`curl` / `/docs` / TestClient), load the page.
- **Correctness gate** — anything touching an indicator, a pattern label, a ranking or the
  composite score:
  - reconcile the output against a reference (TradingView, a second library, a hand
    calculation) to the decimal;
  - add a golden test with the known-good value under `apps/api/tests/`;
  - a wrong RSI or a mislabelled pattern is worse than a missing feature.
- **Before the composite score ships at all:** the backtest harness must show it beats
  buying the index over 2–3 years, net of costs. If it does not, say so — the score is
  decoration and the user needs to know.

## Step 6 — Document

- `docs/phase-<n>.md`: move the finished item from the deferred table to "done"; add
  anything newly discovered as deferred with the phase that owns it.
- New environment variable: add it (blank) to `.env.example` **and**
  `apps/api/.env.example`, and to `render.yaml` (`sync: false` if it is a secret), and
  mention it in `DEPLOY.md` if a human has to set it.
- If the task changed how something is built, update `CLAUDE.md` / this file.

## Step 7 — Commit

- One focused commit per task. Do not bundle unrelated changes.
- Message: `phase <n>: <what>` — add a body explaining *why* when it is not obvious.
- Trailer: `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`
- **Scan the staged diff for secrets** (`git diff --cached | grep -iE 'npg_|neondb_owner|AQ\.Ab8|api[_-]?key'`).
- **Do not push** unless the user explicitly asks. There is no `gh` CLI here; pushing
  needs a remote URL from the user.

---

## Quick reference — where things live

```
apps/api/app/
  models/            SQLAlchemy models        (Step 2)
  ../alembic/        migrations               (Step 2)
  ingestion/
    sources/         upstream adapters        (Step 3)
    jobs/            nightly jobs             (Step 3)
    scheduler.py     APScheduler cron
  services/          read-side query logic    (Step 3)
  routers/           API endpoints            (Step 3)
  schemas/           Pydantic + envelope

apps/web/src/
  app/<screen>/      the 8 screens            (Step 4)
  components/ui/      primitives
  components/shell/   rail + top bar
  lib/format.ts       the one formatting module
  lib/api/            client, hooks, types    (Steps 2 & 4)
  stores/             Zustand
```
