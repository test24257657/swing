"""
pipeline/compute/indicators.py
Pure mathematics — no I/O, no side effects.

All indicators computed with Polars expressions over the full universe in one pass.
Input: sorted (isin, date) OHLCV DataFrame.
Output: same DataFrame with indicator columns appended.
"""

from __future__ import annotations

import logging

import polars as pl

from pipeline.config import (
    SMA_PERIODS,
    EMA_PERIODS,
    ATR_PERIOD,
    ADR_PERIOD,
    RVOL_LOOKBACK,
    RS_PERIODS,
    RS_WEIGHTS,
    STAGE2_SLOPE_MIN_WEEKS,
)

log = logging.getLogger("pipeline.compute.indicators")


def compute_all(df: pl.DataFrame) -> pl.DataFrame:
    """
    Compute all technical indicators for the full universe in one pass.

    Args:
        df: OHLCV DataFrame sorted by (isin, date) with columns:
            isin, date, open, high, low, close, volume, turnover_lakh, delivery_pct

    Returns:
        Input DataFrame with additional indicator columns.
    """
    log.info("Computing indicators for %d rows, %d stocks",
             len(df), df["isin"].n_unique())

    df = df.sort(["isin", "date"])

    # ── Moving Averages ───────────────────────────────────────────────────────
    for period in SMA_PERIODS:
        df = df.with_columns([
            pl.col("close")
              .rolling_mean(window_size=period, min_samples=period)
              .over("isin")
              .alias(f"sma{period}"),
        ])

    for period in EMA_PERIODS:
        df = df.with_columns([
            _ewm_col("close", period, f"ema{period}"),
        ])

    # ── ATR (Wilder's) ────────────────────────────────────────────────────────
    df = df.with_columns([
        pl.max_horizontal(
            pl.col("high") - pl.col("low"),
            (pl.col("high") - pl.col("close").shift(1).over("isin")).abs(),
            (pl.col("low") - pl.col("close").shift(1).over("isin")).abs(),
        ).alias("tr"),
    ])
    df = df.with_columns([
        pl.col("tr")
          .rolling_mean(window_size=ATR_PERIOD, min_samples=ATR_PERIOD)
          .over("isin")
          .alias(f"atr{ATR_PERIOD}"),
    ])

    # ── Previous Close & Change % ─────────────────────────────────────────────
    df = df.with_columns([
        pl.col("close").shift(1).over("isin").alias("prev_close"),
    ])
    df = df.with_columns([
        ((pl.col("close") - pl.col("prev_close")) / (pl.col("prev_close") + 1e-9) * 100)
          .alias("change_pct"),
    ])

    # ── Average Daily Range % ─────────────────────────────────────────────────
    df = df.with_columns([
        ((pl.col("high") - pl.col("low")) / pl.col("close") * 100)
          .rolling_mean(window_size=ADR_PERIOD, min_samples=ADR_PERIOD)
          .over("isin")
          .alias("adr"),
    ])

    # ── Relative Volume ───────────────────────────────────────────────────────
    df = df.with_columns([
        pl.col("volume")
          .rolling_mean(window_size=RVOL_LOOKBACK, min_samples=RVOL_LOOKBACK)
          .over("isin")
          .alias("avg_vol"),
    ])
    df = df.with_columns([
        (pl.col("volume") / pl.col("avg_vol")).alias("rvol"),
    ])

    # ── Up/Down Volume Ratio (10-day) ─────────────────────────────────────────
    # up_vol = volume on days where close > prev_close, else 0
    df = df.with_columns([
        pl.when(pl.col("close") > pl.col("close").shift(1).over("isin"))
          .then(pl.col("volume"))
          .otherwise(0.0)
          .alias("up_vol"),
        pl.when(pl.col("close") < pl.col("close").shift(1).over("isin"))
          .then(pl.col("volume"))
          .otherwise(0.0)
          .alias("down_vol"),
    ])
    df = df.with_columns([
        pl.col("up_vol")
          .rolling_sum(window_size=10, min_samples=5)
          .over("isin")
          .alias("up_vol_10d"),
        pl.col("down_vol")
          .rolling_sum(window_size=10, min_samples=5)
          .over("isin")
          .alias("down_vol_10d"),
    ])
    df = df.with_columns([
        (pl.col("up_vol_10d") / (pl.col("down_vol_10d") + 1e-9))
          .alias("up_down_vol_ratio"),
    ])

    # ── 52-Week High / Low ────────────────────────────────────────────────────
    df = df.with_columns([
        pl.col("high")
          .rolling_max(window_size=252, min_samples=20)
          .over("isin")
          .alias("high52w"),
        pl.col("low")
          .rolling_min(window_size=252, min_samples=20)
          .over("isin")
          .alias("low52w"),
    ])
    df = df.with_columns([
        ((pl.col("close") - pl.col("high52w")) / pl.col("high52w") * 100)
          .alias("from_high52w_pct"),
    ])

    # ── SMA200 Slope (30-day ROC) ─────────────────────────────────────────────
    df = df.with_columns([
        (
            (pl.col("sma200") - pl.col("sma200").shift(20).over("isin"))
            / (pl.col("sma200").shift(20).over("isin") + 1e-9)
            * 100
        ).alias("sma200_slope"),
    ])

    # ── RSI 14 (Wilder's Smoothing) ───────────────────────────────────────────
    diff = pl.col("close") - pl.col("close").shift(1).over("isin")
    gain = pl.when(diff > 0).then(diff).otherwise(0.0)
    loss = pl.when(diff < 0).then(-diff).otherwise(0.0)
    df = df.with_columns([
        gain.alias("_gain"),
        loss.alias("_loss"),
    ])
    df = df.with_columns([
        pl.col("_gain").ewm_mean(span=27, min_samples=14).over("isin").alias("_avg_gain"),
        pl.col("_loss").ewm_mean(span=27, min_samples=14).over("isin").alias("_avg_loss"),
    ])
    df = df.with_columns([
        (
            100.0 - (100.0 / (1.0 + (pl.col("_avg_gain") / (pl.col("_avg_loss") + 1e-9))))
        ).alias("rsi14"),
    ])
    df = df.drop(["_gain", "_loss", "_avg_gain", "_avg_loss"])

    # ── Base Tightness % (10-day high-low range %) ────────────────────────────
    df = df.with_columns([
        (
            (pl.col("high").rolling_max(window_size=10, min_samples=5).over("isin")
             - pl.col("low").rolling_min(window_size=10, min_samples=5).over("isin"))
            / pl.col("close") * 100
        ).alias("baseTightnessPct"),
    ])

    # ── Minervini Trend Template Pass ─────────────────────────────────────────
    df = df.with_columns([
        (
            (pl.col("close") > pl.col("sma50"))
            & (pl.col("sma50") > pl.col("sma150"))
            & (pl.col("sma150") > pl.col("sma200"))
            & (pl.col("sma200_slope") > 0)
            & (pl.col("close") >= pl.col("low52w") * 1.30)
            & (pl.col("close") >= pl.col("high52w") * 0.75)
        ).alias("minerviniPass"),
    ])

    # ── Delivery % 20-day average ─────────────────────────────────────────────
    if "delivery_pct" in df.columns:
        df = df.with_columns([
            pl.col("delivery_pct")
              .rolling_mean(window_size=20, min_samples=5)
              .over("isin")
              .alias("delivery_avg20d"),
        ])
        df = df.with_columns([
            (pl.col("delivery_pct") / (pl.col("delivery_avg20d") + 1e-9))
              .alias("delivery_spike"),
        ])

    log.info("Indicators computed successfully")
    return df


