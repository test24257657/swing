"""SQLAlchemy models.

Import every model here so Alembic autogenerate and ``Base.metadata`` see them.
"""

from app.models.backtest_run import BacktestRun
from app.models.daily_bar import DailyBar
from app.models.daily_indicator import DailyIndicator
from app.models.fundamental import Fundamental
from app.models.index import IndexBar, MarketIndex
from app.models.ingestion_run import IngestionRun
from app.models.saved_screen import SavedScreen
from app.models.screener_score import ScreenerScore
from app.models.sector import Sector
from app.models.symbol import Symbol

__all__ = [
    "Symbol",
    "Sector",
    "DailyBar",
    "DailyIndicator",
    "Fundamental",
    "MarketIndex",
    "IndexBar",
    "ScreenerScore",
    "SavedScreen",
    "BacktestRun",
    "IngestionRun",
]
