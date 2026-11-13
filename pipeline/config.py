"""
pipeline/config.py — Every threshold in one place.
Never inline a number in logic — always reference a constant from here.
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env from repo root (local dev). Real env vars (GitHub Actions) win.
_root = Path(__file__).parent.parent
load_dotenv(_root / ".env", override=False)

# ─────────────────────────────────────────────────────────────────────────────
# ENVIRONMENT
# ─────────────────────────────────────────────────────────────────────────────
DATABASE_URL: str = os.environ.get("DATABASE_URL", "")
DIRECT_URL: str = os.environ.get("DIRECT_URL", "")
GEMINI_API_KEY: str = os.environ.get("GEMINI_API_KEY", "")
GITHUB_REPO: str = os.environ.get("GITHUB_REPO", "")
GITHUB_TOKEN: str = os.environ.get("GITHUB_TOKEN", "")
TELEGRAM_BOT_TOKEN: str = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID: str = os.environ.get("TELEGRAM_CHAT_ID", "")
ADMIN_PASSWORD: str = os.environ.get("ADMIN_PASSWORD", "")
JWT_SECRET: str = os.environ.get("JWT_SECRET", "")

# ─────────────────────────────────────────────────────────────────────────────
# ANGEL ONE SMARTAPI  (D / W / M historical OHLCV only)
# ─────────────────────────────────────────────────────────────────────────────
ANGEL_API_KEY: str    = os.environ.get("API_KEY", "")
ANGEL_CLIENT_ID: str  = os.environ.get("CLIENT_ID", "")
ANGEL_PIN: str        = os.environ.get("PIN", "")
ANGEL_TOTP_SECRET: str = os.environ.get("TOTP_SECRET", "")

# ─────────────────────────────────────────────────────────────────────────────
# PATHS
# ─────────────────────────────────────────────────────────────────────────────
PIPELINE_DIR = Path(__file__).parent
DATA_DIR = _root / "data"
DATA_DIR.mkdir(exist_ok=True)
CACHE_DIR = DATA_DIR / "raw_cache"
CACHE_DIR.mkdir(exist_ok=True)

# GitHub Release artifact name
PARQUET_ASSET_NAME = "ohlcv_2y.parquet"
PARQUET_RELEASE_TAG = "latest-data"
LOCAL_PARQUET_PATH = DATA_DIR / PARQUET_ASSET_NAME

# ─────────────────────────────────────────────────────────────────────────────
# UNIVERSE HYGIENE
# ─────────────────────────────────────────────────────────────────────────────
MIN_PRICE = 30.0                   # ₹30 minimum close price (penny stock filter)
MIN_TURNOVER_CR = 3.0              # ₹3 Cr minimum median 20-day turnover
ILLIQUID_LOOKBACK_DAYS = 20        # days to compute median turnover for liquidity check

# Keywords in symbol name → excluded from universe (ETFs, BeES, Gilt funds)
EXCLUDE_NAME_KEYWORDS = [
    "ETF", "BEES", "GOLD", "SILVER", "GILT", "LIQUIDBEES",
    "BOND", "NIFTY", "SENSEX", "LIQUID", "BHARAT BOND",
    "CPSE", "NV20", "MOMENTUM", "MIDCAP", "SMALLCAP",
]
# Series codes to include from NSE CM
NSE_INCLUDE_SERIES = {"EQ", "BE"}
# BSE group codes to include (excluding ETFs which have separate group)
BSE_INCLUDE_GROUPS = {"A", "B"}

# ─────────────────────────────────────────────────────────────────────────────
# OHLCV HISTORY
# ─────────────────────────────────────────────────────────────────────────────
HISTORY_YEARS = 2                  # keep 2 years of daily OHLCV
HISTORY_DAYS = 504                 # ~2 trading years

# ─────────────────────────────────────────────────────────────────────────────
# TECHNICAL INDICATORS
# ─────────────────────────────────────────────────────────────────────────────
SMA_PERIODS = [20, 50, 150, 200]
EMA_PERIODS = [10, 21]
ATR_PERIOD = 14
ADR_PERIOD = 5                     # Average Daily Range lookback
RVOL_LOOKBACK = 20                 # days for relative volume baseline

# ─────────────────────────────────────────────────────────────────────────────
# RELATIVE STRENGTH
# ─────────────────────────────────────────────────────────────────────────────
# RS = (return / benchmark return) over period, ranked 1-99 across universe
RS_PERIODS = {                     # calendar days (not trading days)
    "3m": 63,
    "6m": 126,
    "9m": 189,
    "12m": 252,
}
RS_WEIGHTS = {                     # must sum to 1.0
    "3m": 0.40,
    "6m": 0.20,
    "9m": 0.20,
    "12m": 0.20,
}
BENCHMARK_SYMBOL = "^NSEI"         # Nifty 50 for RS computation (yfinance ticker)

# ─────────────────────────────────────────────────────────────────────────────
# WEINSTEIN STAGE CLASSIFICATION
# ─────────────────────────────────────────────────────────────────────────────
# Stage 2A = fresh breakout (close just crossed above sma150/200)
# Stage 2B = confirmed uptrend (close > sma50 > sma150 > sma200, sma200 up)
# Stage 1  = base / accumulation
# Stage 3  = distribution / topping
# Stage 4  = downtrend
STAGE2_SLOPE_MIN_WEEKS = 4         # sma200 must be rising for >= 4 weeks

# ─────────────────────────────────────────────────────────────────────────────
# VCP (VOLATILITY CONTRACTION PATTERN)
# ─────────────────────────────────────────────────────────────────────────────
VCP_LOOKBACK_DAYS = 60             # window to find contractions
VCP_MIN_CONTRACTIONS = 2           # at least 2 tightening contractions required
VCP_CONTRACTION_RATIO = 0.75       # each range must be < 75% of prior
VCP_PIVOT_BUFFER = 0.03            # pivot = latest_high × 1.03
VCP_STOP_ATR_MULT = 1.0            # stop = latest_low - 1×ATR
VCP_SCORE_TIGHT_THRESHOLD = 0.05   # < 5% latest range → max tightness score
VCP_SCORE_LOOSE_THRESHOLD = 0.15   # > 15% → no tightness score

# ─────────────────────────────────────────────────────────────────────────────
# POCKET PIVOT
# ─────────────────────────────────────────────────────────────────────────────
POCKET_PIVOT_LOOKBACK = 10         # compare today's down-vol vs max of 10 prior down-days
POCKET_PIVOT_MIN_VOL_MULT = 1.0    # volume > max prior 10d down-vol

# ─────────────────────────────────────────────────────────────────────────────
# 52-WEEK HIGH BREAKOUT
# ─────────────────────────────────────────────────────────────────────────────
BREAKOUT_52WH_VOL_MULT = 1.5       # volume >= 1.5× 20d average on breakout

# ─────────────────────────────────────────────────────────────────────────────
# 21 EMA PULLBACK
# ─────────────────────────────────────────────────────────────────────────────
PULLBACK_21EMA_MAX_PCT = 0.03      # close must be within 3% below 21 EMA
PULLBACK_21EMA_STAGE2_REQUIRED = True

# ─────────────────────────────────────────────────────────────────────────────
# RRG (RELATIVE ROTATION GRAPH)
# ─────────────────────────────────────────────────────────────────────────────
RRG_RS_RATIO_SMOOTH = 10           # JdK smoothing periods for RS-Ratio
RRG_RS_MOM_SMOOTH = 10             # JdK smoothing periods for RS-Momentum
RRG_TAIL_LENGTH = 12               # number of weekly tails to show on chart

# ─────────────────────────────────────────────────────────────────────────────
# 100-POINT COMPOSITE SCORE THRESHOLDS
# ─────────────────────────────────────────────────────────────────────────────

# Pillar A — Technical (35 pts)
SCORE_RS_MAX = 15
SCORE_STAGE_MAP = {"2B": 10, "2A": 8, "1": 4, "3": 2, "4": 0}
SCORE_ADR_BANDS = [(3.0, 5), (2.0, 3), (0.0, 1)]  # (threshold%, pts)
SCORE_RRG_MAP = {"Leading": 5, "Improving": 4, "Lagging": 2, "Weakening": 1}

# Pillar B — Setup (25 pts)
SCORE_VCP_BANDS = [(0.05, 10), (0.10, 7), (0.15, 4)]  # (tight%, pts)
SCORE_UPVOL_BANDS = [(1.5, 5), (1.2, 3), (0.0, 1)]
SCORE_RVOL_BANDS = [(2.0, 5), (1.5, 3), (0.0, 1)]
SCORE_DELIVERY_MULT = 1.5          # delivery% > 1.5× 20d avg → 5 pts
SCORE_DELIVERY_MILD = 1.2          # delivery% > 1.2× 20d avg → 3 pts

# Pillar C — Fundamentals (40 pts)
SCORE_EPS_QOQ_BANDS = [(0.25, 8), (0.15, 6), (0.0, 3)]
SCORE_REV_QOQ_BANDS = [(0.15, 6), (0.05, 4), (0.0, 2)]
SCORE_ROCE_BANDS = [(0.20, 6), (0.15, 4), (0.10, 2)]
SCORE_DE_BANDS = [(0.3, 4), (0.5, 3), (1.0, 2)]
SCORE_FII_QOQ_BANDS = [(2.0, 6), (1.0, 4), (0.0, 2)]  # pp change
SCORE_PLEDGE_BANDS = [(0.0, 4), (5.0, 3), (10.0, 2)]  # 0=best, 10+=0
SCORE_BULK_DAYS_30 = 6             # pts for bulk/block buy within 30 days
SCORE_BULK_DAYS_60 = 3             # pts for bulk/block buy within 60 days

# ─────────────────────────────────────────────────────────────────────────────
# AI / GEMINI
# ─────────────────────────────────────────────────────────────────────────────
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
GEMINI_TOP_N_SHORTLIST = 15        # send top 15 to Gemini, ask for top 5
GEMINI_TOP_PICKS = 5
GEMINI_MAX_RETRIES = 3
GEMINI_MAX_OUTPUT_TOKENS = 4096
THESIS_CACHE_DAYS = 7              # on-demand stock thesis TTL in DB

# ─────────────────────────────────────────────────────────────────────────────
# STORAGE / DB RETENTION
# ─────────────────────────────────────────────────────────────────────────────
PATTERN_RETENTION_DAYS = 90
INSTITUTIONAL_RETENTION_DAYS = 90
BREADTH_RETENTION_DAYS = 365
AI_RETENTION_DAYS = 30
SPARKLINE_DAYS = 60                # days of closes to store in sparkline

# ─────────────────────────────────────────────────────────────────────────────
# SCREENER.IN
# ─────────────────────────────────────────────────────────────────────────────
SCREENER_BATCH_SIZE = 50           # symbols per Screener.in request
SCREENER_RATE_LIMIT_SLEEP = 1.0   # seconds between batches

# ─────────────────────────────────────────────────────────────────────────────
# TELEGRAM
# ─────────────────────────────────────────────────────────────────────────────
TELEGRAM_MAX_MSG_LEN = 4000        # split messages above this length
TELEGRAM_PARSE_MODE = "HTML"

# ─────────────────────────────────────────────────────────────────────────────
# NIGHTLY PIPELINE TIMING
# ─────────────────────────────────────────────────────────────────────────────
IST_TZ = "Asia/Kolkata"
MARKET_CLOSE_HOUR_IST = 15        # 3:30 PM IST market close
MARKET_CLOSE_MIN_IST = 30
NIGHTLY_RUN_HOUR_IST = 19         # 7:00 PM IST nightly run
