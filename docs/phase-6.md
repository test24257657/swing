# Phase 6 — Market context

Status: **built, not yet run against real data.** Endpoints return 200 on the empty DB
and the UI renders its empty/phase-stub states. Nothing here has been exercised on an
actual ingestion.

Built ahead of Phases 3–5 (charts, stock detail, watchlist/alerts) at the user's request.

## Done

### Schema (migration 0005)
`market_breadth`, `fii_dii_flows`, `index_constituents`, `holiday_calendar`.

### Jobs
- `ingest_holidays` — nselib `holiday_master`; `calendar.py` now reads the table
  (weekend-only fallback) and gained `next_trading_day`.
- `ingest_fii_dii` — cash-segment FII/DII buy/sell/net, recent sessions.
- `compute_breadth` — advances/declines/unchanged + % above 50/200 DMA + new 52-week
  highs/lows, from `daily_bars` + `daily_indicators`.
- `sync_index_constituents` — sectoral indices only (from `symbols.sector_id`),
  `weight` NULL until a factsheet source. Broad/thematic membership is left empty.
- All added to the nightly pipeline (`scheduler.py`) and the Render cron.
- `INDIA VIX` added to the index seed.

### Item 35 — Holiday calendar → market status pill
- `services/market_status.py` — trading / pre-open / closed / holiday from the holiday
  calendar + IST clock; Muhurat-aware; returns `seconds_to_next`.
- `GET /market/status` (uncached). `MarketStatusPill` polls it every 30s and ticks a
  1-second countdown client-side.

### Item 31 — Market Pulse
- `GET /market/pulse` → index tiles (NIFTY 50 / BANK / 500 + INDIA VIX with 30d
  sparklines), breadth (A/D ratio, %>50/200 DMA, new H/L), FII/DII last 10 + 10-session
  net, VIX value + 250-day percentile + regime verdict/advice.
- `/pulse` screen: tiles, breadth donut (SVG), FII/DII grouped bars (SVG), VIX gauge.

### Item 32 — Sector Rotation
- `GET /sectors/rotation?tf=` → heatmap cells, momentum ranking with rank-change vs
  ~3 weeks ago, RRG (simplified JdK RS-ratio / RS-momentum vs NIFTY 500, weekly tails).
- `/sectors` screen: return heatmap (cell span by constituent count — **proxy for
  free-float mcap, which we don't have**), ranked rail, RRG scatter. Click a sector →
  `/screener?sector=…`.

### Items 33 & 34 — Indices + comparison
- `GET /indices`, `/indices/{sym}`, `/indices/{sym}/constituents`, `/indices/compare`.
- `/indices` screen: category tabs, TF, **list / chart / compare** views; constituents
  drawer with point contribution (weight × return; equal-weight when weights are NULL);
  compare mode overlays 2–5 indices normalized to 100.

## Deferred / caveats

| Item | Note |
|---|---|
| Free-float market-cap sizing for the heatmap | using constituent count as a proxy — needs a mcap source |
| Broad/thematic index constituents + real NSE factsheet weights | only sectoral membership is mapped |
| SENSEX tile | BSE index — nselib doesn't serve it; using NIFTY 500 instead |
| Run the ingestion and validate the numbers | the standing gate for every phase |
| Phases 3 (charts), 4 (stock detail), 5 (watchlist/alerts) | skipped for now, still to build |
