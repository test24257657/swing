# Swing Trading Terminal — Architecture

Indian equities (NSE) market dashboard.
Free-tier hosting. ~10 concurrent users.

**Current scope: Market Pulse + the Screener + Stock Detail + Watchlist + Sector Rotation + Indices.** Everything else is deliberately
out of scope until each phase is live, correct and deployed.

---

## 1. What we are building right now

One screen — **Market Pulse** — the post-close read on the market.

```
┌──────────────────────────────────────────────────────────────┐
│  status pill:  Market closed / Pre-open / Open / Holiday      │
├──────────────────────────────────────────────────────────────┤
│  NIFTY 50   │  NIFTY BANK  │  NIFTY 500  │  INDIA VIX        │
│  value      │  value       │  value      │  value            │
│  chg + %    │  chg + %     │  chg + %    │  chg + %          │
│  30d spark  │  30d spark   │  30d spark  │  30d spark        │
├──────────────┬───────────────────────────┬───────────────────┤
│  BREADTH     │  FII / DII FLOW           │  VOLATILITY       │
│  donut       │  last 10 sessions, bars   │  VIX + percentile │
│  adv/dec/unch│  10-session net (₹ cr)    │  regime verdict   │
│  A/D ratio   │                           │                   │
│  % > 50 DMA  │                           │                   │
├──────────────┴─────────────┬─────────────┴───────────────────┤
│  MOST ACTIVE BY VALUE      │  52-WEEK HIGH BREAKOUTS         │
│  top 10, turnover ₹cr      │  top 10, vol > 1.5× 20d avg     │
└────────────────────────────┴─────────────────────────────────┘
```

Clicking any tile or mover row opens `/chart/<slug>` — a candlestick chart with
volume and 20/50/200-day moving averages, built from `out/charts/`. Charts exist
**only** for the ~25 instruments Pulse currently shows.

**Not building yet:** the screener, watchlist, alerts,
sector rotation, indices screen, news, institutional. Those come later, one at a
time, each following this same architecture.

---

## 2. Architectural pattern

**Batch prediction serving.** Everything the screen needs is computed once a
night, written to a small JSON file, and served from memory.

Nothing is computed on request. The API is a lookup layer, not a compute layer.

**Two non-negotiable rules:**

> 1. The API never calls NSE. Not once. Not as a fallback.
> 2. Market data never enters Postgres. Postgres is for user data only.

NSE rate-limits per IP, and `nselib` / `jugaad-data` / `nsepython` are all
unofficial scrapers of the same endpoints — switching libraries changes nothing.
A live call from a request handler gets the server IP blocked within a day.

Rule 2 is what keeps the free tier free: Neon's 0.5 GB fills up fast if you put
600k price rows in it. Files cost nothing.

---

## 3. System diagram

```
┌──────────────────────────────────────────────────────────────┐
│  GITHUB ACTIONS  —  cron 18:30 IST, Mon–Fri                  │
│                                                               │
│   python -m jobs.run_nightly                                  │
│                                                               │
│   sources.py   bhavcopy · indices · FII/DII · holidays        │
│   panel.py     append to the rolling OHLC panel               │
│   breadth.py   adv / dec / unch, % above 50 & 200 DMA         │
│   movers.py    most active by value, 52WH breakouts           │
│   tiles.py     4 index tiles + VIX percentile & regime        │
│   flows.py     append today's FII/DII to the rolling history  │
│   charts.py    → out/charts/<SLUG>.json  (only Pulse's ~25)   │
│   writer.py    → out/pulse.json · calendar.json · meta.json   │
│   commit out/ back to the repo                                │
└──────────────────────────────────────────────────────────────┘
                          │  files (git)
                          ▼
┌──────────────────────────────────────────────────────────────┐
│  RENDER (free)  —  FastAPI                                    │
│                                                               │
│   startup: read out/*.json into a module-level dict           │
│                                                               │
│   GET /pulse          the whole screen payload, one dict      │
│   GET /chart/<slug>   OHLCV + MAs for one Pulse instrument    │
│   GET /market/status  computed from the holiday calendar      │
│   GET /health         keep-alive target                       │
│   POST /auth/login    Neon                                    │
│                                                               │
│   ✗ never calls NSE      ✗ never queries market data from DB  │
└──────────────────────────────────────────────────────────────┘
                          │  JSON
                          ▼
┌──────────────────────────────────────────────────────────────┐
│  VERCEL (free)  —  Next.js + React Query + Zustand            │
└──────────────────────────────────────────────────────────────┘
                          │  user writes only
                          ▼
┌──────────────────────────────────────────────────────────────┐
│  NEON (free)  —  Postgres                                     │
│   users        (auth only, for now)                           │
└──────────────────────────────────────────────────────────────┘
```

