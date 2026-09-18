"""Every threshold in the pipeline lives here. Never inline a number in logic."""

from __future__ import annotations

import os
from pathlib import Path

# --- paths -------------------------------------------------------------------
ROOT = Path(__file__).resolve().parent.parent

# Local runs read keys from the gitignored .env files, so `python -m jobs.run_nightly`
# works without shell `source` (which breaks on the `&` in a Postgres URL). CI never
# needs this — GitHub Actions injects secrets as real env vars, and those always win
# (override=False). python-dotenv is optional: absent, nothing is loaded.
if not os.environ.get("GITHUB_ACTIONS"):
    try:
        from dotenv import load_dotenv

        for _env in (ROOT / ".env", ROOT / "apps" / "api" / ".env"):
            if _env.exists():
                load_dotenv(_env, override=False)
    except ImportError:
        pass
DATA_DIR = Path(os.environ.get("DATA_DIR", ROOT / "data"))
# out/*.json is production data — the nightly GitHub Action commits it and Render
# serves it straight from the repo. GitHub Actions sets GITHUB_ACTIONS=true itself, so
# only a real CI run defaults there; a bare local `python -m jobs.run_nightly` writes
# to gitignored data/out instead and can never dirty git by accident.
_DEFAULT_OUT = ROOT / "out" if os.environ.get("GITHUB_ACTIONS") else ROOT / "data" / "out"
OUT_DIR = Path(os.environ.get("OUT_DIR", _DEFAULT_OUT))
RAW_CACHE_DIR = Path(os.environ.get("RAW_CACHE_DIR", DATA_DIR / "raw_cache"))
PANEL_PATH = DATA_DIR / "panel.parquet"

# --- universe ----------------------------------------------------------------
# Whole market. Breadth ("1,382 advancing of 2,478 traded") is only meaningful across
# every listed equity, and the panel is a file — there is no database row budget to
# protect. Set UNIVERSE_INDEX to an index symbol to narrow it if the panel ever gets
# unwieldy.
UNIVERSE_INDEX: str | None = None
PANEL_DAYS = 252  # one year of trading sessions kept in the rolling panel

# --- the four Pulse tiles ----------------------------------------------------
TILE_INDICES = ["NIFTY 50", "NIFTY BANK", "NIFTY 500", "INDIA VIX"]
SPARKLINE_DAYS = 30

# --- breadth -----------------------------------------------------------------
BREADTH_DMA_FAST = 50
BREADTH_DMA_SLOW = 200

# --- movers ------------------------------------------------------------------
MOVERS_ROWS = 10
BREAKOUT_VOL_MULT = 1.5  # today's volume vs its 20-day average
BREAKOUT_VOL_WINDOW = 20
HIGH_52W_WINDOW = 252

# --- volatility --------------------------------------------------------------
VIX_PERCENTILE_DAYS = 250
VIX_BANDS = {"low": 13.0, "moderate": 18.0, "elevated": 24.0}
VIX_VERDICTS = {
    "low": (
        "Calm market",
        "Prices are moving steadily, without big swings. A normal, comfortable time to hold positions.",
    ),
    "moderate": (
        "Normal market",
        "Typical day-to-day ups and downs. Nothing unusual — trade as you normally would.",
    ),
    "elevated": (
        "Choppy market",
        "Prices swinging more than usual. Consider smaller trade sizes — moves can reverse quickly.",
    ),
    "high": (
        "Risky market",
        "Big, unpredictable price swings. Be extra careful — many traders wait for calmer days before entering new trades.",
    ),
}

# --- flows -------------------------------------------------------------------
FLOW_SESSIONS = 10

