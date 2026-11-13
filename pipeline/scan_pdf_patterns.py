#!/usr/bin/env python3
"""
pipeline/scan_pdf_patterns.py
Scans the universe from data/ohlcv_2y.parquet across BUY-SIDE (BULLISH) chart patterns:
- Double Bottom (Bullish Reversal)
- Triple Bottom (Bullish Reversal)
- Inverse Head and Shoulders (Bullish Reversal)
- Falling Wedge (Bullish Reversal)
- Bullish Rectangle (Bullish Continuation)
- Bullish Flag (Bullish Continuation)
- Bullish Pennant (Bullish Continuation)
- Cup and Handle (Bullish Continuation)
- Ascending Triangle (Bullish Breakout)

Outputs results to data/pdf_pattern_scans.json for fast instant querying by /api/patterns.
"""
from __future__ import annotations

import json
import math
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
PARQUET_FILE = ROOT / "data" / "ohlcv_2y.parquet"
OUTPUT_FILE = ROOT / "data" / "pdf_pattern_scans.json"


def pct(a: float, b: float) -> float:
    return abs(a - b) / ((a + b) / 2.0)


def avg(*vals: float) -> float:
    return sum(vals) / len(vals)


def pivot_highs(bars: list[dict], w: int = 3) -> list[int]:
    idxs = []
    n = len(bars)
    for i in range(w, n - w):
        h = bars[i]["high"]
        is_pivot = True
        for j in range(i - w, i + w + 1):
            if j != i and bars[j]["high"] >= h:
                is_pivot = False
                break
        if is_pivot:
            idxs.append(i)
    return idxs


def pivot_lows(bars: list[dict], w: int = 3) -> list[int]:
    idxs = []
    n = len(bars)
    for i in range(w, n - w):
        l = bars[i]["low"]
        is_pivot = True
        for j in range(i - w, i + w + 1):
            if j != i and bars[j]["low"] <= l:
                is_pivot = False
                break
        if is_pivot:
            idxs.append(i)
    return idxs


