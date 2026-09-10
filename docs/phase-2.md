# Phase 2 — Pattern detection

Status: **built, unit-verified, not validated on real charts.** The detectors pass
synthetic golden tests. Real-chart precision/recall (hand-labelling ~100 charts) is a
separate gate that needs ingested data and has not been done.

**Ported to Plan A.** This phase was originally built against Postgres
(`pattern_signals` table, `jobs/detect_patterns.py` ingestion job, `services/screener.py`).
When the project moved to the file-artifact architecture, the detector logic in
`app/patterns/` (pure OHLCV → `PatternMatch` functions, no I/O) carried over unchanged
into `jobs/patterns/`. What changed is everything *around* the detectors:

- Context (`vol_sma_20`, `atr_14`, `listing_date`) now comes from the rolling panel
  (`jobs/panel.py`) and `jobs/sources.py::listing_dates()` instead of Postgres.
- `jobs/screener.py` runs `detect_all()` across every symbol in the panel and writes
  one artifact, `out/screener.json` (`{as_of, facets: {patterns, stages}, rows}`),
  instead of upserting `pattern_signals`.
- The API's `/screener` route (`app/routers/screener.py`) is a store lookup like
  `/pulse` — no compute on request, no database.
- Detection runs on **unadjusted** closes (Plan A's whole-market bhavcopy has no
  corporate-action adjustment factor) and against the 252-session rolling panel rather
  than the ~320 bars the old job pulled — a known gap, not yet closed.
- The old Postgres-era `app/patterns/`, `app/services/screener.py`,
  `app/models/pattern_signal.py`, `app/models/screener_score.py`,
  `app/schemas/screener.py` and `app/ingestion/jobs/detect_patterns.py` were removed;
  git history has them if the Postgres path is ever revived.

## Scope

Four detectors this phase — **VCP, IPO Base, 52-Week High Breakout, Near Pivot**.
**Flat Base** and **Cup & Handle** were deferred (the user's call) until the first four
are validated.

## Done

### Pattern engine (item 14)
- `app/patterns/` — one pure detector per file, `(adjusted OHLCV frame, DetectContext)
  → PatternMatch | None`. Shared helpers in `base.py`: `swing_points`,
  `contraction_legs`, `clamp01`.
  - `high_52w_breakout` — close at/above (or within 2% below) the trailing 52-week high;
    pivot = prior 52w high; target = pivot ×1.20.
  - `vcp` — ≥2 pullback legs with broadly decreasing depth, first ≥8% / last ≤12%,
    price coiled within ~8% of the base high, volume drying into the pivot.
  - `near_pivot` — price within ~3% below a resistance tested ≥2 times, not yet crossed;
    always `forming`. Suppressed when VCP already fired.
  - `ipo_base` — symbol listed within ~2 years, a ≥4-week range ≤35% wide, post-listing
    high as the pivot.
- `detect_all()` drops matches below 0.35 confidence — a missing pattern beats a wrong one.
- `detector_version` on every row (`pattern_signals.detector_version`).

### Breakout-stage classifier (item 15)
- `app/patterns/stage.py` — **Forming** (pivot not crossed, or crossed without a volume
  thrust), **Confirmed** (pivot crossed within 3 sessions on ≥1.4× the 20-day average
  volume), **Extended** (>5% past the pivot). Thresholds are module constants.

### Schema + job
- `pattern_signals` table (migration 0004), PK `(symbol_id, date, pattern_code)`.
- `jobs/detect_patterns.py` — loads ~320 adjusted bars per symbol, runs every detector for
  the latest date, upserts. Added to the nightly pipeline and the Render cron
  (after `compute_indicators`).

### Screener wiring
- `services/screener.py` — `patterns` (any-of) and `stage` filters via an `EXISTS`
  predicate on `pattern_signals`; each result row carries its matched pattern codes
  (confidence-ordered); `facets.patterns` and `facets.stages` count matching symbols and
  deliberately ignore their own filter so toggling one doesn't zero the others.

### Frontend (items 16 & 17)
- `PatternChip` — code → label / tone / tooltip. Used in the screener list's Pattern
  column and (long form) in the filter rail.
- Filter rail Setup-patterns section shows live `facets.patterns` counts.
- Breakout Stage is a 2×2 grid with `facets.stages` counts and the per-stage guidance
  note.

### Tests
- `tests/test_patterns.py` — 11 synthetic cases: each detector fires on a clear example
  and stays silent on a clear non-example; stage classifier extended/forming; orchestrator
  confidence floor + near_pivot/VCP dedupe.

## Not done / deferred

| Item | Where |
|---|---|
| Hand-label ~100 real charts, measure precision/recall per detector, tune thresholds | before Phase 2 "ships" — needs data |
| Flat Base + Cup & Handle detectors | later |
| Confidence-gating low-confidence matches in the UI | polish |
| Pattern overlays on the chart (contraction zones, pivot lines) | Phase 3 |
| Corporate-action-adjusted OHLC for detection (Plan A panel is unadjusted) | later |
| Composite score, RS-vs-sector, delivery %, RSI, sector column, saved screens, CSV export, card/grid view | Phase 9 (score) and later (the rest — no sector data yet) |
