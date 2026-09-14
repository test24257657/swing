# AI insights — stock narrative, weekly outlook, money flow, results calendar

Not one of the original 9 phases in `docs/ARCHITECTURE.md` — added afterward, on top of
the artifacts those phases already produce. Documented separately rather than
folding into a phase-N.md so it doesn't collide with the reserved P9 (hardening +
backtest harness).

Status: **built, verified end-to-end with real data** — every pipeline below runs
against live NSE/Gemini/mem0 and produces real, correctly-synthesized output (confirmed
against actual XBRL filings and actual technicals, not mocked).

## AI stock narrative (`jobs/ai_insights.py`, nightly)

One short, plain-English paragraph per stock — synthesizes technicals, the setup
pattern (if matched), the latest filed quarter's fundamentals, and the most recent
relevant news into a single read, plus a bullish/neutral/bearish verdict tag. A
second opinion alongside the existing rule-based `technicalVerdict()` on the chart
page, not a replacement for it.

Runs across the **whole traded market** (~2,900 stocks on a typical session), not
just the narrower "interesting universe" fundamentals/F&O use:

- **Technicals** come straight off the in-memory OHLCV panel via
  `jobs/charts.py::technicals()` (exposed as a public function for this reuse) — no
  new full-history artifact is written per symbol. Writing a full chart artifact
  (~68 KB each, like the existing `out/charts/*.json`) for ~2,900 stocks would add
  ~200 MB to the nightly commit; the AI summary artifact itself is a small text blob
  (~1-2 KB), so only that gets written.
- **Fundamentals** come from the official NSE XBRL filing
  (`jobs/sources.py::financial_results()` + `xbrl_financials()`, built for Phase 8's
  filing verification, reused here as the primary source) — never yfinance, and
  never guessed by the model. A stock only gets a fundamentals line in its prompt
  when NSE has actually published that quarter's filing and it parsed cleanly;
  otherwise the line is simply absent. yfinance-backed fundamentals stay exactly
  where they were (`jobs/fundamentals.py`, ~350-symbol scope, the quarter-over-quarter
  table on the chart page) — untouched by this.
  - Cached per symbol per day (`raw_path("financial_results", f"{symbol}-{date}")`) —
    a company's filing list doesn't change within a day, so a same-day rerun never
    re-hits NSE.
  - XBRL documents themselves are cached forever by URL — a filed document never
    changes.
  - One shared `httpx.Client` (`financial_results_client()`) is reused across the
    whole run instead of a fresh cookie-dance per symbol.
- **Gemini** is batched (`AI_INSIGHT_BATCH_SIZE = 15` symbols/request) and paced
  (`jobs/gemini.py`): a minimum interval between calls plus retry-with-backoff on
  HTTP 429, honouring `Retry-After` when the server sends one. Sized against the
  assumed free-tier Flash caps (~15 RPM / ~1,500 RPD —
  https://ai.google.dev/gemini-api/docs/rate-limits) but tightened after real testing
  hit 429s at that pace — `GEMINI_MIN_INTERVAL_SECONDS` is now more conservative than
  the naive calculation. **Why not use Gemini for fundamentals directly, skipping
  NSE/yfinance?** Because this is a single `generateContent` call with no
  browsing/tool access — asked for a number it wasn't given, it would either recall
  a stale figure from training data or produce a plausible-looking guess, with no way
  for the UI to tell the two apart from a real one. That's the one thing this
  project's rules explicitly warn against ("a wrong number is worse than a missing
  feature — real money is traded on this").

Verified live: a 45-symbol real-market sample produced correct, well-reasoned
summaries (e.g. correctly citing "negative quarterly revenue and earnings" for a
stock whose real XBRL filing showed a loss), 30/45 succeeded when a batch
legitimately hit a 429 mid-run — confirming the degrade-gracefully path works, not
just the happy path.

## Weekly AI market outlook (`jobs/weekly_outlook.py`, Fridays only)

One Gemini call a week — not nightly — synthesizing market breadth, INDIA VIX,
FII/DII net flows, sector rotation, and the broad indices into a single
"which way does the market lean next week" call: a direction (bullish/neutral/
bearish) with a rationale, plus a sector to watch. Deliberately scoped to the
market-wide picture only:

- **Not** news or institutional bulk/block deals — those move day to day and are
  already surfaced daily on their own screens (`/news`, `/institutional`); folding
  them into a once-a-week call would make it stale by Tuesday.
- Once-a-week keeps both Gemini and mem0 usage trivially small on a free tier (one
  call each, a week apart — not per-symbol, not nightly).

**Cross-week memory via mem0** (`jobs/memory.py`): before making this week's call, it
recalls its own past calls (`client.search(...)`) and is asked to briefly self-grade
whether last week's call held up, before making a new one. The new call (and its
self-grade) is stored back (`client.add(...)`) for next week to find. Both calls are
wrapped in `safe()` — mem0 being unconfigured, empty, or briefly unavailable
(its `add()` is asynchronous on their end; a `search()` moments later can legitimately
still be empty) just means that week's outlook starts from a blank slate, never a
failed run.

