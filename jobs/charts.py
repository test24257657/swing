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
from jobs.indicators import sma
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
