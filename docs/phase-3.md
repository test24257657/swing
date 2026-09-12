# Phase 3 — Charts

Status: **built, live on the deployed chart page.** Pure client-side computation over
data already in `out/charts/*.json` and `out/screener.json` — no new artifact, no
backend change beyond adding two date fields the pattern engine already computed.

## Done

### Item 18 — Lightweight Charts wrapper
`components/charts/price-chart.tsx`. Shipped with Phase 1: candlestick series, volume
histogram pane, 20/50/200 DMA line series, magnet crosshair, mouse-wheel zoom, drag-pan,
`ResizeObserver`. `apps/web/src/app/chart/[symbol]/chart-client.tsx` adds a D/W/M
timeframe switch — weekly/monthly bars are aggregated client-side from the daily
artifact (OHLC composite, volume summed); daily-period DMAs and pattern overlays only
apply to D.

### Item 19 — Support/resistance
`lib/support-resistance.ts` — pure function over the bars already on screen. Finds
swing highs/lows (local extreme within a +/-3 bar window), clusters points within 1.5%
of each other into one level, keeps the top 3 per side by touch count. Drawn as solid
native price lines on the candlestick series (dark amber = resistance, dark blue =
support, deliberately distinct from the green/red candle colors), labeled with the
touch count. Recomputes per D/W/M view.

### Item 20 — Pattern overlays
When the open symbol has an active match in `out/screener.json` (daily timeframe only —
`base_start_date`/`breakout_date` are daily sessions and won't land on aggregated W/M
bars), the chart draws:
- Pivot / stop / target as dashed price lines (violet / red / green).
- A `Base` marker at `base_start_date` and a `Breakout` marker at `breakout_date`, via
  the chart library's native `setMarkers()` — no custom SVG coordinate-sync layer.
- A summary banner above the chart: pattern chip, stage, and the three price levels.

`jobs/screener.py` was extended to include `base_start_date` and `breakout_date` on
each pattern match (the detectors already computed them; they just weren't in the
artifact). Mirrored in `PatternMatch` (`lib/api/market-types.ts`).

Contraction-zone shading (translucent bands over the VCP pullback legs) was the
original pre-Plan-A design for this item but needs a pan/zoom-synced SVG overlay layer
— deferred; the pivot/stop/target lines plus base/breakout markers cover the
actionable information (entry, stop, target, where the pattern started and confirmed)
without that complexity.

### Item 21 — Screener chart-grid view
`components/screener/chart-grid.tsx` + a List/Chart toggle in `screener/screener-client.tsx`
(state in the URL via `?view=grid`, same as the pattern/stage filters). 2-column grid,
10 cards/page (grid mode forces a 10-row page size vs. 25 in list mode). Each card is a
`<Link>` to its chart page; the embedded compact `PriceChart` (no volume, no S/R — just
candles + pattern overlay) only mounts once the card scrolls within 200px of the
viewport (`lib/use-in-view.ts`, `IntersectionObserver`), so opening the grid doesn't
fire 300+ chart requests at once.

### Also shipped with this phase (not part of the original item list)
- Screener list-view columns are sortable (Symbol, LTP, %Chg, and a new **Near pivot**
  column — |distance to the top-confidence pattern's pivot|, closest first by default),
  and results paginate at 25/page.
- Chart's back link now returns to the screener with whatever pattern/stage filter was
  active, instead of always going to Pulse (filters live in the URL via `nuqs`, and each
  screener row's chart link carries a `?back=` param the chart page reads).

## Deferred / notes

| Item | Note |
|---|---|
| VCP contraction-zone SVG bands (pan/zoom-synced overlay) | needs a custom coordinate-sync layer; pivot/stop/target lines + base/breakout markers cover the essentials for now |
| IPO-base range rectangle, 52WH line as a distinct shape | same overlay-complexity tradeoff |
| Hand-validate S/R and pattern levels against real charts | still the standing Phase 2 gate — nothing here changes it |
| Indices don't get pattern overlays | the screener only scans equities; index tiles still get S/R only |