## Frontend

- `/pulse` — "Weekly AI Outlook" card (`WeeklyOutlookCard` in `pulse-client.tsx`):
  direction + confidence + sector pick, with last week's self-grade shown when mem0
  has one. Renders nothing before the first Friday run has ever produced an outlook.
- Chart detail page — "AI Read" card (`AiSummaryCard` in `detail-cards.tsx`): the
  paragraph + verdict chip, placed right below the header, above the deterministic
  technical/delivery/position-sizing cards.
- Both cards are explicitly labelled "✦ AI" and carry a one-line disclaimer that
  it's AI-generated — same convention as the News screen's impact classification.

## Money flow picks (`jobs/institutional.py::_ai_money_flow`, nightly)

One Gemini call a night, on the `/institutional` screen: today's largest bulk/block
deals are synthesized into 3-5 stocks with the strongest real institutional buying
signal — weighted toward the same client buying the same stock repeatedly across
sessions (the existing 30-session repeat-accumulation flag), not just today's single
largest ticket, which is just as often profit-booking as conviction buying.

## Results calendar (`jobs/results_calendar.py`, nightly, its own screen)

A ±30-day, whole-market calendar of quarterly result dates:

- **Upcoming** — NSE's own board-meetings feed (`jobs/sources.py::board_meetings()`),
  filtered to the `"Financial Results"` purpose. Shown unconditionally; there's
  nothing to judge about a result that hasn't happened yet.
- **Already-filed** — the real filed XBRL figures (same source as the stock
  narrative/filing verification) are compared quarter-over-quarter and Gemini judges
  good vs not-good from those real numbers, told explicitly to be conservative (both
  revenue and profit growth, not just one). **Only "good" results stay on the
  calendar** — a bad result or a filing that hasn't landed yet are both hidden, per
  the explicit ask: this is a "what to watch," not a scoreboard of misses.

Caught and fixed a real bug while building this: some filings carry `"xbrl": "-"` as
NSE's own placeholder for "nothing attached" rather than `null` — a bare truthiness
check (`r.get("xbrl")`) treats that string as present and sends a doomed fetch. Fixed
in all three places that share this filter (`ai_insights.py`, `filing_verify.py`,
`results_calendar.py`).

Verified live: a real 30-day sample judged 12 already-filed results, all correctly
called not-good with specific, figure-grounded rationale (net losses, revenue
declines, non-operational income) — "0 good" was a real conservative verdict, not a
parsing failure (checked the raw judged output directly to confirm).

New screen: `/calendar` ("Results Calendar" in the nav) — a real month-grid, entries
placed on their actual date, prev/next month bounded to the ±30-day data window.

## Action items for the user

- **`MEM0_API_KEY`** needs to be added as a GitHub Actions secret
  (`.github/workflows/nightly.yml` already reads `secrets.MEM0_API_KEY`) for the
  weekly outlook's cross-week memory to work in production. Without it, the outlook
  still generates every Friday, it just never grades its own prior call.
- The nightly job now does meaningfully more work (technicals for ~2,900 stocks
  instead of ~350, ~2,900 NSE filing lookups, ~195 paced Gemini calls at ~9 RPM ≈
  20+ minutes just for this step) — worth watching actual CI runtime against the
  workflow's timeout after this ships.
