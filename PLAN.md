# PLAN.md — Indian Swing-to-Momentum Trading Terminal (v2)

## 0. Project Vision & Architectural Guardrails (CRITICAL FOR AI AGENT)
This project is a clean-slate **v2 rebuild** of an Indian (NSE + BSE) Swing-to-Momentum Trading Terminal. 
The AI coding agent MUST strictly enforce the following **6 System Design Rules**:

1. **NO Dual Backends & NO Git-Committed JSON Data:** 
   - Do NOT build a FastAPI server. Do NOT commit `out/*.json` data files to the Git repository.
   - **Compute Layer:** Python scripts (`pipeline/`) executed via scheduled **GitHub Actions** (7:00 PM IST EOD + 8:30 AM IST Morning Brief).
   - **Web & API Layer:** **Next.js 15 (App Router, TypeScript)** hosted on **Vercel**, reading/writing directly to **Neon Serverless PostgreSQL** via **Prisma ORM**.
2. **Neon DB 500 MB Free-Tier Hard Cap (Target < 65 MB):**
   - NEVER store multi-year raw daily OHLCV candles inside Neon PostgreSQL.
   - Store the rolling 2-year daily OHLCV history (~1,700 stocks × 500 days) in a single compressed **Parquet file (`ohlcv_2y.parquet`, ~20 MB)** hosted as a **GitHub Release Asset** under tag `latest-data`.
   - Store ONLY the **latest state** (1 row per stock for technicals & fundamentals) and **rolling time-bounded signals** (90-day patterns, 30-day AI cache, 90-day bulk deals) in Neon DB.
3. **Strict Equity Universe Hygiene (Zero ETF Pollution):**
   - Only include active **NSE `EQ` / `BE`** equities and **BSE-Exclusive Group `A` / `B`** equities (deduplicated via `ISIN`, where NSE always takes priority).
   - Hard-exclude all Liquid ETFs, Gold/Silver BeES, Index ETFs, Gilt funds, REITs/InvITs, stocks with Close < ₹30, and stocks with 20-day Median Turnover < ₹3 Crore (₹2 Crore for BSE-exclusive).
4. **Resilient Data Fetching (Zero Pipeline Failures):**
   - NSE/BSE endpoints block standard cloud IPs. Always use `curl_cffi` (browser TLS impersonation with session cookie warmup) as Primary, and **TradingView Scanner API (`tradingview-screener`) / `yfinance` bulk** as automatic Fallback.
5. **Mindful Gemini AI Usage (2 Scheduled Calls/Day + 7-Day Cache):**
   - Never run LLM calls across hundreds of stocks. Filter down to the **Top 15 Techno-Funda setups** in Python first, then send **1 batched JSON prompt** to `gemini-2.5-flash` at night and **1 prompt** at 8:30 AM for the Morning Brief.
   - On-demand stock AI analysis on the UI MUST be cached in Neon DB for **7 days** (unless invalidated by a new quarterly result or major exchange filing).
6. **Single-User Personal Terminal:**
   - No multi-user signup flows. Protect the dashboard and mutation API routes using a single `.env` `ADMIN_PASSWORD` + `jose` HTTP-only JWT cookie, with personal alerts sent to a single Telegram chat.

---

## 1. Monorepo Directory Structure

