"""Per-instrument chart artifacts.

Only for what the Pulse screen actually shows — the four index tiles plus the symbols
in the two mover tables (~25 files, ~40 KB each). Clicking any of those cards opens
`/chart/<slug>`, which the API serves straight from `out/charts/<slug>.json`.

This is the `out/stocks/{SYM}.json` pattern from the architecture doc, scoped to the one
screen that is live.
"""

from __future__ import annotations

import logging
import re

import pandas as pd

from jobs.config import PANEL_DAYS
from jobs.indicators import distance_pct, rel_volume, sma, wilder_atr, wilder_rsi
from jobs.sources import index_history, symbol_names
from jobs.writer import write

log = logging.getLogger("jobs.charts")

MA_WINDOWS = (20, 50, 200)


def slug(symbol: str) -> str:
    """`NIFTY 50` -> `NIFTY_50`, `NIFTY OIL & GAS` -> `NIFTY_OIL_GAS`. Reversible enough:
    the real symbol is stored inside the artifact."""
    return re.sub(r"[^A-Z0-9]+", "_", symbol.upper()).strip("_")


def _ma_series(closes: pd.Series, dates: pd.Series) -> dict:
    out: dict[str, list] = {}
    for w in MA_WINDOWS:
        if len(closes) < w:
            continue
        s = sma(closes.reset_index(drop=True), w)
        out[f"sma_{w}"] = [
            {"time": d.date().isoformat(), "value": round(float(v), 2)}
            for d, v in zip(dates, s, strict=False)
            if pd.notna(v)
        ]
    return out


def _technicals(df: pd.DataFrame) -> dict | None:
    """RSI/ATR/DMA-distance/relative-volume snapshot — stocks only, not indices."""
    if len(df) < 20:
        return None
    close, high, low, volume = df["close"], df["high"], df["low"], df["volume"]
    last_close = float(close.iloc[-1])
    rsi = wilder_rsi(close, 14).iloc[-1]
    atr = wilder_atr(high, low, close, 14).iloc[-1]
    rvol = rel_volume(volume, 20).iloc[-1]

    out: dict = {
        "rsi_14": _round(rsi),
        "atr_pct": _round(atr / last_close * 100) if pd.notna(atr) and last_close else None,
        "rel_volume_20d": _round(rvol),
    }
    for w in (20, 50, 200):
        if len(close) < w:
            out[f"dist_{w}dma_pct"] = None
            continue
        dma = sma(close, w).iloc[-1]
        out[f"dist_{w}dma_pct"] = _round(distance_pct(pd.Series([last_close]), pd.Series([dma])).iloc[0]) if pd.notna(dma) else None
    return out


def _payload(symbol: str, name: str, kind: str, df: pd.DataFrame) -> dict:
    df = df.sort_values("date").tail(PANEL_DAYS).reset_index(drop=True)
    bars = [
        {
            "time": r["date"].date().isoformat(),
            "open": _round(r.get("open")),
            "high": _round(r.get("high")),
            "low": _round(r.get("low")),
            "close": _round(r["close"]),
            "volume": int(r["volume"]) if pd.notna(r.get("volume")) else 0,
            "delivery_pct": _round(r.get("delivery_pct")) if kind == "stock" else None,
        }
        for _, r in df.iterrows()
    ]
    return {
        "symbol": symbol,
        "name": name,
        "kind": kind,
        "as_of": bars[-1]["time"] if bars else None,
        "bars": bars,
        "ma": _ma_series(df["close"], df["date"]),
        "technicals": _technicals(df) if kind == "stock" else None,
    }


def build(panel: pd.DataFrame, tile_symbols: list[str], mover_symbols: list[str], days: int) -> tuple[list[str], dict]:
    written: list[str] = []

    for symbol in tile_symbols:
        hist = index_history(symbol, days)
        if hist is None or hist.empty:
            continue
        hist = hist.rename(columns={}).assign(volume=0)
        write(f"charts/{slug(symbol)}.json", _payload(symbol, symbol, "index", hist))
        written.append(symbol)

    if not panel.empty and mover_symbols:
        names = symbol_names()
        for symbol in dict.fromkeys(mover_symbols):  # dedupe, keep order
            sub = panel[panel["symbol"] == symbol]
            if sub.empty:
                continue
            write(f"charts/{slug(symbol)}.json", _payload(symbol, names.get(symbol, symbol), "stock", sub))
            written.append(symbol)

    return written, {"ok": bool(written), "count": len(written)}


def _round(v):
    return round(float(v), 2) if v is not None and pd.notna(v) else None