---

## 4. Why this holds

Market data is **identical for every user**. Ten people hitting `/pulse` read the
same in-memory dict. No per-user compute, no DB query, no fan-out.

| Resource | Load | Free-tier limit | Headroom |
|---|---|---|---|
| `pulse.json` in RAM | < 200 KB | 512 MB | enormous |
| Serving a request | dict lookup | — | enormous |
| Requests/day | ~600 (10 × 60) | — | large |
| Neon storage | < 1 MB (users only) | 0.5 GB | enormous |
| GitHub Actions | ~4 min/night | 2000 min/month | large |

**The only real bottleneck is the Render cold start.** Free instances sleep after
15 minutes idle and take ~50 s to wake.
**Fix:** cron-job.org pings `GET /health` every 10 minutes. Free.

### When this breaks

| Trigger | Move to |
|---|---|
| > 100 concurrent users | VPS, multiple workers |
| artifacts > 100 MB | Cloudflare R2 instead of git |
| intraday / real-time needed | paid broker API + WebSocket |
| per-user computed values | a real compute layer |

Until one of those is true, do not migrate.

---

## 5. Data sources — Pulse only

| Data | Source | Feeds | Frequency |
|---|---|---|---|
| Bhavcopy (whole market OHLC + delivery %) | `nselib` | breadth, movers, 52WH | nightly |
| Index values + history | `nselib` | the four tiles, sparklines | nightly |
| INDIA VIX | `nselib` | volatility card | nightly |
| FII/DII cash flows | NSE JSON API | flow card | nightly |
| Holiday calendar | `nselib` | status pill | weekly |

**Prefer bulk endpoints always.** One bhavcopy request returns the whole market
for the same cost as one symbol.

**Every source can fail.** One broken source degrades one card — it never blanks
the screen. `meta.json` records per-source status and the UI shows it.

---

## 6. Repo structure

```
/jobs                    # runs on GitHub Actions — writes files, never touches a DB
  config.py              # ← EVERY threshold lives here
  cache.py               # raw-response cache + @safe degradation decorator
  sources.py             # bhavcopy · index history · FII/DII · holidays · constituents
  indicators.py          # pure maths (SMA/EMA/Wilder RSI/ATR), no I/O
  panel.py               # the rolling OHLC panel
  breadth.py             # adv/dec/unch, % above DMAs, new 52w highs/lows
  movers.py              # most active by value, 52-week-high breakouts
  tiles.py               # the four index tiles + the volatility card
  flows.py               # FII/DII rolling history
  charts.py              # per-instrument OHLCV artifacts (Pulse's tiles + movers)
  writer.py              # artifact output
  run_nightly.py         # the one entry point
  tests/                 # golden tests for the indicator maths
  requirements.txt

/apps/api                # runs on Render
  app/
    main.py              # FastAPI app + startup loader
    store.py             # in-memory artifact store
    routers/             # pulse.py · auth.py · health.py
    services/            # market_status.py (reads the artifact calendar)
    auth/  models/  db/   # Neon — users only
    schemas/             # the { data, meta } envelope

/apps/web                # runs on Vercel
  src/app/pulse/         # the one screen
  src/app/login/
  src/components/        # ui/ · shell/ · charts/ · screen/
  src/lib/               # API client, React Query hooks, format.ts
  
/data                    # job working files — gitignored, GitHub Actions cache
  panel.parquet          # rolling OHLC panel, whole market × 1yr
  fii_dii.json           # rolling flow history
  raw_cache/             # every raw NSE response, so a re-run never re-fetches

/out                     # generated artifacts — committed, served by the API
  pulse.json             # the whole screen payload (~5 KB)
  charts/<SLUG>.json     # 252d OHLCV + 20/50/200 DMA, one per visible instrument
  calendar.json          # NSE trading holidays
  meta.json              # generated_at + per-source status

/.github/workflows
  nightly.yml
```