def detect_patterns_for_symbol(symbol: str, bars: list[dict]) -> list[dict[str, Any]]:
    if len(bars) < 30:
        return []

    ph = pivot_highs(bars, 3)
    pl = pivot_lows(bars, 3)
    current_close = bars[-1]["close"]
    detected: list[dict[str, Any]] = []

    # 1. Double Bottom (Bullish Reversal)
    if len(pl) >= 2:
        for k in range(len(pl) - 1, 0, -1):
            i2, i1 = pl[k], pl[k - 1]
            if 8 <= (i2 - i1) <= 120 and (len(bars) - i2) <= 40:
                l1, l2 = bars[i1]["low"], bars[i2]["low"]
                if pct(l1, l2) <= 0.045:
                    neckline = max(bars[j]["high"] for j in range(i1, i2 + 1))
                    bottom = avg(l1, l2)
                    target = round(neckline + (neckline - bottom), 2)
                    detected.append({
                        "name": "Double Bottom",
                        "category": "reversal",
                        "bias": "bullish",
                        "confidence": 88 if current_close >= neckline * 0.99 else 65,
                        "status": "BREAKOUT" if current_close >= neckline else "FORMING",
                        "pivotPrice": round(bottom, 2),
                        "neckline": round(neckline, 2),
                        "targetPrice": target,
                        "stopLossPrice": round(bottom * 0.98, 2),
                    })
                    break

    # 2. Triple Bottom (Bullish Reversal)
    if len(pl) >= 3:
        i3, i2, i1 = pl[-1], pl[-2], pl[-3]
        if (len(bars) - i3) <= 40 and (i3 - i1) <= 160:
            l1, l2, l3 = bars[i1]["low"], bars[i2]["low"], bars[i3]["low"]
            if pct(l1, l2) <= 0.045 and pct(l2, l3) <= 0.045:
                neckline = max(bars[j]["high"] for j in range(i1, i3 + 1))
                bottom = avg(l1, l2, l3)
                detected.append({
                    "name": "Triple Bottom",
                    "category": "reversal",
                    "bias": "bullish",
                    "confidence": 84,
                    "status": "BREAKOUT" if current_close >= neckline else "FORMING",
                    "pivotPrice": round(bottom, 2),
                    "neckline": round(neckline, 2),
                    "targetPrice": round(neckline + (neckline - bottom), 2),
                    "stopLossPrice": round(bottom * 0.98, 2),
                })

    # 3. Inverse Head and Shoulders (Bullish Reversal)
    if len(pl) >= 3:
        i3, i2, i1 = pl[-1], pl[-2], pl[-3]
        if (len(bars) - i3) <= 40:
            lL, hL, rL = bars[i1]["low"], bars[i2]["low"], bars[i3]["low"]
            if hL < lL and hL < rL and pct(lL, rL) <= 0.05:
                peak1 = max(bars[j]["high"] for j in range(i1, i2 + 1))
                peak2 = max(bars[j]["high"] for j in range(i2, i3 + 1))
                neckline = avg(peak1, peak2)
                detected.append({
                    "name": "Inverse H&S",
                    "category": "reversal",
                    "bias": "bullish",
                    "confidence": 86,
                    "status": "BREAKOUT" if current_close >= neckline else "FORMING",
                    "pivotPrice": round(hL, 2),
                    "neckline": round(neckline, 2),
                    "targetPrice": round(neckline + (neckline - hL), 2),
                    "stopLossPrice": round(hL * 0.99, 2),
                })

    # 4. Falling Wedge (Bullish Reversal)
    if len(ph) >= 2 and len(pl) >= 2:
        iH2, iH1 = ph[-1], ph[-2]
        iL2, iL1 = pl[-1], pl[-2]
        hH2, hH1 = bars[iH2]["high"], bars[iH1]["high"]
        lL2, lL1 = bars[iL2]["low"], bars[iL2]["low"]
        if (len(bars) - max(iH2, iL2)) <= 35:
            if hH2 < hH1 and lL2 < lL1:
                slope_h = abs((hH2 - hH1) / max(1, iH2 - iH1))
                slope_l = abs((lL2 - lL1) / max(1, iL2 - iL1))
                if slope_l > slope_h * 1.05:
                    detected.append({
                        "name": "Falling Wedge",
                        "category": "reversal",
                        "bias": "bullish",
                        "confidence": 75,
                        "status": "BREAKOUT" if current_close >= hH2 else "COILING",
                        "pivotPrice": round(hH2, 2),
                        "stopLossPrice": round(lL2 * 0.98, 2),
                        "targetPrice": round(hH1, 2),
                    })

    # 5. Bullish Rectangle (Bullish Continuation)
    if len(bars) >= 50:
        recent = bars[-45:]
        highs = [b["high"] for b in recent]
        lows = [b["low"] for b in recent]
        max_h, min_l = max(highs), min(lows)
        range_pct = (max_h - min_l) / min_l
        if range_pct <= 0.12:
            prior = bars[-75:-45]
            if len(prior) >= 20:
                prior_move = (prior[-1]["close"] - prior[0]["close"]) / prior[0]["close"]
                if prior_move >= 0.08:
                    detected.append({
                        "name": "Bullish Rectangle",
                        "category": "continuation",
                        "bias": "bullish",
                        "confidence": 72,
                        "status": "BREAKOUT" if current_close > max_h else "CONSOLIDATING",
                        "pivotPrice": round(max_h, 2),
                        "neckline": round(max_h, 2),
                        "targetPrice": round(max_h + (max_h - min_l), 2),
                        "stopLossPrice": round(min_l * 0.98, 2),
                    })

    # 6. Bullish Flag (Bullish Continuation)
    if len(bars) >= 30:
        for pole_len in (15, 20):
            flag_len = 8
            if len(bars) >= pole_len + flag_len:
                pole = bars[-pole_len - flag_len : -flag_len]
                flag = bars[-flag_len:]
                pole_move = (pole[-1]["close"] - pole[0]["close"]) / pole[0]["close"]
                flag_high = max(b["high"] for b in flag)
                flag_low = min(b["low"] for b in flag)
                if (flag_high - flag_low) / flag_low <= 0.06:
                    if pole_move >= 0.08:
                        detected.append({
                            "name": "Bullish Flag",
                            "category": "continuation",
                            "bias": "bullish",
                            "confidence": 78,
                            "status": "FLAG_TIGHT",
                            "pivotPrice": round(flag_high, 2),
                            "targetPrice": round(flag_high + (pole[-1]["close"] - pole[0]["close"]), 2),
                            "stopLossPrice": round(flag_low * 0.98, 2),
                        })
                        break

    # 7. Bullish Pennant (Bullish Continuation)
    if len(bars) >= 30:
        pennant = bars[-10:]
        pole = bars[-30:-10]
        pole_move = (pole[-1]["close"] - pole[0]["close"]) / pole[0]["close"]
        if pole_move >= 0.07:
            h1, h2 = pennant[0]["high"], pennant[-1]["high"]
            l1, l2 = pennant[0]["low"], pennant[-1]["low"]
            if h2 <= h1 and l2 >= l1:
                detected.append({
                    "name": "Bullish Pennant",
                    "category": "continuation",
                    "bias": "bullish",
                    "confidence": 76,
                    "status": "COILING",
                    "pivotPrice": round(h2, 2),
                    "stopLossPrice": round(l2 * 0.98, 2),
                    "targetPrice": round(h1 + (pole[-1]["close"] - pole[0]["close"]), 2),
                })

    # 8. Cup and Handle (Bullish Continuation)
    if len(bars) >= 60:
        cup = bars[-65:-12]
        handle = bars[-12:]
        cup_l, cup_r = cup[0]["close"], cup[-1]["close"]
        if pct(cup_l, cup_r) <= 0.05:
            cup_bottom = min(b["low"] for b in cup)
            cup_depth = (cup_l - cup_bottom) / cup_l
            if 0.08 <= cup_depth <= 0.45:
                handle_high = max(b["high"] for b in handle)
                handle_low = min(b["low"] for b in handle)
                if handle_high <= cup_r * 1.02 and (handle_high - handle_low) / handle_high <= 0.08:
                    detected.append({
                        "name": "Cup & Handle",
                        "category": "continuation",
                        "bias": "bullish",
                        "confidence": 80,
                        "status": "HANDLE_CONSOLIDATING",
                        "pivotPrice": round(cup_r, 2),
                        "targetPrice": round(cup_r + (cup_r - cup_bottom), 2),
                        "stopLossPrice": round(handle_low * 0.98, 2),
                    })

    # 9. Ascending Triangle (Bullish Breakout)
    if len(ph) >= 2 and len(pl) >= 2:
        iH2, iH1 = ph[-1], ph[-2]
        iL2, iL1 = pl[-1], pl[-2]
        if (len(bars) - max(iH2, iL2)) <= 35:
            hH2, hH1 = bars[iH2]["high"], bars[iH1]["high"]
            lL2, lL1 = bars[iL2]["low"], bars[iL1]["low"]
            h_flat = pct(hH1, hH2) <= 0.025
            l_rise = lL2 > lL1 * 1.02

            if h_flat and l_rise:
                res = avg(hH1, hH2)
                detected.append({
                    "name": "Ascending Triangle",
                    "category": "neutral",
                    "bias": "bullish",
                    "confidence": 78,
                    "status": "BREAKOUT" if current_close >= res else "COILING",
                    "pivotPrice": round(res, 2),
                    "neckline": round(res, 2),
                    "targetPrice": round(res + (res - lL1), 2),
                    "stopLossPrice": round(lL2 * 0.98, 2),
                })

    return detected