```text
swing-v2/
├── .github/
│   └── workflows/
│       ├── eod_pipeline.yml          # Runs Mon-Fri @ 7:00 PM IST (13:30 UTC)
│       ├── morning_brief.yml         # Runs Mon-Fri @ 8:30 AM IST (03:00 UTC)
│       └── weekly_fundamentals.yml   # Runs Sunday @ 10:00 AM IST
├── pipeline/                         # Python EOD, Fundamental & AI Engine
│   ├── requirements.txt              # polars, duckdb, curl_cffi, psycopg[binary], google-genai, etc.
│   ├── config.py                     # Env vars, thresholds, universe rules, sector mappings
│   ├── db.py                         # psycopg3 / SQLAlchemy batch upsert & pruning helpers for Neon DB
│   ├── storage.py                    # GitHub Release Asset downloader/uploader for ohlcv_2y.parquet
│   ├── sources/
│   │   ├── nse_bse_bhavcopy.py       # NSE sec_bhavdata_full + BSE UDiFF + TV Scanner fallback
│   │   ├── indices_sectors.py        # NiftyIndices constituent CSVs + ind_close_all CSV
│   │   ├── corporate_actions.py      # NSE splits/bonus factor detector + Parquet back-adjuster
│   │   ├── institutional_deals.py    # NSE/BSE Bulk Deals, Block Deals, SAST Insider buying + FII/DII
│   │   ├── screener_fundamentals.py  # Screener.in scraper + TV Scanner fallback for QoQ/RoCE/FII-DII
│   │   └── nse_announcements.py      # NSE Corporate Filings RSS (Order wins, earnings, capex)
│   ├── compute/
│   │   ├── universe.py               # ISIN deduplication + ETF/Liquidity hygiene filter
│   │   ├── indicators.py             # Polars/DuckDB: EMA, SMA, RSI, ATR, ADR%, RVOL, RS Rating, Stage
│   │   ├── breadth_rrg.py            # Market Breadth, Regime detector, RRG Sector Rotation (18 sectors)
│   │   ├── patterns.py               # VCP, 52W High Breakout, Pocket Pivot, 21EMA Pullback, IPO Base
│   │   └── scoring.py                # 100-Point Techno-Funda Composite Scoring Engine
│   ├── ai/
│   │   ├── gemini_client.py          # google-genai SDK wrapper with structured JSON schema & budget guard
│   │   ├── nightly_top_picks.py      # Batches Top 15 setups -> Ranks Top 5 Swing Picks with Thesis
│   │   └── morning_brief_job.py      # Generates 8:30 AM Market Regime + Sector + Action Plan
│   ├── notify/
│   │   └── telegram.py               # Sends formatted Markdown tables & alerts to personal Telegram
│   ├── run_seed.py                   # 1-Time Day-1 Historical Backfill (2Y OHLCV + Symbols + Fundamentals)
│   ├── run_nightly.py                # Master 7:00 PM IST orchestrator
│   ├── run_morning.py                # Master 8:30 AM IST orchestrator
│   └── run_weekly_funda.py           # Master Sunday Fundamental & Constituent sync
├── prisma/
│   └── schema.prisma                 # Complete Neon PostgreSQL Schema (< 65 MB footprint)
├── src/                              # Next.js 15 App Router Frontend & Serverless API
│   ├── app/
│   │   ├── login/page.tsx            # Single-password personal terminal login
│   │   ├── (terminal)/
│   │   │   ├── layout.tsx            # Terminal Shell (Sidebar, Command K Search, Market Regime Pill)
│   │   │   ├── page.tsx              # Morning Brief + Top 5 AI Swing Picks + Market Pulse
│   │   │   ├── scan/page.tsx         # Daily Pattern Signals (VCP, Pocket Pivot, 52W High, Pullback, IPO)
│   │   │   ├── screener/page.tsx     # Custom Multi-Filter Techno-Funda Screener + Mini Sparklines
│   │   │   ├── sectors/page.tsx      # Interactive RRG Sector Rotation Scatter + Constituent Leaders
│   │   │   ├── institutional/page.tsx# FII/DII Flows + Bulk/Block Deals + Promoter Insider Buying
│   │   │   ├── stock/[symbol]/page.tsx # TradingView Advanced Widget + Techno-Funda Card + Cached AI Thesis
│   │   │   └── watchlist/page.tsx    # Personal Watchlist, Active Swing Positions & Risk Calculator
│   │   └── api/
│   │       ├── auth/route.ts         # JWT cookie login/logout
│   │       ├── quotes/live/route.ts  # Proxies 1-request TradingView Scanner API for live intraday quotes
│   │       ├── ai/thesis/[symbol]/route.ts # Serves 7-day cached AI thesis or triggers 1 Gemini call
│   │       └── watchlist/route.ts    # CRUD for personal watchlist & trade tracking
│   ├── components/
│   │   ├── tv-advanced-chart.tsx     # Embedded TradingView Advanced Chart Widget (NSE:SYMBOL / BSE:CODE)
│   │   ├── rrg-canvas.tsx            # 4-Quadrant Relative Rotation Graph (Leading/Weakening/Lagging/Improving)
│   │   ├── sparkline-svg.tsx         # Zero-dependency SVG sparkline rendered from 60d float array
│   │   └── ...
│   └── lib/
│       ├── prisma.ts                 # Singleton Prisma Client with Neon Serverless Pooler
│       ├── tv-scanner.ts             # TradingView Scanner bulk POST helper
│       └── auth.ts                   # Middleware JWT verifier
├── .env.example
├── package.json
└── PLAN.md
```

