"""
pipeline/compute/rrg.py
Relative Rotation Graph (RRG) computation.

Computes JdK RS-Ratio and RS-Momentum for each sector vs Nifty 500 benchmark.
Used for the 4-quadrant sector scatter on the Sectors screen.

Reference: Julius de Kempenaer's methodology.
"""

from __future__ import annotations

import logging
from typing import Optional

import polars as pl

from pipeline.config import RRG_RS_RATIO_SMOOTH, RRG_RS_MOM_SMOOTH, RRG_TAIL_LENGTH

log = logging.getLogger("pipeline.compute.rrg")

# NSE sector to constituent mapping (simplified — uses bhavcopy sector classification)
SECTOR_INDICES = {
    "IT": ["INFY", "TCS", "WIPRO", "HCLTECH", "TECHM", "MPHASIS", "LTIM", "COFORGE"],
    "BANKING": ["HDFCBANK", "ICICIBANK", "KOTAKBANK", "AXISBANK", "SBIN", "INDUSINDBK"],
    "PHARMA": ["SUNPHARMA", "DRREDDY", "CIPLA", "DIVISLAB", "TORNTPHARM", "LUPIN"],
    "FMCG": ["HINDUNILVR", "ITC", "NESTLEIND", "BRITANNIA", "DABUR", "GODREJCP"],
    "AUTO": ["MARUTI", "TATAMOTORS", "M&M", "BAJAJ-AUTO", "EICHERMOT", "TVSMOTORS"],
    "METALS": ["TATASTEEL", "JSWSTEEL", "HINDALCO", "VEDL", "COALINDIA", "NMDC"],
    "ENERGY": ["RELIANCE", "ONGC", "BPCL", "IOC", "NTPC", "POWERGRID"],
    "REALTY": ["DLF", "GODREJPROP", "SOBHA", "PRESTIGE", "BRIGADE", "MAHLIFE"],
    "INFRA": ["LT", "IRB", "KNR", "PNC", "HGINFRA", "KNRCON"],
    "CAPITAL_GOODS": ["SIEMENS", "ABB", "BHEL", "CUMMINSIND", "THERMAX", "GRINDWELL"],
    "CHEMICALS": ["PIDILITIND", "AAPL", "DEEPAKFERT", "NAVINFLUOR", "FINEORG", "ATUL"],
    "TEXTILES": ["PAGEIND", "RAYMOND", "TRIDENT", "WELSPUN", "ALOKTEXT"],
    "CONSUMER": ["TITAN", "HAVELLS", "VOLTAS", "WHIRLPOOL", "CROMPTON", "AMBER"],
}


def compute_sector_rrg(
    df: pl.DataFrame,
    benchmark_df: pl.DataFrame,
    n_weeks: int = RRG_TAIL_LENGTH,
) -> dict[str, list[dict]]:
    """
    Compute RRG coordinates for each sector over the last n_weeks.

    Args:
        df: Full universe OHLCV DataFrame, sorted (isin, date)
        benchmark_df: Nifty 500 close history (date, close)
        n_weeks: Number of weekly tails to compute

    Returns:
        Dict mapping sector_name → list of {date, rs_ratio, rs_momentum, quadrant}
        for the tail trail on the RRG chart.
    """
    # Resample to weekly (Friday closes)
    weekly_df = _resample_weekly(df)
    weekly_bench = _resample_weekly_single(benchmark_df)

    if weekly_bench is None or len(weekly_bench) < 20:
        log.warning("Insufficient benchmark data for RRG computation")
        return {}

    rrg_results: dict[str, list[dict]] = {}

    for sector, symbols in SECTOR_INDICES.items():
        sector_rrg = _compute_sector_series(
            weekly_df, weekly_bench, symbols, sector, n_weeks
        )
        if sector_rrg:
            rrg_results[sector] = sector_rrg

    log.info("RRG computed for %d sectors", len(rrg_results))
    return rrg_results


