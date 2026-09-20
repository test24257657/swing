"""Telegram message builders — pure functions, tested; jobs/telegram.py does the sending.

Two pushes a day, both from data the pipeline already produced:

* **Evening** (after the nightly run): what actually broke out today, what is coiled
  just under its pivot for tomorrow, and any watchlist alert that tripped — under the
  market light, because a breakout in a red market is not the same trade as one in a
  green market.
* **Morning** (with the 8:15 brief): overnight cues, NIFTY levels, stocks in focus.

No intraday push exists on purpose: every price here is end-of-day, so a message
claiming "breaking out now" would be false.
"""

from __future__ import annotations

import os
from datetime import date

MAX_BREAKOUTS = 8
MAX_READY = 5
MAX_FOCUS = 8
LIGHT_EMOJI = {"green": "🟢", "yellow": "🟡", "red": "🔴"}


def _esc(s: object) -> str:
    """Telegram HTML mode: only these three need escaping."""
    return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _num(v, dp: int = 2, plus: bool = False) -> str:
    if v is None:
        return "—"
    return f"{v:+.{dp}f}" if plus else f"{v:,.{dp}f}"


def _site(path: str) -> str:
    base = (os.environ.get("SITE_URL") or "").rstrip("/")
    return f"{base}{path}" if base else ""


def _light_line(market: dict | None) -> str:
    if not market:
        return ""
    return f"{LIGHT_EMOJI.get(market.get('light'), '⚪')} <b>{_esc(market.get('label'))}</b> — {_esc(market.get('advice'))}"


def evening_message(business_date: date, scan: dict, screener: dict, alert_hits: list[dict]) -> str | None:
    """None when there is genuinely nothing to say — better silence than a daily
    message people learn to ignore."""
    market = scan.get("market")
    rs_by_symbol = {
        r["symbol"]: r.get("rs")
        for key in ("ready", "rs_leaders", "pocket_pivots", "delivery_spikes")
        for r in scan.get(key) or []
    }

    breakouts = []
    for row in screener.get("rows") or []:
        p = (row.get("patterns") or [None])[0]
        if not p or p.get("stage") != "confirmed" or p.get("breakout_date") != business_date.isoformat():
            continue
        breakouts.append((row, p))
    breakouts.sort(key=lambda rp: -(rp[1].get("breakout_volume_ratio") or 0))
    breakouts = breakouts[:MAX_BREAKOUTS]

    ready = (scan.get("ready") or [])[:MAX_READY]
    if not breakouts and not ready and not alert_hits:
        return None

    lines = [f"🔔 <b>Close of {business_date.strftime('%d %b')}</b>"]
    light = _light_line(market)
    if light:
        lines.append(light)

    if alert_hits:
        lines.append("\n⚡ <b>Your watchlist alerts</b>")
        for h in alert_hits:
            word = "rose above" if h.get("kind") == "price_above" else "fell below"
            lines.append(f"• <b>{_esc(h['symbol'])}</b> {word} ₹{_num(h.get('threshold'))} (hit ₹{_num(h.get('price'))})")

    if breakouts:
        lines.append(f"\n✅ <b>Broke out today</b> ({len(breakouts)})")
        for row, p in breakouts:
            rs = rs_by_symbol.get(row["symbol"])
            bits = [f"pivot ₹{_num(p.get('pivot_price'))}"]
            if p.get("breakout_volume_ratio"):
                bits.append(f"{p['breakout_volume_ratio']:.1f}× vol")
            if p.get("stop_suggestion"):
                bits.append(f"stop ₹{_num(p['stop_suggestion'])}")
            if rs:
                bits.append(f"RS {rs}")
            lines.append(
                f"• <b>{_esc(row['symbol'])}</b> ₹{_num(row.get('ltp'))} ({_num(row.get('change_pct'), 1, plus=True)}%)"
                f"\n   {_esc(' · '.join(bits))}"
            )

    if ready:
        lines.append("\n⏳ <b>Ready tomorrow</b> — set an alert at the pivot")
        for r in ready:
            lines.append(
                f"• <b>{_esc(r['symbol'])}</b> ₹{_num(r.get('ltp'))} · pivot ₹{_num(r.get('pivot'))}"
                f" ({_num(r.get('gap_to_pivot_pct'), 1, plus=True)}%)"
                + (f" · RS {r['rs']}" if r.get("rs") else "")
                + (" · dry-up" if r.get("dry_up") else "")
            )

    if market and market.get("light") == "red" and (breakouts or ready):
        lines.append("\n⚠️ Market light is red — these are watchlist candidates, not buys.")

    url = _site("/scan")
    if url:
        lines.append(f"\n<a href=\"{url}\">Open Daily Scan</a>")
    lines.append("\n<i>End-of-day data · educational, not investment advice</i>")
    return "\n".join(lines)


def morning_message(brief: dict) -> str | None:
    if not brief or not brief.get("global_cues"):
        return None
    tone = brief.get("global_tone") or {}
    emoji = {"positive": "🟢", "negative": "🔴", "mixed": "🟡"}.get(tone.get("tone"), "⚪")
    lines = [f"☀️ <b>Morning brief · {_esc(brief.get('for_session'))}</b>"]

    ai = brief.get("ai")
    if ai:
        lines.append(f"<b>{_esc(ai.get('headline'))}</b>")
        for p in (ai.get("points") or [])[:3]:
            lines.append(f"• {_esc(p)}")

    cues = {c["label"]: c for c in brief["global_cues"]}
    row = [
        f"{_esc(lbl)} {_num(cues[lbl]['change_pct'], 2, plus=True)}%"
        for lbl in ("S&P 500", "Nasdaq", "Nikkei", "Brent crude", "USD/INR")
        if lbl in cues
    ]
    lines.append(f"\n{emoji} <b>Global cues</b> ({_esc(tone.get('tone'))})\n" + _esc(" · ").join(row))

    n = brief.get("nifty")
    if n:
        lines.append(
            f"\n📊 <b>NIFTY</b> close {_num(n.get('close'))}\n"
            f"R1 {_num(n.get('r1'))} · pivot {_num(n.get('pivot'))} · S1 {_num(n.get('s1'))}"
        )

    focus = (brief.get("focus") or [])[:MAX_FOCUS]
    if focus:
        lines.append("\n👀 <b>In focus</b>\n" + _esc(", ".join(f["symbol"] for f in focus)))

    for e in brief.get("events") or []:
        lines.append(f"\n⚠️ {_esc(e)}")

    checklist = brief.get("checklist") or []
    if checklist:
        lines.append("\n✅ <b>Before you trade</b>")
        lines += [f"• {_esc(c)}" for c in checklist[:3]]

    url = _site("/pulse")
    if url:
        lines.append(f"\n<a href=\"{url}\">Open dashboard</a>")
    lines.append("\n<i>End-of-day + pre-market data · educational, not investment advice</i>")
    return "\n".join(lines)