### Three rules that matter most

1. **`/api` imports nothing from `/jobs`.** Separate programs sharing only a file
   format. Keeps pandas out of the serving process.
2. **Every threshold lives in `jobs/config.py`.** DMA periods, volume multiples,
   VIX regime bands, "most active" row count. Never inline a number in logic.
3. **The API never opens `panel.parquet`.** It only reads `out/*.json`.

---

## 7. Pulse pipeline

```
fetch.py
   bhavcopy (whole market)  ·  4 index histories  ·  VIX  ·  FII/DII  ·  holidays
        ↓
panel.py
   append today's bars → data/panel.parquet   (Nifty 500 × 1 year, rolling)
   drop anything older than 1 year
        ↓
breadth.py                          movers.py                  vix.py
   advances  = close > prev_close      most active by turnover     level
   declines  = close < prev_close      52WH breakouts:             250d percentile
   unchanged = close == prev_close       close ≥ 52w high AND      regime band
   A/D ratio                             volume ≥ 1.5 × 20d avg
   % above 50 DMA / 200 DMA
        ↓
writer.py
   out/pulse.json  ·  out/meta.json
```

### Thresholds (all in `jobs/config.py`)

```python
UNIVERSE            = "NIFTY 500"
PANEL_DAYS          = 252          # 1 year
SPARKLINE_DAYS      = 30
MOVERS_ROWS         = 10
BREAKOUT_VOL_MULT   = 1.5          # vs 20-day average
VIX_PERCENTILE_DAYS = 250
VIX_BANDS           = {"low": 13, "moderate": 18, "elevated": 24}
FLOW_SESSIONS       = 10
```

---

## 8. Artifact format

### `out/pulse.json` (< 200 KB)

```jsonc
{
  "as_of": "2026-09-08",
  "tiles": [
    { "symbol": "NIFTY 50", "value": 24836.30, "change": 112.45,
      "change_pct": 0.46, "spark": [/* 30 closes */] }
    // NIFTY BANK, NIFTY 500, INDIA VIX
  ],
  "breadth": {
    "advances": 1382, "declines": 974, "unchanged": 122, "traded": 2478,
    "ad_ratio": 1.42, "pct_above_50dma": 61.3, "pct_above_200dma": 54.8
  },
  "flows": {
    "series": [{ "date": "2026-08-26", "fii_net": -1240.5, "dii_net": 2103.8 }],
    "fii_10_session_net": -12486.0,
    "dii_10_session_net": 18902.0
  },
  "vix": {
    "value": 11.82, "change_pct": -3.75, "percentile_250d": 18,
    "verdict": "Low volatility — trend-friendly",
    "advice": "Favour breakout continuation; wider stops unnecessary."
  },
  "most_active": [
    { "symbol": "RELIANCE", "name": "Reliance Industries",
      "ltp": 1412.60, "change_pct": 1.24, "turnover_cr": 4286 }
  ],
  "breakouts_52w": [
    { "symbol": "TATAMOTORS", "name": "Tata Motors",
      "ltp": 1024.35, "change_pct": 2.86, "vol_ratio": 2.4 }
  ]
}
```

### `out/meta.json`

```jsonc
{
  "generated_at": "2026-09-08T19:02:11+05:30",
  "sources": {
    "bhavcopy": { "ok": true,  "rows": 2478 },
    "indices":  { "ok": true,  "count": 4 },
    "fii_dii":  { "ok": false, "error": "timeout" },
    "holidays": { "ok": true,  "count": 20 }
  }
}
```

`meta.json` drives the stale badge. If tonight's job fails, yesterday's
`pulse.json` is still on disk — the API serves it with the old timestamp and the
UI shows the stale state. **Never a blank screen.**

---

## 9. Postgres schema

Market data never enters Postgres — that is what the whole artifact architecture exists
to avoid. Postgres holds only per-user config, currently:

```sql
users            (id, email, password_hash, is_active, created_at)
watchlist_items  (id, user_id -> users, symbol, name, entry_price, created_at)
alerts           (id, watchlist_item_id -> watchlist_items, kind, threshold, enabled,
                   triggered_at, triggered_price, created_at)
```