def compute_weinstein_stage(df: pl.DataFrame) -> pl.DataFrame:
    """
    Classify each stock's latest bar into Weinstein Stage.

    Stage 2B: close > sma50 > sma150 > sma200, sma200_slope > 0
    Stage 2A: close > sma200, fresh cross above
    Stage 1:  close < sma200, sma200_slope <= 0 (base building)
    Stage 3:  close < sma50, below sma150, after Stage 2
    Stage 4:  close < sma200, sma200_slope < 0 (downtrend)
    """
    min_slope_threshold = 0.0  # sma200 must be non-negative slope

    df = df.with_columns([
        pl.when(
            (pl.col("close") > pl.col("sma50"))
            & (pl.col("sma50") > pl.col("sma150"))
            & (pl.col("sma150") > pl.col("sma200"))
            & (pl.col("sma200_slope") > min_slope_threshold)
        )
        .then(pl.lit("2B"))
        .when(
            (pl.col("close") > pl.col("sma200"))
            & (pl.col("sma200").is_not_null())
        )
        .then(pl.lit("2A"))
        .when(
            (pl.col("close") < pl.col("sma200"))
            & (pl.col("sma200_slope") > -0.5)
        )
        .then(pl.lit("1"))
        .when(
            (pl.col("close") < pl.col("sma150"))
            & (pl.col("sma200_slope") >= -0.5)
        )
        .then(pl.lit("3"))
        .otherwise(pl.lit("4"))
        .alias("weinstein_stage"),
    ])

    return df