# --- sector rotation -----------------------------------------------------------
# NSE's official sector indices — see jobs/sources.py::NIFTY_CSV for the verified
# constituent-list filename behind each one.
SECTOR_INDICES = [
    "NIFTY AUTO", "NIFTY IT", "NIFTY PHARMA", "NIFTY FMCG", "NIFTY METAL",
    "NIFTY REALTY", "NIFTY ENERGY", "NIFTY PSU BANK", "NIFTY PRIVATE BANK",
    "NIFTY MEDIA", "NIFTY CONSUMER DURABLES", "NIFTY HEALTHCARE INDEX",
]
# "NIFTY OIL & GAS" was tried and dropped — nselib's index_data doesn't resolve that
# exact name (returns nothing at any range), not a transient failure.
SECTOR_BENCHMARK = "NIFTY 500"
SECTOR_HISTORY_DAYS = 300  # enough for 3m return + the RRG's 10-week lookback
SECTOR_RETURN_1W_SESSIONS = 5
SECTOR_RETURN_1M_SESSIONS = 21
SECTOR_RETURN_3M_SESSIONS = 63
SECTOR_RANK_DELTA_SESSIONS = 15  # ~3 weeks, "rank vs 3 weeks ago"
# Relative Rotation Graph — simplified vs the classic JdK RS-Ratio/Momentum (no
# double-smoothing): X = 30-session relative-performance ratio vs the benchmark,
# rebased to 100; Y = that ratio's 10-week rate of change. Tail = last 6 weekly points.
RRG_RS_WINDOW_SESSIONS = 30
RRG_MOMENTUM_SESSIONS = 50  # ~10 weeks
RRG_TAIL_POINTS = 6
RRG_TAIL_STEP_SESSIONS = 5  # one point per week

# --- news --------------------------------------------------------------------
NEWS_LOOKBACK_DAYS = 3
# Scheduling/procedural filings that are never a swing-trading signal — everything
# else from the NSE feed gets kept. An allowlist would be shorter but brittler: NSE's
# own category list changes, and a new category defaulting to "kept" degrades to noise
# in the feed rather than silently dropping something that might matter.
NEWS_EXCLUDE_CATEGORIES = {
    "Analysts/Institutional Investor Meet/Con. Call Updates",
    "General Updates",
    "Shareholders meeting",
    "Copy of Newspaper Publication",
    "Updates",
    "Investor Presentation",
    "Trading Window",
    "Certificate under SEBI (Depositories and Participants) Regulations, 2018",
    "Corrigendum",
    "Press Release",
}
NEWS_HEADLINE_MAX_CHARS = 280
GEMINI_MODEL = "gemini-3.6-flash"
GEMINI_BATCH_SIZE = 20  # announcements per classification request
# Assumed free-tier Flash caps (https://ai.google.dev/gemini-api/docs/rate-limits) —
# re-check if real throttling behavior suggests these are off. A cache hit never
# counts against this pace, only a real network call does.
GEMINI_MIN_INTERVAL_SECONDS = 6.5  # ~9 RPM — real testing hit 429s at ~13 RPM, so paced
# more conservatively than the assumed 15 RPM cap.
GEMINI_MAX_RETRIES = 6  # on HTTP 429, honouring Retry-After when the server sends one

# --- AI stock narrative (per-symbol, nightly, whole traded market) --------------
AI_INSIGHT_BATCH_SIZE = 15  # symbols per Gemini request — richer per-item context
# than news, so a smaller batch than GEMINI_BATCH_SIZE keeps prompts a sane size.
AI_INSIGHT_MIN_ROWS = 20  # same floor as jobs/charts.py::technicals() — too little
# history for RSI/ATR to mean anything.

# --- weekly AI outlook (mem0-backed cross-week memory) --------------------------
# Fixed identity for the AI's own memory scope — not a real user, just the bucket
# its weekly market calls (and their outcomes) accumulate under in mem0.
MEM0_OUTLOOK_USER_ID = "swing-terminal-weekly-outlook"
WEEKLY_OUTLOOK_WEEKDAY = 4  # Friday (0=Mon) — one call a week, after the week's close

# --- results calendar (nightly) --------------------------------------------------
RESULTS_CALENDAR_PAST_DAYS = 30
RESULTS_CALENDAR_FUTURE_DAYS = 30
RESULTS_CALENDAR_BATCH_SIZE = 20  # already-filed results judged per Gemini request

