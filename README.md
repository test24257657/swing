# 📈 Swing Terminal v2 — Indian Swing-to-Momentum Trading Platform

A high-density, zero-cost institutional trading terminal built for **NSE & BSE Swing-to-Momentum Trading**. Swing Terminal v2 scans ~1,700 liquid Indian equities daily for **Mark Minervini Trend Template (Stage 2)** setups, **Volatility Contraction Patterns (VCP)**, **Pocket Pivots**, **52-Week High Breakouts**, **21 EMA Pullbacks**, and **IPO Bases**—combining **Screener.in** fundamentals, **NSE Bulk/Block Deals**, **Relative Rotation Graphs (RRG)**, and **Gemini 2.5 Flash** AI ranking into a single unified terminal.

---

## ✨ Key Highlights

* **🧹 Strict Equity Universe Hygiene:** Automatically ingests NSE (`EQ`/`BE`) and BSE-Exclusive (`A`/`B`) stocks deduplicated by `ISIN`, while hard-filtering out all Liquid ETFs (`LIQUIDBEES`, etc.), Gold/Silver BeES, Gilt funds, penny stocks (< ₹30), and illiquid counters (< ₹3 Cr median turnover).
* **⚡ Hybrid Storage Architecture (< 65 MB Neon DB Footprint):**
  * **Cold Storage:** 2-year split-adjusted daily OHLCV (~20 MB) stored and appended on GitHub Releases (`latest-data/ohlcv_2y.parquet`).
  * **Hot Storage:** Neon Serverless PostgreSQL managed via **Prisma ORM** across 8 lean models with automatic rolling retention policies.
* **📊 100-Point Techno-Funda Composite Score:**
  * **Pillar A (35 pts):** Relative Strength (3M, 6M, 9M, 12M percentile), Weinstein Stage 2, ADR%, Sector RRG Quadrant.
  * **Pillar B (25 pts):** Minervini VCP Tightness, Up/Down Volume Ratio, RVOL, Delivery % spikes.
  * **Pillar C (40 pts):** EPS & Revenue QoQ acceleration, ROCE, Debt/Equity, FII accumulation, Promoter Pledge, Bulk/Block smart money.
* **🤖 Mindful AI Integration:** Strictly 2 scheduled Gemini calls per day (7:30 PM Nightly Top 5 Picks + 8:30 AM Morning Market Brief) + 7-day DB cached on-demand stock theses to stay completely within free tier limits.
* **📱 Automated Telegram Alerts:** Evening Top 5 picks + Morning market regime cues delivered directly to your personal Telegram channel.
* **💻 Next.js 15 Unified Web Terminal:** Full-screen high-density trader dashboard with TradingView Advanced Charts, real-time intraday quotes, interactive 4-quadrant RRG canvas, institutional deal flow, and position risk calculators.

---

## 📁 Repository Structure

```
├── .github/workflows/
│   ├── eod_pipeline.yml         # 7:00 PM IST nightly Bhavcopy & scoring
│   └── morning_brief.yml        # 8:30 AM IST global cues & regime brief
├── pipeline/                    # GitHub Actions compute engine
│   ├── ai/                      # Gemini 2.5 Flash integrations
│   ├── compute/                 # Indicators, patterns, RRG & 100-pt scorer
│   ├── notify/                  # Telegram alert dispatchers
│   ├── sources/                 # NSE/BSE Bhavcopy, Bulk deals, Screener.in
│   ├── config.py                # Centralized system constants & thresholds
│   ├── db.py                    # Direct Neon PostgreSQL batch upserts & TTL pruning
│   ├── storage.py               # GitHub Release Parquet read/append/write
│   ├── run_nightly.py           # EOD master orchestrator
│   ├── run_morning.py           # Pre-market morning orchestrator
│   └── run_seed.py              # Day-1 historical backfill script
├── prisma/
│   └── schema.prisma            # 8 lean models (< 65 MB Neon PG)
├── PLAN.md                      # Comprehensive system specification
└── .env.example                 # Environment variables template
```

---

## 🚀 Setup & Execution

### 1. Environment Configuration
Copy `.env.example` to `.env` and provide your database credentials:
```bash
cp .env.example .env
```
Fill in:
- `DATABASE_URL` & `DIRECT_URL` (Neon PostgreSQL)
- `GEMINI_API_KEY` (Google AI Studio)
- `GITHUB_REPO` & `GITHUB_TOKEN` (for parquet cold storage)
- `TELEGRAM_BOT_TOKEN` & `TELEGRAM_CHAT_ID` (optional personal alerts)

### 2. Day-1 Seed (One-time Backfill)
Bootstrap the 2-year history and universe registry:
```bash
pip install -r pipeline/requirements.txt
python -m pipeline.run_seed
```

### 3. Pipeline Runs
- **EOD Scan:** `python -m pipeline.run_nightly` (Scheduled Mon–Fri at 7:00 PM IST)
- **Morning Brief:** `python -m pipeline.run_morning` (Scheduled Mon–Fri at 8:30 AM IST)

---

*Private personal terminal. For educational and quantitative research purposes only.*