---

## 2. Database Schema (`prisma/schema.prisma`) — Under 65 MB Design

Design the Prisma schema with these exact **8 models** and nightly pruning rules:

### Model 1: `Symbol` (~1.5 MB — ~1,700 rows)
* `symbol`: `String @id` (NSE symbol e.g., `"RELIANCE"`, or BSE ticker if BSE-only)
* `bseCode`: `String?` (e.g., `"500325"`)
* `isin`: `String @unique` (Used to deduplicate NSE vs BSE)
* `companyName`: `String`
* `exchange`: `String` (`"NSE"` | `"BSE"`)
* `series`: `String` (`"EQ"`, `"BE"`, `"A"`, `"B"`)
* `sector`: `String` (Normalized to 18 core sectors)
* `industry`: `String`
* `indices`: `String[]` (e.g., `["NIFTY 500", "NIFTY AUTO"]`)
* `marketCapCr`: `Float?`
* `listingDate`: `DateTime?`
* `isFno`: `Boolean @default(false)`
* `isActive`: `Boolean @default(true)`
* `updatedAt`: `DateTime @updatedAt`

### Model 2: `LatestTechnical` (~4 MB — 1 row per stock, OVERWRITTEN nightly)
* `symbol`: `String @id` (FK to `Symbol.symbol`)
* `tradeDate`: `DateTime`
* `open`: `Float`, `high`: `Float`, `low`: `Float`, `close`: `Float`
* `changePct`: `Float`
* `volume`: `BigInt`
* `turnoverCr`: `Float`
* `rvol20d`: `Float` (Today's volume / 20-day SMA volume)
* `deliveryPct`: `Float` (Official NSE/BSE delivery percentage)
* `deliverySpike`: `Float` (Today's delivery % / 20-day average delivery %)
* `ema10`: `Float`, `ema21`: `Float`, `sma50`: `Float`, `sma150`: `Float`, `sma200`: `Float`
* `rsi14`: `Float`
* `atr14`: `Float`
* `adrPct20d`: `Float` (20-day Average Daily Range % — measures swing speed)
* `high52w`: `Float`, `low52w`: `Float`
* `distFrom52wHighPct`: `Float`
* `rsRating`: `Int` (1 to 99 percentile weighted 3M/6M/9M/12M relative performance)
* `mansfieldRs`: `Float?` (Relative strength vs Nifty 500 zero-line)
* `weinsteinStage`: `String` (`"1"`, `"2A"`, `"2B"`, `"3"`, `"4"`)
* `minerviniPass`: `Boolean` (Passes all 8 Mark Minervini Trend Template rules)
* `upDownVolRatio`: `Float?` (50-day Up-Volume / Down-Volume ratio)
* `pocketPivotToday`: `Boolean`
* `vcpContractions`: `Int` (0 if none, 2–4 if valid VCP tightness)
* `baseTightnessPct`: `Float?` (10-day high-low range %)
* `sparkline60d`: `Float[]` (Array of last 60 closing prices, rounded to 2 decimals)
* `technoFundaScore`: `Int` (0 to 100 composite score)

### Model 3: `Fundamental` (~3 MB — 1 row per stock, updated weekly)
* `symbol`: `String @id` (FK to `Symbol.symbol`)
* `pe`: `Float?`, `industryPe`: `Float?`, `pb`: `Float?`
* `roce`: `Float?`, `roe`: `Float?`
* `debtToEquity`: `Float?`
* `opmPct`: `Float?`, `opmChangeYoY`: `Float?`
* `salesGrowthQoQ`: `Float?`, `salesGrowthYoY`: `Float?`
* `epsGrowthQoQ`: `Float?`, `epsGrowthYoY`: `Float?`
* `promoterPct`: `Float?`, `promoterChangeQoQ`: `Float?`, `promoterPledgePct`: `Float?`
* `fiiPct`: `Float?`, `fiiChangeQoQ`: `Float?`
* `diiPct`: `Float?`, `diiChangeQoQ`: `Float?`
* `institutionalBoughtRecently`: `Boolean @default(false)` (True if Bulk/Block/Insider buy in last 30d)
* `nextResultsDate`: `DateTime?`
* `fundamentalScore`: `Int` (0 to 40 points)
* `updatedAt`: `DateTime @updatedAt`

### Model 4: `PatternSignal` (~8 MB — 90-Day Rolling Retention)
* `id`: `String @id @default(cuid())`
* `symbol`: `String` (Indexed)
* `tradeDate`: `DateTime` (Indexed)
* `setupType`: `String` (`"VCP"`, `"52W_BREAKOUT"`, `"POCKET_PIVOT"`, `"PULLBACK_21EMA"`, `"IPO_BASE"`, `"STAGE_2A_BREAKOUT"`)
* `pivotPrice`: `Float`
* `stopLossPrice`: `Float`
* `riskPct`: `Float`
* `target1Price`: `Float` (2R), `target2Price`: `Float` (3.5R)
* `technoFundaScore`: `Int`
* `rsRating`: `Int`
* `rvol`: `Float`
* `deliveryPct`: `Float`
* `catalystSummary`: `String?` (Recent bulk deal or corporate filing headline)
* `status`: `String` (`"READY"`, `"TRIGGERED"`, `"EXTENDED"`, `"INVALIDATED"`)
* `@@unique([symbol, tradeDate, setupType])`

### Model 5: `MarketBreadthAndSector` (~5 MB — 365-Day Rolling Retention)
* `tradeDate`: `DateTime @id`
* `nifty50Close`: `Float`, `nifty50ChangePct`: `Float`
* `nifty500Close`: `Float`, `nifty500ChangePct`: `Float`
* `indiaVix`: `Float`
* `advances`: `Int`, `declines`: `Int`
* `pctAbove20Ema`: `Float`, `pctAbove50Sma`: `Float`, `pctAbove200Sma`: `Float`
* `new52wHighs`: `Int`, `new52wLows`: `Int`
* `netHighLow`: `Int`
* `fiiNetCr`: `Float?`, `diiNetCr`: `Float?`
* `marketRegime`: `String` (`"CONFIRMED_UPTREND"`, `"UPTREND_UNDER_PRESSURE"`, `"PULLBACK_SWING"`, `"CORRECTION_CASH"`)
* `sectorRrgJson`: `Json` (Array of 18 sectors with `rsRatio`, `rsMomentum`, `quadrant`, `tail5d`, `topLeaders[]`)

### Model 6: `InstitutionalActivity` (~4 MB — 90-Day Rolling Retention)
* `id`: `String @id @default(cuid())`
* `symbol`: `String` (Indexed)
* `tradeDate`: `DateTime` (Indexed)
* `dealType`: `String` (`"BULK"`, `"BLOCK"`, `"INSIDER_SAST"`, `"CORP_FILING"`)
* `clientOrCategory`: `String` (e.g., `"MITSUI SUMITOMO"`, `"PROMOTER"`, `"ORDER_WIN"`)
* `action`: `String` (`"BUY"`, `"SELL"`, `"CATALYST"`)
* `quantity`: `BigInt?`, `price`: `Float?`, `valueCr`: `Float?`
* `headline`: `String?`

### Model 7: `AiIntelligence` (~5 MB — 30-Day Rolling Retention / 7-Day Stock Cache)
* `id`: `String @id @default(cuid())`
* `cacheKey`: `String @unique` (e.g., `"MORNING_BRIEF_2026-10-20"`, `"TOP_PICKS_2026-10-20"`, or `"STOCK_THESIS_RELIANCE"`)
* `category`: `String` (`"MORNING_BRIEF"`, `"TOP_PICKS"`, `"STOCK_THESIS"`)
* `symbol`: `String?`
* `payload`: `Json` (Structured JSON validated against Zod/Pydantic)
* `modelUsed`: `String`
* `tokensUsed`: `Int`
* `expiresAt`: `DateTime` (Indexed — 7 days for `STOCK_THESIS`, 30 days for briefs)
* `createdAt`: `DateTime @default(now())`

### Model 8: `WatchlistAndPosition` (< 1 MB — Permanent User Data)
* `id`: `String @id @default(cuid())`
* `symbol`: `String` @unique
* `listType`: `String` (`"WATCHLIST"`, `"READY_TRIGGER"`, `"ACTIVE_POSITION"`)
* `triggerPrice`: `Float?`
* `stopLossPrice`: `Float?`
* `entryPrice`: `Float?`
* `quantity`: `Int?`
* `setupTag`: `String?`
* `notes`: `String?`
* `alertSent`: `Boolean @default(false)`
* `createdAt`: `DateTime @default(now())`

---

## 3. Data Sourcing & Resilient Pipeline Specifications

### 3.1 Universe Hygiene & ISIN Deduplication (`pipeline/compute/universe.py`)
1. Download NSE Master Equity List: `https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv`.
2. Download BSE Active Scrip List / UDiFF Bhavcopy.
3. **Deduplication:** Group by `ISIN`. If an `ISIN` exists in NSE (`SERIES in ['EQ', 'BE']`), assign `exchange = 'NSE'`. Only keep BSE rows whose `ISIN` does NOT exist in NSE and belong to `FinInstrmTp == 'STK'` (Groups `A` or `B`).
4. **Hard Exclusions:**
   - Regex filter on `symbol` and `companyName`: Drop any ticker matching `(LIQUID|BEES|ETF|IETF|GILT|GOLD|SILVER|NIFTY|SENSEX|BHARAT22|CPSE|INVIT|REIT|CASE|ADD)`.
   - Liquidity & Price Gate: Keep only stocks where `close >= 30.0` AND `median_20d_turnover_cr >= 3.0` (`>= 2.0` for BSE-only).

### 3.2 Historical Seed & Daily EOD Append
- **Day-1 Backfill (`run_seed.py`):**
  - Fetch 2 years (500 trading days) of adjusted daily OHLCV for the filtered ~1,700 universe using `yfinance` bulk download.
  - Save as compressed Parquet file `ohlcv_2y.parquet` (~18–22 MB) and upload to GitHub Release tag `latest-data`.
- **Daily EOD Fetch (7:00 PM IST):**
  - **Primary NSE:** `https://nsearchives.nseindia.com/products/content/sec_bhavdata_full_{DDMMYYYY}.csv`
  - **Primary BSE:** `https://www.bseindia.com/download/BhavCopy/Equity/BhavCopy_BSE_CM_0_0_0_{YYYYMMDD}_F_0000.CSV`
  - **Fallback:** `curl_cffi` browser TLS impersonation -> TradingView Scanner API.

### 3.3 Quantitative Scoring (100-Point Composite)
- **A. Technical & Relative Strength (35 Points):** RS Rating (1-99), Weinstein Stage (2A/2B), Sector RRG status, ADR% alignment.
- **B. Volume, Delivery & Setup Tightness (25 Points):** VCP contraction tightness, Up/Down Volume Ratio, RVOL, Delivery % spike.
- **C. Fundamentals & Institutional Sponsorship (40 Points):** EPS & Sales QoQ acceleration, ROCE, Debt/Equity, FII/DII accumulation, Bulk/Block deal or Insider buy catalyst (+7 bonus pts).

### 3.4 Gemini AI Layer (Mindful Quota)
- 1 batched nightly JSON prompt for Top 5 Swing Picks (evaluated from Top 15 setups).
- 1 morning prompt at 8:30 AM IST for the Market Regime Brief.
- 7-day Neon DB cache for on-demand stock theses.

---

## 4. Next.js 15 Frontend Terminal Views (`src/app/(terminal)/`)
High-density institutional trading terminal:
1. `/` (Command Center Dashboard)
2. `/scan` (Daily Setup Scanner: VCP, 52W Breakout, Pocket Pivot, 21EMA Pullback, IPO Base, Stage 2A)
3. `/screener` (Custom Multi-Factor Screener with mini sparklines)
4. `/sectors` (Interactive 4-Quadrant RRG Sector Rotation Canvas)
5. `/institutional` (Smart Money & Catalysts: Bulk/Block Deals, SAST, Order Wins)
6. `/stock/[symbol]` (Deep-Dive Workbench: TradingView Chart + Techno-Funda card + Cached AI thesis)
7. `/watchlist` (Watchlist, Active Swing Positions & Risk Calculator)
8. `/login` (Single password personal terminal login)