# --- indices screen ------------------------------------------------------------
# Broad-market indices shown alongside the sector indices above (sectors are their
# own category there). Constituents drawer only works for indices with a
# jobs.sources.NIFTY_CSV entry — the rest (Next 50, mid/smallcap) show list + chart only.
BROAD_INDICES = [
    "NIFTY 50", "NIFTY NEXT 50", "NIFTY 100", "NIFTY 200", "NIFTY 500",
    "NIFTY MIDCAP 100", "NIFTY MIDCAP 150", "NIFTY SMALLCAP 100", "NIFTY SMALLCAP 250",
    "NIFTY BANK", "INDIA VIX",
]

# --- institutional activity (bulk/block deals, participant OI) -----------------
DEALS_MIN_VALUE_CR = 0  # NSE's own reporting threshold already filters this; no extra cut
DEALS_REPEAT_WINDOW_SESSIONS = 30
PARTICIPANT_OI_HISTORY_DAYS = 30  # FII long/short ratio trend line
MONEY_FLOW_MAX_DEALS = 30  # today's largest deals fed to the AI money-flow pick, one Gemini call/night

# --- F&O (buildup, option chain, depth) -----------------------------------------
# Price/OI change thresholds below this are "flat", not a buildup signal either way.
FNO_BUILDUP_FLAT_PCT = 0.5
OPTION_CHAIN_STRIKES_EACH_SIDE = 10  # rows shown either side of the ATM strike

# --- filing verification ---------------------------------------------------------
# yfinance vs the official NSE XBRL filing, on these three figures only — the ones
# with a taxonomy tag confirmed stable across filings. A wrong divergence flag is
# worse than no flag, so anything that doesn't parse cleanly ships as "not available".
FILING_VERIFY_TOLERANCE_PCT = 2.0

# --- market session (IST) ----------------------------------------------------
PRE_OPEN = "09:00"
MARKET_OPEN = "09:15"
MARKET_CLOSE = "15:30"

# --- fetching ----------------------------------------------------------------
HTTP_TIMEOUT = 25
BACKFILL_DAYS = int(os.environ.get("BACKFILL_DAYS", "260"))
SERIES_KEPT = {"EQ", "BE", "BZ"}

# --- daily scan (jobs/daily_scan.py) --------------------------------------------
# Relative Strength rating, IBD-style: weighted 3/6/9/12-month returns, the latest
# quarter counted double, then percentile-ranked 1-99 across the whole market.
RS_WEIGHTS = ((63, 0.4), (126, 0.2), (189, 0.2), (251, 0.2))  # (sessions back, weight)
RS_MIN_SESSIONS = 126  # need at least ~6 months of history to be rated at all
RS_LEADER_MIN = 80  # the zone most big winners sit in before their move
SCAN_MIN_TURNOVER_CR = 1.0  # 20-day median daily traded value — below this is untradeable
SCAN_ROWS = 15
# "Ready today": trend template + RS leader + a forming setup coiled just under its pivot.
READY_MAX_BELOW_PIVOT_PCT = 3.0
# Delivery spike: real buyers taking delivery, not intraday churn.
DELIVERY_SPIKE_MULT = 1.5  # today's delivery % vs its own 20-day average
DELIVERY_SPIKE_MIN_PCT = 40.0
DELIVERY_SPIKE_MIN_GAIN_PCT = 1.0
DELIVERY_SPIKE_MIN_VOL_MULT = 1.5
# Pocket pivot (Morales/Kacher): an up day whose volume beats every down day of the
# last 10 sessions, in an uptrend, not already stretched off the 10-day average.
POCKET_PIVOT_LOOKBACK = 10
POCKET_PIVOT_MAX_ABOVE_SMA10_PCT = 5.0
# Volume dry-up: sellers exhausted — 5-day average volume vs the 50-day.
DRY_UP_MAX_RATIO = 0.6
# Market regime (O'Neil distribution days, measured on NIFTY 50).
DISTRIBUTION_DAY_MIN_DROP_PCT = 0.2
DISTRIBUTION_WINDOW = 25
DISTRIBUTION_CAUTION = 5  # 5+ in 25 sessions = institutions are selling into strength
REGIME_BREADTH_OK = 50.0  # % of stocks above their 50-day average
REGIME_BREADTH_WEAK = 30.0
SECTOR_LEADER_SECTORS = 3
SECTOR_LEADERS_PER_SECTOR = 3
