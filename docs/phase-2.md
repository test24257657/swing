# Phase 2 — Pattern detection

Status: **built, unit-verified, not validated on real charts.** The detectors pass
synthetic golden tests. Real-chart precision/recall (hand-labelling ~100 charts) is a
separate gate that needs ingested data and has not been done.

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
| Real NSE holiday calendar (still weekend-only) | carried forward |
| Confidence-gating low-confidence matches in the UI | polish |
| Pattern overlays on the chart (contraction zones, pivot lines) | Phase 3 |