def _ewm_col(src_col: str, span: int, alias: str) -> pl.Expr:
    """Exponential weighted moving average using Polars ewm_mean."""
    return (
        pl.col(src_col)
          .ewm_mean(span=span, min_samples=span // 2)
          .alias(alias)
    )


def compute_relative_strength(df: pl.DataFrame, benchmark: pl.DataFrame) -> pl.DataFrame:
    """
    Compute RS percentile (1–99) for each stock vs the universe.

    Benchmark DataFrame must have columns: (date, close) for the index (Nifty 500).
    RS = (stock 3m return / benchmark 3m return), ranked 1-99 across all stocks.

    Returns df with rs3m, rs6m, rs9m, rs12m, rs_composite columns.
    """
    # Drop any existing temporary bench, rs, or duplicate join cols
    cols_to_drop = [
        c for c in df.columns
        if c.startswith("_bench_ret_")
        or c.startswith("_rs_raw_")
        or c in ["rs3m", "rs6m", "rs9m", "rs12m", "rs_composite"]
        or c.endswith("_right")
    ]
    if cols_to_drop:
        df = df.drop(cols_to_drop)

    # Compute benchmark returns directly on unique sorted dates
    bench = benchmark.unique(subset=["date"]).sort("date")
    if bench["date"].dtype != df["date"].dtype:
        bench = bench.with_columns(pl.col("date").cast(df["date"].dtype))

    bench_cols = []
    for period_name, period_days in RS_PERIODS.items():
        ret_col = f"_bench_ret_{period_name}"
        bench = bench.with_columns([
            (pl.col("close") / pl.col("close").shift(period_days) - 1).alias(ret_col)
        ])
        bench_cols.append(ret_col)

    df = df.join(bench.select(["date"] + bench_cols), on="date", how="left")

    # Compute stock returns and relative strength
    for period_name, period_days in RS_PERIODS.items():
        stock_ret = (
            pl.col("close") / pl.col("close").shift(period_days).over("isin") - 1
        )
        bench_ret = pl.col(f"_bench_ret_{period_name}")
        df = df.with_columns([
            (stock_ret - bench_ret).alias(f"_rs_raw_{period_name}"),
        ])

    # Get latest bars only for ranking
    latest = df.sort("date").group_by("isin").last()

    for period_name in RS_PERIODS:
        col = f"_rs_raw_{period_name}"
        if col not in latest.columns:
            continue
        # Rank into 1-99 percentile
        latest = latest.with_columns([
            (
                pl.col(col).rank("average") / pl.col(col).count() * 99
            ).round(0).cast(pl.Int32).clip(1, 99)
            .alias(f"rs{period_name}"),
        ])

    # Composite weighted RS
    weight_exprs = []
    for period_name, weight in RS_WEIGHTS.items():
        col = f"rs{period_name}"
        if col in latest.columns:
            weight_exprs.append(pl.col(col).cast(pl.Float64) * weight)

    if weight_exprs:
        latest = latest.with_columns([
            sum(weight_exprs).alias("rs_composite"),
        ])

    # Join RS scores back to full df (ensure no column name collision)
    rs_cols = [c for c in ["rs3m", "rs6m", "rs9m", "rs12m", "rs_composite"] if c in latest.columns]
    df = df.join(
        latest.select(["isin"] + rs_cols),
        on="isin",
        how="left",
    )

    # Clean up temporary columns
    temp_cols = [c for c in df.columns if c.startswith("_bench_ret_") or c.startswith("_rs_raw_")]
    if temp_cols:
        df = df.drop(temp_cols)

    return df
