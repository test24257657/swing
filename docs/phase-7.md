# Phase 7 — News

Status: **built, verified end-to-end with real data** (`jobs.news` run against the live
NSE corporate-announcements feed and the Gemini API — 78 relevant filings out of 1,570
raw items for a 3-day window, all classified — and the `/news` route checked with
`TestClient` against the real artifact).

## Done

### Items 36 & 37 — Announcements ingestion + AI classification pipeline
`jobs/sources.py::announcements()` — NSE's `corporate-announcements` endpoint (same
cookie-dance pattern as `fii_dii()`), fetched for a date range across the whole market.

`jobs/news.py::build()` — the pipeline on top of the raw feed:
1. **Filter to the interesting universe** — only symbols already surfaced elsewhere
   (Pulse movers, screener matches, watchlisted symbols; the same set the nightly job
   already builds chart artifacts for), so classification volume stays small and
   relevant instead of covering the whole market.
2. **Filter by category** — `NEWS_EXCLUDE_CATEGORIES` in `jobs/config.py` drops purely
   procedural/scheduling filings (investor meets, trading-window notices, press
   releases, etc.). A denylist rather than an allowlist: NSE's own category taxonomy
   changes over time, and a new/unrecognized category defaulting to "kept" degrades to
   noise in the feed rather than silently dropping something that might matter.
3. **Classify with Gemini** — batches of 20 announcements per request
   (`GEMINI_BATCH_SIZE`), asked for an impact level (`very_positive` … `very_negative`)
   plus a one-line plain-English summary. Responses are cached to disk
   (`jobs/cache.py::raw_path`, keyed on the actual prompt text — not Python's
   per-process-randomized `hash()` builtin, which would never hit on a rerun).
   `GEMINI_API_KEY` unset, or any failure in a batch, degrades that batch to
   `"impact": "neutral"` with no summary — never a crashed run.

Wired into `jobs/run_nightly.py` as step 12, writing `news.json`; served via
`GET /news` (`apps/api/app/routers/news.py`) through the same in-memory artifact store
as every other screen.

### Item 38 — News feed screen
`/news` (`apps/web/src/app/news/news-client.tsx`):
- Five impact chips (strong positive → strong negative) that double as filters and show
  live counts.
- A date-range toggle (Today/3D/1W/All) and a watchlist-only switch.
- Date-grouped list, newest first; each card shows the symbol, category, an AI impact
  summary box, and a link to the original filing.
- A standing disclaimer that impact levels/summaries are AI-generated and can be wrong.

### Item 39 — Stock-scoped announcements
`StockAnnouncements` (`apps/web/src/app/chart/[symbol]/detail-cards.tsx`) — the same
news artifact, filtered client-side to the current symbol, shown as a card on the chart
detail page alongside the other stock-only cards (technicals, delivery, fundamentals).
No extra fetch — one `useNews()` call, shared by both the `/news` screen and this card.

## Not done / deferred

| Item | Note |
|---|---|
| Sector filter on `/news` | design mock has an "All sectors" dropdown; the news artifact doesn't carry a sector tag per item yet (same gap noted in Phase 6 for the Screener) |
| Confidence score per classification | Gemini isn't asked for one; the disclaimer states an approximate, not per-item, caveat |

## Action item for the user

`GEMINI_API_KEY` needs to be added as a **GitHub Actions secret** (Settings → Secrets →
Actions) for news classification to run in the nightly CI job — the workflow reads it
via `secrets.GEMINI_API_KEY` (`.github/workflows/nightly.yml`). Without it, `news.json`
still gets produced, just with every item shipping as `"neutral"` and no AI summary.

## Stock chat ("Ask AI" on the chart page)

- `POST /chat/{slug}` — body `{messages: [{role: "user"|"model", text}]}`; the client owns
  the conversation and sends it back each turn (last 12 turns kept). Auth required.
- `app/services/stock_chat.py::build_context` gathers price, technicals, setup pattern,
  bulk/block deals, money-flow pick, F&O, quarterly results, announcements, sector and the
  weekly outlook for the symbol. **All arithmetic is done in Python** (move since deal
  price, gap vs pivot, stop risk %, target %, reward-to-risk) — the prompt tells the model
  to quote those figures, never compute its own. Same-day buy+sell by one client is
  flagged as offsetting (intraday/arbitrage), excluded from the net-deal value.
- `SYSTEM_PROMPT` — hard grounding rules (data block only, no invented numbers, no bare
  buy/sell, EOD-data caveat), a fixed reasoning order (trend → setup → timing/chasing →
  risk → confirmation → big players → fundamentals/news → both sides), and a fixed
  answer shape (Verdict / Why / Plan / Risks + disclaimer).
- `app/services/gemini.py` — stdlib urllib (no new deploy deps), primary → fallback key on
  429/5xx, `maxOutputTokens` 8192 (1500 truncated answers: 3.x spends budget reasoning).
- Quota: `CHAT_DAILY_LIMIT` (default 20) per user per IST day, in memory; a failed Gemini
  call refunds the question. Needs `GEMINI_API_KEY` **on Render**, not just in GitHub
  Actions secrets.
- Tests: `apps/api/tests/test_stock_chat.py` pins every computed figure.

Deferred: market-wide questions ("best stocks this week?"); persisting conversations;
a quota counter that survives API restarts.
