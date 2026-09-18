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
    pivot = prior 52w high (measured *before* the confirm window, so a breakout bar can't
    raise the very level it broke); target = pivot ×1.20.
  - `vcp` — ≥2 pullback legs with broadly decreasing depth, first ≥8% / last ≤12%,
    price coiled within ~8% of the base high, volume drying into the pivot. **Gated on
    the Minervini Trend Template** (`base.trend_template`) — a contraction inside a
    downtrend is not a VCP, and on the live panel that gate removes 57% of what the
    detector used to emit (87 → 37 matches).
  - `near_pivot` — price within ~3% below a resistance tested ≥2 times, not yet crossed;
    always `forming`. Suppressed when VCP already fired.
  - `ipo_base` — symbol listed within ~400 days **and** with ≤250 sessions of history, a
    ≥4-week range ≤30% wide, post-listing high as the pivot, breakout volume ≥2.0×
    (stricter than the shared 1.4× — a first-base breakout with no volume is the classic
    failure). The pivot is taken from *before* the confirm window; it previously included
    today's bar, so an IPO base could never mathematically reach `confirmed`.
  - `trendline_breakout` — successively lower swing highs fitted to a falling line
    (≥3 touches spanning ≥40 sessions), with price now closed above the line's value
    *today* on a volume-confirmed thrust of ≥2%. Only `confirmed` matches are emitted.
    Tuned against random walks until the false-positive rate fell from 11.7% to 0.3%;
    on the real panel it fires on 14 of 2,680 symbols (0.5%).
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
- `tests/test_patterns.py` — 22 synthetic cases: each detector fires on a clear example
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

### Data fix — phantom holiday sessions
On an NSE holiday the bhavcopy endpoint served the previous session's file, which we
stamped with the requested date. The panel had **14 fake sessions** in its one-year
window (every NSE holiday since Oct 2025), ~5.5% of bars — skewing SMAs, RSI, ATR,
volume averages, returns and pattern lookbacks for every symbol.
- `sources.bhavcopy` now checks the file's own `DATE1` and rejects a mismatch.
- `panel.drop_phantom_sessions` removes any session where ≥95% of symbols repeat the prior
  day's close *and* volume (real sessions: 0 of ~2,900), healing panels already cached in
  GitHub Actions. Dropped dates are reported in `meta.json` → `phantom_sessions_dropped`.

### Data fix — index tiles a session behind stocks
NSE's historical index API publishes a session hours after the daily closing file: at
~10:45 PM IST it still ended at the previous day while the stock bhavcopy had today, so
every index tile/chart lagged stocks by one session (prod too — the 7 PM run).
- `sources.index_history` now fills sessions after the history's last date from
  `ind_close_all_DDMMYYYY.csv` (reconciled: NIFTY 50 15-Sep close 23118.60 in both), checking
  the file's own `Index Date` so a holiday can't be stamped as a session.
- A history chunk ending today is no longer cached — it froze the index behind for every
  rerun that day.

## Daily Scan tab (`/scan`, after Market Pulse)

`jobs/daily_scan.py` → `out/daily_scan.json` → `GET /daily-scan`. Rule-based, zero Gemini
calls. Thresholds in `jobs/config.py` (`RS_*`, `DELIVERY_SPIKE_*`, `POCKET_PIVOT_*`,
`DISTRIBUTION_*`, `REGIME_*`). Stocks only — the ~350 ETFs/liquid/index funds in the EQ
series are excluded via NSE's equity list (they topped the delivery-spike list).

- **Market light** — red if NIFTY 50 < 200-day, breadth < 30% above 50-day, or below the
  50-day with 5+ distribution days; green if above both averages, < 5 distribution days,
  breadth ≥ 50%; else yellow. Distribution day = NIFTY down ≥ 0.2% on higher volume than
  the prior session (volume = summed NIFTY 50 constituents' volume — the index files carry
  none for history). First run: red (−5.0% vs 200-day, 9 distribution days, 31% breadth).
- **RS rating 1–99** — 0.4×3M + 0.2×6M + 0.2×9M + 0.2×12M return, percentile across ~2,230
  stocks with ≥ 126 sessions.
- **Ready today** — trend template + RS ≥ 80 + liquid (₹1 cr median turnover) + a
  `forming` setup 0–3% under its pivot; flags volume dry-up (5-day vol ≤ 60% of 50-day).
- **Delivery spikes**, **pocket pivots** (up day, volume > every down day of the last 10,
  above the 50-day, ≤ 5% over the 10-day), **RS leaders**, **sector leaders** (top 3
  sectors × top 3 RS).
- Tests: `jobs/tests/test_daily_scan.py`.

Deferred: RS column + filter in the Screener; breadth/screener still count ETFs (same
fix applies there — changes published breadth numbers, so done separately).
