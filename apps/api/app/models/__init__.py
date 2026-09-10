"""SQLAlchemy models.

Import every model here so Alembic autogenerate and ``Base.metadata`` see them.
"""

from app.models.backtest_run import BacktestRun
from app.models.daily_bar import DailyBar
from app.models.daily_indicator import DailyIndicator
from app.models.fundamental import Fundamental
from app.models.index import IndexBar, MarketIndex
from app.models.ingestion_run import IngestionRun
from app.models.market import FiiDiiFlow, HolidayCalendar, IndexConstituent, MarketBreadth
from app.models.saved_screen import SavedScreen
from app.models.sector import Sector
from app.models.symbol import Symbol
from app.models.user import User

# PatternSignal / ScreenerScore were dropped with the Plan A migration — pattern
# detection and the screener now run in jobs/ and write out/screener.json, not
# Postgres. See docs/ARCHITECTURE.md and docs/phase-2.md.

__all__ = [
    "Symbol",
    "Sector",
    "DailyBar",
    "DailyIndicator",
    "Fundamental",
    "MarketIndex",
    "IndexBar",
    "SavedScreen",
    "BacktestRun",
    "MarketBreadth",
    "FiiDiiFlow",
    "IndexConstituent",
    "HolidayCalendar",
    "IngestionRun",
    "User",
]
