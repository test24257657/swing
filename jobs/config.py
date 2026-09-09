"""Every threshold in the pipeline lives here. Never inline a number in logic."""

from __future__ import annotations

import os
from pathlib import Path

# --- paths -------------------------------------------------------------------
ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = Path(os.environ.get("DATA_DIR", ROOT / "data"))
OUT_DIR = Path(os.environ.get("OUT_DIR", ROOT / "out"))
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
        "Low volatility — trend-friendly",
        "Favour breakout continuation; wider stops unnecessary.",
    ),
    "moderate": (
        "Moderate volatility",
        "Normal conditions; standard position sizing.",
    ),
    "elevated": (
        "Elevated volatility",
        "Trim size; expect wider swings and more failed breakouts.",
    ),
    "high": (
        "High volatility — defensive",
        "Momentum setups fail more often here; wait for it to cool.",
    ),
}

# --- flows -------------------------------------------------------------------
FLOW_SESSIONS = 10

# --- market session (IST) ----------------------------------------------------
PRE_OPEN = "09:00"
MARKET_OPEN = "09:15"
MARKET_CLOSE = "15:30"

# --- fetching ----------------------------------------------------------------
HTTP_TIMEOUT = 25
BACKFILL_DAYS = int(os.environ.get("BACKFILL_DAYS", "260"))
SERIES_KEPT = {"EQ", "BE", "BZ"}