def main():
    if not PARQUET_FILE.exists():
        print(f"Parquet file {PARQUET_FILE} does not exist.")
        return

    import polars as pl

    print("Reading parquet data...")
    cols = ["symbol", "date", "open", "high", "low", "close", "volume", "change_pct", "rs_composite"]
    df = pl.read_parquet(str(PARQUET_FILE), columns=cols)
    print(f"Loaded {len(df)} rows. Processing universe...")

    grouped = df.sort(["symbol", "date"]).partition_by("symbol", as_dict=True)

    pattern_map: dict[str, list[dict]] = defaultdict(list)
    summary_counts: dict[str, int] = defaultdict(int)

    count = 0
    total = len(grouped)

    for (sym,), sdf in grouped.items():
        count += 1
        bars = sdf.to_dicts()
        if len(bars) < 30:
            continue

        patterns = detect_patterns_for_symbol(sym, bars)
        if patterns:
            last = bars[-1]
            for p in patterns:
                summary_counts[p["name"]] += 1
                pattern_map[p["name"]].append({
                    "symbol": sym,
                    "patternName": p["name"],
                    "category": p["category"],
                    "bias": p["bias"],
                    "confidence": p["confidence"],
                    "status": p.get("status", "FORMING"),
                    "currentClose": round(last["close"], 2),
                    "changePct": round(last.get("change_pct") or 0.0, 2),
                    "volume": int(last.get("volume") or 0),
                    "pivotPrice": p.get("pivotPrice"),
                    "neckline": p.get("neckline"),
                    "targetPrice": p.get("targetPrice"),
                    "stopLossPrice": p.get("stopLossPrice"),
                })

        if count % 200 == 0:
            print(f"Scanned {count}/{total} symbols...")

    # Sort each pattern list by confidence desc
    for pat_name in pattern_map:
        pattern_map[pat_name].sort(key=lambda x: (x["confidence"], x["volume"]), reverse=True)

    output_data = {
        "summary": dict(summary_counts),
        "totalSymbols": total,
        "patterns": dict(pattern_map),
    }

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w") as f:
        json.dump(output_data, f, indent=2)

    print(f"\nScan complete! Wrote Buy-Side patterns to {OUTPUT_FILE}")
    print("Summary counts (Buy-Side Only):")
    for k, v in sorted(summary_counts.items(), key=lambda x: x[1], reverse=True):
        print(f"  {k}: {v} matches")


if __name__ == "__main__":
    main()
