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

## AI top 5 swing setups (dashboard)

`jobs/ai_top_picks.py`, nightly step 16b → `out/ai_top_picks.json` → `GET /ai-top-picks`
→ `TopPicksCard` on Market Pulse.

1. **Rules gate eligibility** (`evaluate`, pure + tested) across the AI-narrative
   universe: above the 50- and 200-day averages; ≤10% above the 20-day; RSI 45–75; not
   `extended` and ≤5% past the pivot; latest quarter profitable; revenue and profit not
   both shrinking. QoQ growth only counts between adjacent quarters (≤100 days apart) —
   the feed can skip a quarter. When the nightly AI read exists, only `bullish` stocks.
2. Transparent score ranks the survivors → top 15 shortlist.
3. **One Gemini call** picks the best 5 of the shortlist with a ≤35-word reason citing a
   technical and a fundamental number. Symbols not on the shortlist are discarded; every
   figure on the card comes from our data, not the reply.
4. Gemini unavailable → top 5 by score, `source: "rules"`, labelled "Rule-ranked".

First real run: 32 of 126 eligible → PAYTM, EIMCOELECO, ACMESOLAR, SUBEXLTD, NRL.

## Local runs load .env themselves
`jobs/config.py` loads `.env` and `apps/api/.env` via python-dotenv when not in GitHub
Actions (real env vars win). `set -a; source apps/api/.env` failed on the `&` in the
Postgres URL, so local runs silently had no Gemini keys.

## Morning brief (☀️ top of Market Pulse)

`jobs/morning_brief.py` → `out/morning_brief.json` → `GET /morning-brief` → `MorningBriefCard`.

- **Trigger:** `.github/workflows/morning.yml` has no `schedule:` — GitHub's cron has
  started hours late. cron-job.org calls
  `POST /repos/test24257657/swing/actions/workflows/morning.yml/dispatches {"ref":"main"}`
  at 08:15 Asia/Kolkata, Mon–Fri, with a fine-grained token (this repo, Actions R/W only).
  The workflow file must be on `main` for the call to succeed (404 before that).
- **Numbers from sources, AI writes the words:** global cues (S&P, Nasdaq, Dow, Nikkei,
  Hang Seng, Kospi, Brent, gold, USD/INR, US 10Y, DXY) from Yahoo Finance with each bar's
  date; rule-based global tone (avg of 5 index moves, ±0.5%) + crude alert (±2%); NIFTY
  floor pivots (P, R1/R2, S1/S2) and 20/50/200-day from NSE index history; stocks in focus
  from last night's Daily Scan + AI top 5; overnight NSE announcements (since the last
  15:30 close) for those + NIFTY 50, deduplicated; results due today; Tuesday weekly
  expiry; a rule-based checklist led by the market light. One Gemini call writes a
  headline + 3–4 points citing those numbers; if it fails the card shows the numbers only.
- **Shown** only while `for_session` is after the last close in `pulse.json` — once that
  session's nightly run lands, the post-close view takes over.
- **📰 In the news & community** — the open-source [last30days](https://github.com/mvanhorn/last30days-skill)
  engine run headless in the workflow (pinned commit `3cfac0e`, stdlib-only, + `yt-dlp`),
  Reddit + YouTube only, `--subreddits IndianStockMarket,IndianStreetBets,DalalStreetTalks,IndiaInvestments`,
  `--days 3 --quick --no-browser-cookies`, ~30–60 s. `filter_community` then drops
  "prediction"/"tomorrow" content, promo/referral links, self-promotion, off-topic
  questions, titles under 4 words, non-https / non-YouTube/Reddit URLs, < 5k-view videos
  and low-engagement threads; top 5 kept, each with link + engagement. On the first real
  run it kept 4 of 11 (Fed-hike explainer, daily market update, a Saurabh Mukherjea
  interview, a 675-upvote r/IndianStockMarket thread) and dropped both "Big Prediction"
  videos. Titles go to Gemini marked untrusted, citable only as "reported by <source>".
  Any engine failure = no strip.
- Gemini gets `max_retries=3` here (~35 s of backoff): on 18-Sep a run of 503s took the
  default 6 retries to 7.5 minutes; the brief must land before 9:15 and still has every
  number without the AI paragraph.
- GIFT Nifty not shown: no free source verified; `^NSEI` on Yahoo is the cash index.
- Tests: `jobs/tests/test_morning_brief.py` (pivots, tone, session roll-over, checklist).

## Telegram alerts (evening + morning)

`jobs/telegram.py` sends; `jobs/notify.py` builds the text (pure, tested). Both pushes
are opt-in: without `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` nothing is sent and the
jobs are unchanged. `SITE_URL` (repo variable) only adds a link back to the dashboard.

- **Evening** — last step of the nightly run: today's *confirmed* breakouts (matched on
  `breakout_date == business_date`, so yesterday's never resurface), sorted by volume
  ratio, with pivot/stop/RS; the top 5 "ready tomorrow" names with their pivot and gap;
  any watchlist alert that tripped (`alerts.evaluate` now returns `hits`); all under the
  market light, with an explicit warning when the light is red. Returns `None` — and
  sends nothing — when there is nothing to report.
- **Morning** — end of `jobs/morning_brief.py`: AI headline + points, global cues row,
  NIFTY R1/pivot/S1, stocks in focus, events, the first 3 checklist items.
- HTML parse mode with `&`, `<`, `>` escaped (symbols like `M&M` would otherwise break
  the message), split on blank lines at 4,000 chars so a stock is never cut in half.
- Verified end to end against the real bot on 20 Sep: both messages delivered.

## Nightly schedule
One run: `cron: "30 12 * * 1-5"` = 6:00 PM IST, Mon–Fri (was three off-peak tries). The
"already built today" guard stays, so a later manual run — or a cron-job.org trigger on
`workflow_dispatch`, exactly as the morning brief works — fills in a day GitHub starts
late or skips, without redoing NSE fetches or Gemini calls.