def _compute_sector_series(
    weekly_df: pl.DataFrame,
    benchmark: pl.DataFrame,
    symbols: list[str],
    sector: str,
    n_weeks: int,
) -> Optional[list[dict]]:
    """Compute RRG trail for a single sector."""
    try:
        # Compute equal-weighted sector index from constituent closes
        sector_df = (
            weekly_df
            .filter(pl.col("symbol").is_in(symbols))
            .group_by("date")
            .agg(pl.col("close").mean().alias("sector_close"))
            .sort("date")
        )

        if len(sector_df) < 20:
            return None

        # Join with benchmark
        combined = sector_df.join(
            benchmark.rename({"close": "bench_close"}),
            on="date",
            how="inner",
        ).sort("date")

        if len(combined) < 15:
            return None

        # RS = sector_close / bench_close * 100 (normalized)
        combined = combined.with_columns([
            (pl.col("sector_close") / pl.col("bench_close") * 100).alias("rs"),
        ])

        # RS-Ratio: 10-period EWM smoothed RS, then normalized around 100
        combined = combined.with_columns([
            pl.col("rs").ewm_mean(span=RRG_RS_RATIO_SMOOTH, min_samples=5).alias("rs_smoothed"),
        ])

        # Normalize to 100 (divide by 52-week mean)
        rs_52w_mean = combined.tail(52)["rs_smoothed"].mean()
        if not rs_52w_mean or rs_52w_mean == 0:
            return None

        combined = combined.with_columns([
            (pl.col("rs_smoothed") / rs_52w_mean * 100).alias("rs_ratio"),
        ])

        # RS-Momentum: rate of change of RS-Ratio, smoothed
        combined = combined.with_columns([
            pl.col("rs_ratio").pct_change(1).alias("rs_ratio_roc"),
        ])
        combined = combined.with_columns([
            (pl.col("rs_ratio_roc").ewm_mean(span=RRG_RS_MOM_SMOOTH, min_samples=3) * 100 + 100)
            .alias("rs_momentum"),
        ])

        # Take last n_weeks points
        tail = combined.tail(n_weeks).to_dicts()

        results = []
        for row in tail:
            rs_ratio = row.get("rs_ratio")
            rs_mom = row.get("rs_momentum")
            if rs_ratio is None or rs_mom is None:
                continue

            quadrant = _classify_quadrant(rs_ratio, rs_mom)
            results.append({
                "date": str(row["date"]),
                "rs_ratio": round(rs_ratio, 2),
                "rs_momentum": round(rs_mom, 2),
                "quadrant": quadrant,
            })

        return results if results else None

    except Exception as exc:
        log.warning("RRG failed for sector %s: %s", sector, exc)
        return None


def _classify_quadrant(rs_ratio: float, rs_momentum: float) -> str:
    """Classify RRG position into one of the 4 quadrants."""
    if rs_ratio >= 100 and rs_momentum >= 100:
        return "Leading"
    elif rs_ratio < 100 and rs_momentum >= 100:
        return "Improving"
    elif rs_ratio < 100 and rs_momentum < 100:
        return "Lagging"
    else:  # rs_ratio >= 100 and rs_momentum < 100
        return "Weakening"


def _resample_weekly(df: pl.DataFrame) -> pl.DataFrame:
    """Resample daily OHLCV to weekly (last day of week = Friday close)."""
    return (
        df.with_columns([
            pl.col("date").dt.truncate("1w").alias("week_start"),
        ])
        .group_by(["isin", "symbol", "week_start"])
        .agg([
            pl.col("date").last().alias("date"),
            pl.col("open").first().alias("open"),
            pl.col("high").max().alias("high"),
            pl.col("low").min().alias("low"),
            pl.col("close").last().alias("close"),
            pl.col("volume").sum().alias("volume"),
        ])
        .sort(["isin", "date"])
    )


def _resample_weekly_single(df: pl.DataFrame) -> Optional[pl.DataFrame]:
    """Resample benchmark close series to weekly."""
    try:
        return (
            df.with_columns([
                pl.col("date").dt.truncate("1w").alias("week_start"),
            ])
            .group_by("week_start")
            .agg([
                pl.col("date").last().alias("date"),
                pl.col("close").last().alias("close"),
            ])
            .sort("date")
        )
    except Exception:
        return None


def get_latest_rrg_snapshot(rrg_data: dict[str, list[dict]]) -> dict[str, dict]:
    """Extract the latest RRG position for each sector."""
    snapshot = {}
    for sector, trail in rrg_data.items():
        if trail:
            latest = trail[-1]
            snapshot[sector] = {
                "rs_ratio": latest["rs_ratio"],
                "rs_momentum": latest["rs_momentum"],
                "quadrant": latest["quadrant"],
            }
    return snapshot


def build_rrg_ui_payload(rrg_data: dict[str, list[dict]]) -> list[dict]:
    """
    Format RRG coordinates for frontend RrgCanvas component consumption.
    Matches src/components/rrg-canvas.tsx RrgSectorItem interface:
    [
      {
        "sector": sector,
        "rsRatio": trail[-1]["rs_ratio"],
        "rsMomentum": trail[-1]["rs_momentum"],
        "quadrant": trail[-1]["quadrant"],
        "tail5d": [{"rsRatio": pt["rs_ratio"], "rsMomentum": pt["rs_momentum"]} for pt in trail[-5:]],
        "topLeaders": SECTOR_INDICES.get(sector, [])[:4]
      }
    ]
    """
    ui_list = []
    for sector, trail in rrg_data.items():
        if not trail:
            continue
        last_pt = trail[-1]
        ui_list.append({
            "sector": sector,
            "rsRatio": last_pt["rs_ratio"],
            "rsMomentum": last_pt["rs_momentum"],
            "quadrant": last_pt["quadrant"],
            "tail5d": [
                {"rsRatio": pt["rs_ratio"], "rsMomentum": pt["rs_momentum"]}
                for pt in trail[-5:]
            ],
            "topLeaders": SECTOR_INDICES.get(sector, [])[:4],
        })
    return ui_list
