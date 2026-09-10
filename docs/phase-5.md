# Phase 5 — Watchlist & alerts

Status: **built, verified end-to-end against the real Neon database** (add, list,
duplicate/unknown-symbol rejection, alert trigger, disable, delete — all exercised with
`TestClient` against production Postgres, not mocked). No automated pytest suite for
the router yet — see "Not done" below.

## Scope decision: alert cadence

The original design assumes live 1-minute alert evaluation ("alerts evaluated on 1-min
bars during market hours"). This architecture has no live intraday feed and no running
evaluator process — the nightly job is the only thing that ever computes anything.
Confirmed with the user: alerts are evaluated **once, nightly**, against that session's
high/low from the bhavcopy panel. "Triggered" means "crossed at some point during
today's session," found out the next time the artifacts refresh — not pushed in real
time. "Notifications" (item 30) means the triggered state surfacing in the watchlist UI
(a chip, a header count) — there is no email/push/SMS channel in this stack.

This is the one place a nightly job in this architecture touches Postgres. It's reading
and writing **user-generated config** (which symbols someone watches, what price levels
they set), not market data — the rule that market data must never enter Postgres is
untouched. Row counts here are per-user watchlist sizes (tens, not millions), nothing
like the size pressure that motivated moving market data out of Postgres in the first
place.

## Done

### Item 28 — Watchlist CRUD, table and card views
- **Contract**: `WatchlistItem` / `Alert` models (`apps/api/app/models/watchlist.py`),
  Alembic migration `0007_watchlist.py`, and `bootstrap.py` now creates both tables at
  startup alongside `users` (no migration step on Render, same as before).
- **API**: `apps/api/app/routers/watchlist.py` — `GET/POST /watchlist`,
  `PATCH/DELETE /watchlist/{id}`, `POST /watchlist/{id}/alerts`,
  `PATCH/DELETE /watchlist/alerts/{id}`. Adding a symbol validates it against the new
  whole-panel quote artifact (below) rather than trusting free text; a symbol that
  didn't trade in the last run is rejected with a 400, not silently accepted.
- **Frontend**: `/watchlist` — table and card views (`?view=grid`, same URL-state
  pattern as the Screener's List/Chart toggle), inline "+ Add symbol" form, unrealised
  P/L from `entry_price` vs. the enriched LTP, and a Trash-icon remove. `noindex` — this
  is per-user data, matching `robots.ts`'s existing disallow of `/watchlist`.

### Item 29 — Alert configuration
Inline, no modal (matching the design intent) — expanding a watchlist row/card opens an
`AlertPanel`: existing alerts as chips (enabled / disabled / triggered-with-date,
tooltipped with the exact crossing price and date), a kind + threshold form to add one,
and delete. Only two kinds ship — `price_above`, `price_below` — because those are
directly answerable from the bhavcopy's high/low for *any* symbol; an RSI-based alert
would need technicals computed for every watchlisted symbol, and today those only exist
for the ~340 symbols that already get a chart artifact (screener matches + tiles).

### Item 30 — Alert evaluation job + notifications
`jobs/alerts.py::evaluate()` — one query for every enabled alert joined to its
watchlist item, checked against that session's high (`price_above`) or low
(`price_below`) from the panel, one `UPDATE` per trigger. An alert auto-disables once
it fires (`enabled=false`) so it doesn't refire every night; re-enabling from the UI
clears `triggered_at`/`triggered_price`. `jobs/db.py` is the one new thing here — a
minimal `psycopg` connection for this Postgres access, kept separate from the file-based
market-data path; `DATABASE_URL` missing (e.g. a local run without it) degrades to
"skip watchlist symbols and alerts," never a crash.

**Notification = in-app, not push.** The watchlist header shows "N alerts triggered
since last close" (design's own copy) whenever any triggered alert exists; there is no
email/SMS/push channel.

## Supporting changes

- **`jobs/quotes.py`** (new) — a lightweight `{symbol: {name, ltp, change_pct}}` for
  *every* actively-traded symbol (~2,900), not just the ~340 with a full chart artifact.
  Needed because a watchlist symbol can be anything on the exchange, not only what
  Pulse or the Screener happened to surface. `out/quotes.json`, ~270 KB.
- **`jobs/run_nightly.py`** now also reads `watchlist_items` (via `alerts.py`) *before*
  building charts, so every watchlisted symbol — not just movers/screener matches —
  gets a full chart artifact and can open `/chart/<slug>` from the watchlist.
- **`.github/workflows/nightly.yml`** — the build step gets a `DATABASE_URL` secret
  (same Neon connection string as Render's). **Action required**: add it in the repo's
  Settings → Secrets and variables → Actions, or watchlist symbols/alerts will just be
  silently skipped in production (everything else keeps working).
- **`jobs/config.py`** — `OUT_DIR` now defaults to `data/out` (gitignored) unless
  `GITHUB_ACTIONS=true` is set, which the Action does automatically. Before this, three
  separate local `python -m jobs.run_nightly` runs this session (without remembering
  `OUT_DIR=data/out`) dirtied the committed `out/` folder with hundreds of files that
  had to be caught and reverted before every commit. Now a bare local run is safe by
  construction — no environment variable to remember.

## Not done / deferred

| Item | Note |
|---|---|
| Automated pytest suite for the watchlist router | verified live against real Postgres this session; no fixture-based test DB harness exists yet in `apps/api/tests/` (only one legacy file, no `conftest.py`) — worth building once a second DB-backed feature needs it |
| RSI / technicals-based alert kinds | needs technicals for every watchlisted symbol, not just chart-artifact symbols |
| "Score since added" column | Phase 9 — gated behind the backtest |
| Email/push/SMS notifications | no channel in this stack; in-app surfacing only |
| Position sizing (share count) on watchlist items | only price is tracked, not quantity — P/L shown is per-share %, not ₹ |
