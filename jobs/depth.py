"""Market depth (L2 order book) — best-effort. NSE's quote-equity endpoint is the one
source in this whole pipeline that has come back hard-blocked in testing (an Akamai
403, not the usual bot-check every other endpoint here passes with a cookie warm-up).
It's attempted anyway for the same bounded "interesting universe" as fundamentals —
if it's blocked in production too, symbols just have no depth artifact and the card
degrades to "unavailable" (see docs/phase-8.md).
"""

from __future__ import annotations

import logging

from jobs.sources import market_depth

log = logging.getLogger("jobs.depth")


def build(symbols: list[str]) -> tuple[dict[str, dict], dict]:
    payloads: dict[str, dict] = {}
    unique = list(dict.fromkeys(symbols))
    for symbol in unique:
        data = market_depth(symbol)
        if data is not None:
            payloads[symbol] = data
    stats = {"ok": bool(payloads), "symbols": len(unique), "written": len(payloads)}
    log.info("depth: %s of %s symbols (best-effort — see module docstring)", len(payloads), len(unique))
    return payloads, stats
