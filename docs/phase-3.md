# Phase 3 — Charts

Status: **built, not yet seen with real data.** Typecheck + lint clean; not screenshotted
(the user's dev server was running). Needs `daily_bars` ingested to render anything.

## Done

### Item 18 — Lightweight Charts wrapper
`components/charts/price-chart.tsx`. TradingView Lightweight Charts v4:
candlestick series, volume histogram pane, 20/50/200 DMA line series, magnet crosshair,
mouse-wheel zoom + drag-pan, `ResizeObserver` for responsiveness, `fitContent` on load.
`compact` prop strips axis labels and volume for grid cards. Theme colours match the
design (green/red candles, blue/amber/violet MAs).

### Item 19 — Support/resistance algorithm
`app/patterns/support_resistance.py`. Swing highs/lows over a lookback window are
clustered (±1.2% tolerance) into horizontal levels; each level scored by touch count +
recency; split into support (below last close) and resistance (above); top ~4 returned.
Served by `GET /stocks/{symbol}/chart` and drawn as dashed price lines.

### Item 20 — Pattern annotation overlays
`components/charts/pattern-overlay.tsx`. An SVG layer over the chart that reads the
chart's own `priceToCoordinate` / `timeToCoordinate` and redraws on every pan / zoom /
resize (`tick` prop bumped from the chart's range subscription). Draws VCP contraction
zones (`meta.contractions`) as translucent violet bands from the base start to the right
edge, and a breakout box at `breakout_date`. Pivot / stop / target come through as native
price lines from the wrapper.

### Item 21 — Screener chart view
`components/screener/chart-grid.tsx`. 2-column grid, 10 cards/page, its own pagination.
Each card shows symbol / LTP / %chg / pattern chips / score, then a **lazily-mounted**
compact `PriceChart` — the chart (and its API call) only fire once the card scrolls
within 200px of the viewport (`IntersectionObserver`). Chart view forces `per_page=10`.

### Backend
`GET /stocks/{symbol}/chart?tf=` → adjusted OHLCV bars, 20/50/200 DMA series (from
`daily_indicators`), S/R levels, and the latest pattern signals with their
pivot/stop/target and VCP contraction meta.

## Deferred / notes

| Item | Note |
|---|---|
| Stock Detail full chart (delivery-% overlay, OI levels) | Phase 4 |
| Indices chart view still uses SVG sparkline cards | swap to `PriceChart` later |
| IPO-base rectangle + 52WH line as SVG shapes | overlay currently does VCP zones + breakout box + native price lines; add the rest when validated on real charts |
| `lightweight-charts` v5 upgrade | pinned to 4.2.3 (stable API) |
