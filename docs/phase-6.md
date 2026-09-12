# Phase 6 — Market context

Status: **built, verified end-to-end with real data** (`jobs.sectors`/`jobs.indices`
run against the live panel and NSE index feeds — 12/12 sectors, 23/23 indices — and the
API routes checked with `TestClient` against the real artifacts).

Items 31 (Market Pulse) and 35 (holiday calendar → market status pill) were already done
in earlier phases; this phase covers 32-34.

## Done

### Item 32 — Sector Rotation
`jobs/sectors.py` — for each of 12 NSE sector indices (auto, IT, pharma, FMCG, metal,
realty, energy, PSU bank, private bank, media, consumer durables, healthcare):
- **1M/3M return** and a **rank** by 1-month return.
- **Rank delta**: the same ranking recomputed as of 15 sessions ago (~3 weeks), so a
  sector's rise or fall in the pecking order is visible, not just its return.
- **Constituents + advancers**: each sector's member list (from niftyindices.com,
  verified filenames — see below) enriched with today's LTP/change from the panel, and
  a count of how many are up.
- **RRG tail**: a simplified relative-rotation graph — X = a 30-session
  relative-strength ratio vs NIFTY 500 (rebased to 100), Y = that ratio's 10-week rate
  of change, sampled weekly for the last 6 points. Deliberately simpler than the classic
  JdK RS-Ratio/RS-Momentum (no double-smoothing) — matches the plain-English formula
  the UI's own tooltip states, not a ground-up reimplementation of the JdK method.

Frontend (`/sectors`): a heatmap (equal-size cells — no market-cap data in this build,
so cells aren't sized by float market cap like the original design; colour = 1-month
return on a fixed ±8% scale), a ranked rail with rank-delta arrows, click-through to a
constituents panel, and the RRG scatter (`components/charts/rrg-scatter.tsx`) with the
four quadrants (Improving/Leading/Lagging/Weakening) and per-sector tails.

**Verified filenames.** `jobs/sources.py::NIFTY_CSV` was extended with 12 sector-index
constituent-list filenames — each was fetched and its response body checked to confirm
it was a real CSV, not niftyindices.com's HTML 404 fallback (same 200 status either
way). "NIFTY OIL & GAS" was tried and dropped: `nselib`'s `index_data` doesn't resolve
that exact index name at any range, not a transient failure — 12 sectors shipped
instead of a guessed 13th.

### Item 33 — Indices screen
`jobs/indices.py` — list metadata (value, change, category) for every broad-market
index (NIFTY 50/Next 50/100/200/500, midcap 100/150, smallcap 100/250, NIFTY BANK,
INDIA VIX) plus the 12 sector indices above — 23 total. Chart artifacts for all of them
are produced by the existing `jobs/charts.py` (its `tile_symbols` parameter was already
generic; the nightly run now just passes it a longer list).

Frontend (`/indices`): category tabs (All/Broad market/Sectoral), a List/Chart view
toggle (same URL-state pattern as the Screener's), and a constituents drawer — but only
for sectoral rows, since only those have a fetched constituent list in this build (a
drawer for NIFTY 500's 500 members would need pagination this phase doesn't add).

### Item 34 — Index comparison mode
A "Compare" panel on `/indices`: pick up to 6 indices and see them overlaid on one
chart (`components/charts/index-compare-chart.tsx`), each rebased to 100 at the first
session common to all of them — a visual "which one's up more," not a percentage a
reader has to compute themselves. Uses the same per-index chart artifacts everything
else on the page already fetches; no new backend data.

### Item 35 — already done
Holiday calendar → market status pill shipped in Phase 0/1 (`jobs/sources.py::holidays()`,
`app/services/market_status.py`). Nothing changed here.

## Not done / deferred

| Item | Note |
|---|---|
| Market-cap-weighted heatmap cells | no market-cap data source in this build — cells are equal-size, colour still carries the return signal |
| Constituents drawer for broad-market indices (NIFTY 500 etc.) | would need pagination for the larger ones — sectoral indices (10-40 members) don't |
| Classic JdK RS-Ratio/RS-Momentum (double-smoothed) | shipped the simpler formula the UI's own tooltip states instead |
| Clicking a sector cell to a pre-filtered Screener view | the Screener has no sector tag on its rows yet — sector cells open a constituents panel instead |
