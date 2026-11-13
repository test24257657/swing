"""
pipeline/notify/telegram.py
Personal Telegram Bot alerts — opt-in (no-op if tokens missing).

Evening alert: Top 5 Picks + pattern breakouts
Morning alert: Morning Brief summary
"""

from __future__ import annotations

import html
import logging
import urllib.parse
import urllib.request
from typing import Optional

from pipeline.config import TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, TELEGRAM_MAX_MSG_LEN

log = logging.getLogger("pipeline.notify")

_TG_URL = "https://api.telegram.org/bot{token}/sendMessage"


def _send(text: str) -> bool:
    """Send a Telegram message. Returns True on success."""
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        log.debug("Telegram not configured — skipping notification")
        return False

    # Split long messages at blank lines
    chunks = _split_message(text, TELEGRAM_MAX_MSG_LEN)

    for chunk in chunks:
        payload = urllib.parse.urlencode({
            "chat_id": TELEGRAM_CHAT_ID,
            "text": chunk,
            "parse_mode": "HTML",
            "disable_web_page_preview": "true",
        }).encode()

        url = _TG_URL.format(token=TELEGRAM_BOT_TOKEN)
        req = urllib.request.Request(url, data=payload, method="POST")

        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                if resp.status != 200:
                    log.warning("Telegram returned HTTP %d", resp.status)
                    return False
        except Exception as exc:
            log.warning("Telegram send failed: %s", exc)
            return False

    return True


def _split_message(text: str, max_len: int) -> list[str]:
    """Split message at blank lines, keeping chunks under max_len."""
    if len(text) <= max_len:
        return [text]

    paragraphs = text.split("\n\n")
    chunks = []
    current = ""

    for para in paragraphs:
        if len(current) + len(para) + 2 > max_len:
            if current:
                chunks.append(current.strip())
            current = para
        else:
            current = (current + "\n\n" + para).strip() if current else para

    if current:
        chunks.append(current.strip())

    return chunks


def esc(s: str) -> str:
    """HTML-escape a string for Telegram HTML parse mode."""
    return html.escape(str(s))


def send_evening_alert(
    picks: list[dict],
    breakouts: list[dict],
    market_regime: str,
    fii_net: Optional[float] = None,
) -> bool:
    """
    Send the evening alert after the nightly pipeline completes.

    picks: Top 5 AI picks [{symbol, reason, rank}]
    breakouts: Today's pattern signals [{symbol, pattern, pivot, stop}]
    market_regime: "CONFIRMED_UPTREND" | "UPTREND_UNDER_PRESSURE" | "PULLBACK_SWING" | "CORRECTION_CASH"
    """
    if not picks and not breakouts:
        log.info("Nothing to report — skipping evening Telegram alert")
        return False

    regime_emoji = {
        "CONFIRMED_UPTREND": "🟢",
        "UPTREND_UNDER_PRESSURE": "🟡",
        "PULLBACK_SWING": "🟠",
        "CORRECTION_CASH": "🔴",
        # Legacy keys (backward compat)
        "Bull": "🟢", "Bear": "🔴", "Sideways": "🟡",
    }.get(market_regime, "⚪")

    lines = [
        f"<b>📈 Swing Terminal v2 — Evening Alert</b>",
        f"{regime_emoji} Market: <b>{esc(market_regime)}</b>" +
        (f" · FII: ₹{fii_net:+,.0f} Cr" if fii_net is not None else ""),
        "",
    ]

    if picks:
        lines.append("<b>🎯 AI Top 5 Swing Picks</b>")
        for p in picks:
            rank = p.get("rank", "?")
            sym = esc(p.get("symbol", "?"))
            reason = esc(p.get("reason", ""))
            lines.append(f"{rank}. <b>{sym}</b> — {reason}")
        lines.append("")

    if breakouts:
        lines.append(f"<b>🚀 Today's Pattern Signals ({len(breakouts)})</b>")
        for b in breakouts[:8]:  # Show max 8
            sym = esc(b.get("symbol", "?"))
            pat = esc(b.get("pattern", "?").replace("_", " "))
            pivot = b.get("pivot")
            stop = b.get("stop")
            pivot_str = f"₹{pivot:,.2f}" if pivot else "—"
            stop_str = f"₹{stop:,.2f}" if stop else "—"
            lines.append(f"• <b>{sym}</b> [{pat}] Pivot {pivot_str} · Stop {stop_str}")
        if len(breakouts) > 8:
            lines.append(f"  <i>+{len(breakouts) - 8} more signals...</i>")
        lines.append("")

    lines.append(
        "<i>EOD data only. Verify on broker before trading. "
        "Not SEBI-registered advice.</i>"
    )

    return _send("\n".join(lines))


def send_morning_alert(brief: dict) -> bool:
    """
    Send the morning brief summary via Telegram.

    brief: {"headline": ..., "bullets": [...], "bias": ...}
    """
    headline = esc(brief.get("headline", "Morning Brief"))
    bullets = brief.get("bullets", [])
    bias = esc(brief.get("bias", "Neutral"))

    bias_emoji = {
        "Bullish": "🟢", "Cautious-Bullish": "🟡",
        "Neutral": "⚪", "Cautious": "🟠", "Bearish": "🔴",
    }.get(brief.get("bias", "Neutral"), "⚪")

    lines = [
        f"<b>☀️ Morning Brief — {brief.get('date', '')}</b>",
        f"<i>{headline}</i>",
        "",
    ]

    for bullet in bullets:
        lines.append(f"• {esc(bullet)}")

    lines.extend([
        "",
        f"<b>Bias:</b> {bias_emoji} {bias}",
        "",
        "<i>For education only. Not investment advice.</i>",
    ])

    return _send("\n".join(lines))