The nightly job (not the API) reads `watchlist_items` to fold user-added symbols into
the chart-artifact set, and writes `alerts.triggered_at`/`triggered_price` after
evaluating each enabled alert against that session's high/low — see §7.

`trade_journal`, `pattern_stats` arrive with their own phases later. Do not create them
yet.

---

## 10. Caching

| Layer | Mechanism | TTL |
|---|---|---|
| Nightly artifacts | files in the repo | 24 h (rebuilt nightly) |
| API store | loaded at startup into a dict | until restart |
| Frontend | React Query | 5 min stale time |

One `@cached(ttl=...)` decorator in `jobs/cache.py`, applied to every external
call. One function, used everywhere.

---

## 11. Scope limits for free tier

- **Nifty 500 only** — not the full ~2500 listed symbols
- **1 year of history** — extend only when a backtest needs it
- **Daily data only** — no intraday
- **Artifacts under 50 MB total**
- **Postgres under 1 MB** — users only

These are deliberate. Free tiers break above them.

---

## 12. Migration from what exists today

The current code is Postgres-backed: ~600 k `daily_bars` rows plus indicators,
patterns and scores in Neon, with the API querying it per request. That works but
will exceed Neon's 0.5 GB. Moving to Plan A:

| Step | Action |
|---|---|
| 1 | Add `/jobs` — port `ingest_*` / `compute_*` logic to write JSON, not rows |
| 2 | Add `/out` + `.github/workflows/nightly.yml` |
| 3 | Add `api/store.py`; rewrite `/pulse` + `/market/status` to read the dict |
| 4 | Point the web `/pulse` screen at the new payload shape |
| 5 | Drop the market tables from Neon; keep `users`. Keep the Alembic history |
| 6 | Park the screener / patterns / charts code — it returns with its phase |

Nothing is deleted, only parked. The indicator and pattern maths already written
is pure and moves across unchanged.

---

## 13. Build order

| Phase | Scope | Status |
|---|---|---|
| **P0** | Jobs skeleton, artifact format, GitHub Action, API store, `/pulse` + `/health` | done |
| **P1** | Pulse screen wired end to end on Vercel + Render, keep-alive ping | done |
| **P2** | Screener — setup-pattern engine (VCP, IPO base, 52w breakout, near pivot), breakout-stage classifier, filter rail with live counts, pattern chips | done |
| **P3** | Charts — S/R zones, pattern overlays (pivot/stop/target lines, base/breakout markers), screener chart-grid view | done |
| **P4** | Stock detail — technical snapshot, delivery trend, fundamentals (yfinance), position-sizing calculator | done |
| **P5** | Watchlist + alerts — table/card views, EOD-evaluated price alerts | done |
| **P6** | Sector rotation (heatmap, ranked rail, simplified RRG) + Indices screen (list/chart, constituents drawer, comparison mode) | done |
| P7 | News (RSS + classification) | later |
| P8 | Institutional / F&O | later |
| P9 | Hardening + backtest harness | later |

**Do not skip the backtest** when the score eventually ships. If the composite
score does not beat buying the index over 2–3 years, it is decoration — and you
need to know that before you trade on it.

---

## 14. Design system

- **Fonts:** Inter (UI) + JetBrains Mono (all numbers, timestamps, source lines)
- Light theme, single violet accent `#7C3AED` for interactive/selected states
- Tabular numerals mandatory on every price, percentage, volume and score
- Every percentage carries an explicit sign, using the Unicode minus: `+2.4%`, `−1.1%`
- Indian digit grouping (`1,24,102`), ₹ crore units
- Every card ends with a data-source + IST timestamp footer; amber when stale
- Skeleton loaders, never spinners. Explicit empty states that route onward.

Full wireframe: `design/swing-terminal.dc.html` — the source of truth for layout,
hierarchy and interaction.

---

## 15. Correctness notes

- A wrong number here gets traded on. Reconcile every indicator against a
  reference value before shipping it.
- Free data sources can be stale or simply wrong. Never place an order from this
  platform without checking the price on a broker terminal.
- Log every signal's outcome from day one — it is the only way to learn whether
  any of this works.

---

*Educational tool. Not investment advice. Not SEBI-registered.*
