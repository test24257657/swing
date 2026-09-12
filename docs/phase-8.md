# Phase 8 — Institutional & F&O

Status: **built, verified end-to-end with real data**, with two items shipped as
best-effort / reduced-scope by explicit agreement before building (see the two
callouts below) — everything else confirmed against live NSE responses (bulk/block
deals, participant OI, F&O bhavcopy, option chain, and a real historical XBRL filing).

## Done

### Item 40 — Bulk & block deals
`jobs/sources.py::bulk_deals()` / `block_deals()` — NSE's daily static archive CSVs
(`nsearchives.../content/equities/bulk.csv` / `block.csv`), no cookie dance needed.
`jobs/institutional.py` accumulates each day's deals into a small rolling parquet
store (`data/deals_history.parquet`, same pattern as `jobs/panel.py`) and flags a deal
as repeat-accumulation when the same client+symbol pair appears earlier in the last
30 sessions.

### Item 41 — Participant-wise OI + FII derivatives stats
`jobs/sources.py::participant_oi()` — another daily static CSV
(`fao_participant_oi_DDMMYYYY.csv`), FII/DII/Pro/Client broken out by Future/Option ×
Index/Stock × Long/Short. The FII index-futures long/short ratio (the "FII
derivatives statistics" design asked for) is just that same file's FII row — no
separate source needed. `jobs/institutional.py` fetches the last 30 sessions for the
trend line and computes each category's share of long OI per instrument type
(Index Futures / Stock Futures / Index Options / Stock Options).

Both land in one artifact, `institutional.json`, served via `GET /institutional`, and
one screen (`/institutional`): summary cards, a filterable deals table with a repeat
badge, participant-share bars, and the FII ratio line.

### Item 43 — F&O buildup card
`jobs/fno.py` — near-month stock-futures contract per underlying (from
`jobs/sources.py::fno_bhavcopy()`, wrapping `nselib.derivatives.fno_bhav_copy`),
classified into long buildup / short buildup / short covering / long unwinding /
neutral from the sign of price change × OI change (`FNO_BUILDUP_FLAT_PCT` in
`jobs/config.py` is the "roughly flat" deadband on both axes).

### Item 44 — Option chain + OI levels
`jobs/sources.py::option_chain()` — NSE's `option-chain-v3` endpoint, which needs a
real current expiry (`fno_expiries()`) or it silently returns `{}` instead of
erroring. `jobs/fno.py` trims the chain to a window around the ATM strike
(`OPTION_CHAIN_STRIKES_EACH_SIDE`), computes PCR, and labels the max-call/max-put-OI
strikes as the mechanical support/resistance read. Both buildup and the chain live in
one per-symbol artifact, `fno/{slug}.json`, only written for F&O-eligible symbols
(~210 of them) that are also in the existing chart universe.

**Deferred from the original design:** the max-OI strikes are shown as text
(`OI resistance ... · OI support ...`) on the Option Chain card, not drawn as dotted
lines directly on the price chart — that would mean threading a second kind of
level (independent of the pattern engine's pivot/stop/target lines) through
`PriceChart`'s existing line-drawing code, which felt like more risk to an
already-working, everywhere-used component than this phase's time budget justified.

### Item 45 — Filing verification
`jobs/filing_verify.py` — compares yfinance's quarterly Revenue / Net Profit / Basic
EPS against the same figures parsed out of the official NSE filing's XBRL attachment
(`jobs/sources.py::financial_results()` for the filing list + `xbrl_financials()` for
the parse). Verified against a real filing (RELIANCE, Dec-2024 quarter): revenue,
net profit and EPS all matched exactly. Scoped down from the original ask by explicit
agreement before building — only these three figures, which have a taxonomy tag
(`in-bse-fin:RevenueFromOperations` / `ProfitLossForPeriod` /
`BasicEarningsLossPerShareFromContinuingAndDiscontinuedOperations`) confirmed stable
on the one filing inspected; a divergence only flags past `FILING_VERIFY_TOLERANCE_PCT`
(2%), and any symbol whose filing doesn't parse cleanly — or whose quarter doesn't have
a matching NSE filing yet — ships with `verification: null` rather than a guess.
Wired into `jobs/fundamentals.py::build()`, so it rides the same per-symbol artifact
(`fundamentals/{slug}.json`) rather than a new one.

## Shipped best-effort (by explicit agreement before building)

### Item 42 — Market depth / buy-sell strength
`jobs/sources.py::market_depth()` calls NSE's `quote-equity` endpoint. Every other
endpoint in this codebase works with the same simple cookie-dance pattern
(`fii_dii`, `announcements`, `option-chain-v3`, the static archive CSVs) — this one
came back a hard Akamai 403 in every attempt while building this phase, not the
usual bot-check page. It's wrapped in the standard `safe()` degrade like everything
else: if GitHub Actions' IPs are blocked the same way, `depth/{slug}.json` simply
never gets written and `MarketDepthCard` doesn't render — the chart page is unaffected
either way. Worth re-checking once a nightly run has actually executed in CI.

## Not done / deferred

| Item | Note |
|---|---|
| OI levels drawn on the price chart | shipped as text on the Option Chain card instead — see item 44 |
| Filing verification beyond 3 figures | scoped down before building, by agreement — see item 45 |
| Market depth reliability | best-effort — see the callout above |

## Action item for the user

The nightly job's GitHub Actions timeout was bumped from 45 to 75 minutes
(`.github/workflows/nightly.yml`) — this phase added per-symbol option-chain and
financial-results fetches, each its own NSE round trip. Worth watching the first few
real runs to confirm 75 is comfortable, not just enough.
