# Phase 4 — Stock detail

Status: **built, verified end-to-end against real NSE + yfinance data.**

## Scope decision

The original design (`design/swing-terminal.dc.html`, `isDetail` section) also has a
composite-score badge, F&O positioning, and a live market-depth (L2 order book) panel.
None of those have a data source in this architecture: the composite score is explicitly
gated behind the backtest harness (Phase 9 — it doesn't ship until it beats buying the
index), F&O needs the NSE F&O bhavcopy (not ingested), and market depth needs a live
broker feed (out of scope for a nightly-artifact architecture entirely). This phase
built everything that has a real source; the rest stays deferred rather than shipped as
a dead panel.

## Done

### Item 22 — Stock detail shell + header
The existing `/chart/[symbol]` page (already the single per-instrument destination
linked from Pulse, Screener list, and the Screener chart-grid) is the shell — no new
route. Header: symbol, kind chip, name, LTP, change. No score badge (see scope decision).

### Item 23 — Main chart: candles, 3 DMAs, volume, delivery line, S/R
`components/charts/price-chart.tsx` gets a `showDelivery` prop — a dashed delivery-%
line on its own (hidden) price scale, sourced from `delivery_pct` now included on every
stock bar. Candles, volume, 20/50/200 DMA, and support/resistance were already shipped
in Phases 1 and 3.

`jobs/charts.py` — `bhavcopy`'s `delivery_pct` column flows straight into the chart
artifact for stock symbols (`null` for indices, which have no delivery data).

### Item 24 — Technical snapshot card
`app/chart/[symbol]/detail-cards.tsx` — `TechnicalSnapshot`. RSI(14), ATR%, relative
volume (20d), and distance from the 20/50/200 DMA, each with a small bar and a tone
(up/down/neutral). Computed once per symbol in `jobs/charts.py::_technicals()` using the
existing `jobs/indicators.py` primitives (`wilder_rsi`, `wilder_atr`, `rel_volume`,
`distance_pct`, `sma`) — a lookup on the frontend, no client-side math, matching the
"precomputed, never calculated on request" rule. `technicals` is `null` for indices.

### Item 25 — Fundamentals card (yfinance)
New `jobs/fundamentals.py`. One `yfinance.Ticker(f"{symbol}.NS").quarterly_income_stmt`
fetch per symbol — **only for symbols that already get a chart artifact** (screener
matches + index tiles), not the whole market; ~300 fetches/night, not ~2,000. Extracts
`Total Revenue` and `Net Income`, last 4 available quarters, with QoQ deltas. Indian
fiscal-year quarter labels (`Q1 FY27` for an Apr–Jun close). Each fetch is wrapped in
`safe()` — a delisted symbol, a renamed ticker, or a yfinance hiccup returns `None` and
is simply missing from `out/fundamentals/`, never crashes the run.

**Known data-quality gap, not a bug**: Yahoo's own quarterly dataset sometimes skips a
real quarter entirely (confirmed on RELIANCE — Sep-2025 / Q2 FY26 is missing from
Yahoo's columns, so the artifact jumps from Q1 FY26 to Q3 FY26). The quarter labels are
still computed correctly from the dates Yahoo does return; the gap is upstream.

API: `GET /fundamentals/{slug}` (`app/routers/pulse.py`) — a store lookup, 404 if
yfinance had nothing for that symbol that night. Frontend: `useFundamentals(slug)`
treats a 404 as "no data" rather than an error (`retry: false`, and the card simply
doesn't render rather than showing an error state).

### Item 26 — Delivery trend card
`DeliveryTrend` in `detail-cards.tsx` — last 20 sessions' `delivery_pct` as a small bar
chart, average line, "avg X% · today Y%" header. Reuses the same `delivery_pct` field
added for item 23; no new artifact.

### Item 27 — Volatility & position-sizing calculator
`PositionSizing` in `detail-cards.tsx` — pure client-side calculator, no data fetch.
Inputs: capital, risk % per trade, entry, stop (defaulting to the active pattern's
`stop_suggestion`, or `1.5× ATR` below LTP if there's no pattern match). Outputs: risk
per share, shares sized to the risk budget, position value, % of capital.

## Contract changes

- `ChartBar` gains `delivery_pct: number | null`.
- `ChartArtifact` gains `technicals: Technicals | null`.
- New `FundamentalsData` / `FundamentalsQuarter` types, new `/fundamentals/{slug}` route.
- `apps/api/app/store.py` — `_read_dir()` helper (previously inlined just for charts) now
  also backs a `fundamentals` store, keyed by slug the same way charts are.

## Deferred / notes

| Item | Note |
|---|---|
| Composite score badge | Phase 9 — gated behind the backtest beating the index |
| F&O positioning | needs the NSE F&O bhavcopy — not ingested |
| Live market depth (L2) | needs a broker feed — out of scope for a nightly-artifact architecture |
| Fundamentals beyond revenue/net income (margins, EPS, balance sheet) | same yfinance source has them; add if the two-metric card proves useful |
| yfinance rate limiting at scale | fine at ~300 symbols/night; would need throttling/chunking if the scanned universe grows |
