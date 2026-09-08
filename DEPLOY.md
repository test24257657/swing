# Deploy

Three managed pieces: **Neon** (Postgres), **Render** (FastAPI + Redis + nightly cron),
**Vercel** (Next.js).

```
Vercel (apps/web)  ──/api/* proxy──▶  Render web (apps/api)  ──▶  Neon Postgres
                                             │
                                       Render Redis (Key Value)
                                             ▲
                                  Render cron (nightly ingest)
```

## 1. Neon (Postgres)

1. Create a project + database named `swing` at neon.tech.
2. Copy the pooled connection string and convert the scheme for SQLAlchemy/psycopg:
   `postgresql://…`  →  `postgresql+psycopg://…?sslmode=require`
   Keep this as `DATABASE_URL`.

## 2. Render (API)

The repo has a blueprint at `render.yaml`. In Render: **New → Blueprint**, point it at this
repo. It creates:

| Service | What |
|---|---|
| `swing-api` (web) | `pip install . && alembic upgrade head`, then `uvicorn app.main:app`. Health check `/health`. |
| `swing-redis` (key value) | the 60s live-quote cache |
| `swing-ingest` (cron) | `45 13 * * 1-5` UTC (19:15 IST) → `sync_symbols` then `ingest_bhavcopy` |

Set these in the Render dashboard (marked `sync: false` in the blueprint):

- `DATABASE_URL` — the Neon string from step 1 (on **both** `swing-api` and `swing-ingest`)
- `CORS_ORIGINS` — your Vercel URL, e.g. `https://swing-terminal.vercel.app`
  (only needed if the browser ever calls the API cross-origin; the default `/api` proxy
  below keeps it same-origin, so this can stay unset)

`REDIS_URL` and `PYTHON_VERSION` are wired by the blueprint. Migrations run on every deploy
via the build command.

> Free Render web services sleep after 15 min idle; the first request after that is slow.
> The cron job is unaffected.

## 3. Vercel (web)

1. **New Project** → import this repo → set **Root Directory** to `apps/web`.
   Framework preset: Next.js (auto-detected). `apps/web/vercel.json` pins the rest.
2. Environment variables:

   | Key | Value | Why |
   |---|---|---|
   | `API_PROXY_TARGET` | `https://swing-api.onrender.com` | Next rewrites `/api/*` here server-side — the browser stays same-origin, no CORS |
   | `NEXT_PUBLIC_API_BASE` | `/api` | default; leave as-is to use the proxy |
   | `NEXT_PUBLIC_SITE_URL` | `https://swing-terminal.vercel.app` | public origin — drives SEO `metadataBase`, canonical URLs, sitemap, robots |

   To skip the proxy and call Render directly instead, set `NEXT_PUBLIC_API_BASE` to the
   Render URL and add the Vercel domain to `CORS_ORIGINS` on Render.

3. Deploy. Every push to `main` redeploys both Vercel and Render.

## Order

Neon → Render (needs `DATABASE_URL`) → Vercel (needs the Render URL). After the first
deploy, trigger the `swing-ingest` cron once manually in Render so the app has data.

## Local

```bash
cp .env.example .env                       # then paste your Neon URL into apps/api/.env
docker compose up -d redis                 # Postgres is Neon; only Redis is local
cd apps/api && python -m venv .venv && source .venv/bin/activate && pip install -e '.[dev]'
alembic upgrade head
python -m app.ingestion.jobs.sync_symbols && python -m app.ingestion.jobs.ingest_bhavcopy
uvicorn app.main:app --reload              # :8000

cd ../../apps/web && npm install && cp .env.local.example .env.local && npm run dev  # :3000
```
