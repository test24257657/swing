# Phase 1 — Core screener (MVP)

Status: **built, not yet run against real data.** Everything below works on the empty
Neon DB (endpoints 200, UI renders). It has not been exercised on an actual bhavcopy
backfill — the user chose to keep building on stubs and run ingestion later.

## Done

### Indicator engine (item 8)
- `app/indicators/core.py` — pure functions: SMA, EMA, **Wilder** RSI + ATR (SMA-seeded,
  StockCharts/TradingView definition), rolling return, rel-volume, 52-week distance,
  delivery-trend label. Golden tests reconcile RSI-14 to the StockCharts worked example
  within 0.35.
- `app/indicators/compute.py` + `jobs/compute_indicators.py` — per-symbol compute on the
  adjusted close, RS vs the matching sectoral index, latest-day or `--full` backfill,
  upsert into `daily_indicators` (wide table, `indicator_set_version`).

### Screener API (item 9)
- `GET /screener` — filters (sector, F&O, RSI, distance-from-52WH, rel-volume, delivery,
  min-score, DMA flags), sort (composite / rsi / rs / delivery / rel_volume / ret_20d /
  dist_52wh), pagination, and sector + verdict facet counts. `patterns` / `stage` params
  are accepted but no-op until Phase 2.
- `GET|POST|DELETE /screener/saved` — saved screens (single-user `local`).

### Screener list view (item 10)
- `ScreenerList` — sortable column headers, row-hover watch/detail actions, server
  pagination, an amber "score v1 unvalidated" banner, list / empty / error / stale states.
- All formatting through `lib/format.ts`.

### Filter sidebar (item 11)
- `FilterRail` — Setup-patterns section (4 checkboxes, counts pending Phase 2), Breakout
  Stage segmented, and REFINE accordions: **Universe** (F&O toggle, sector chips with
  facet counts), **Technical** (>20/50/200 DMA chips, RSI / distance-from-52WH / volume
  ranges), **Delivery** (delivery % ≥), **Score** (min composite).
- Filters are URL state via **nuqs** — a screen is a shareable link, back/forward works.
  Rail-collapsed and which-accordion-is-open stay in the Zustand `useFilters` store.

### Composite score (item 12)
- `app/scoring/composite.py` — cross-sectional sub-scores:
  - **momentum** = blend of 20/60/120-day return percentile + DMA-stack + RSI-band
  - **delivery quality** = delivery-% percentile + trend bonus + rel-volume
  - **relative strength** = percentile of return-minus-sector-index (RS benchmark =
    **sector**, per the decision)
  - **earnings trend** = mapped mean QoQ net-profit growth over the last ≤4 quarters
    (needs `sync_fundamentals`; renormalised out when missing, `inputs_present < 4`)
  - composite = `0.35·mom + 0.25·deliv + 0.20·rs + 0.20·earnings`, verdict bands
    V.Good ≥80 / Good ≥60 / Avg ≥45 / Poor.
- `jobs/compute_scores.py` — scores the whole universe for a date (or `BACKFILL=1` over
  history), ranks overall + in-sector, upserts `screener_scores`.
- **`score_validated` is hard-coded `false`.** It flips only when the backtest passes.
- `ScoreCell` UI — number + verdict + proportional bar + `n/4` inputs marker.

### Backtest harness (the gate)
- `app/backtest/harness.py` + `backtest_runs` table (migration 0003) +
  `jobs/run_backtest.py` — top-N by composite, weekly rebalance, per-side cost bps,
  vs NIFTY 500 buy-hold; reports CAGR / drawdown / Sharpe / hit-rate / `beats_benchmark`.
  Documents its own caveats (no survivorship adjustment, short window if the backfill is
  shallow). Needs `compute_indicators --full` + `compute_scores BACKFILL=1` first.

### Fundamentals (minimal, for the earnings leg)
- `sources/yf_fundamentals.py` + `jobs/sync_fundamentals.py` — yfinance quarterly
  revenue / net-profit / EPS + a few ratios, cached, resilient, slow (one HTTP call per
  symbol — run less often than the bhavcopy job).

### Indices
- `indices` + `index_bars` + `jobs/ingest_indices.py` — ~22 indices (broad + sectoral),
  history via `nselib.index_data`. Sector RS reads the matching sectoral index.

### Scheduler / deploy
- `app/scheduler.py` — one nightly pipeline in dependency order (symbols → indices →
  bhavcopy → indicators → fundamentals → scores → backtest).
- `render.yaml` cron chains the same seven jobs.

## Not done / deferred

| Item | Where it goes |
|---|---|
| Run the ingestion + validate every number against a reference | before Phase 2 ships |
| Backtest actually executed; `score_validated` flipped | when there's history |
| Saved screens: `⌘S` keyboard shortcut, rename | polish |
| TanStack Virtual for a full client-side result set | later (server pagination for now) |
| Real NSE holiday calendar | Phase 2 |
| Pattern engine + stage classifier + live counts + list chips (items 14–17) | **Phase 2** |
