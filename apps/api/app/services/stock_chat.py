# ruff: noqa: E501 — the prompt and context lines are prose; wrapping them hurts readability
"""Stock chat — answers a trader's questions about one stock from the nightly data.

Two halves, deliberately separated:

* ``build_context`` gathers everything the store knows about the symbol and does
  **all the arithmetic in Python** — move since a block deal, distance past the pivot,
  risk to the stop, reward-to-risk. LLMs are unreliable at arithmetic, and a wrong
  percentage here is a wrong trade, so the model is handed finished numbers and told
  to quote them, never to compute its own.
* ``SYSTEM_PROMPT`` pins the model to that context: no outside knowledge, no invented
  figures, an explicit reasoning order, and a fixed answer shape.
"""

from __future__ import annotations

from datetime import date

from app import store

MAX_DEALS = 8
MAX_NEWS = 5
MAX_QUARTERS = 4
RECENT_CLOSES = 10
# Past this far above the pivot a breakout is "extended" — same threshold as
# jobs/patterns/stage.py, so the chat and the screener never disagree.
EXTENDED_PCT = 5.0


def _pct(a: float | None, b: float | None) -> float | None:
    """% change from b to a."""
    if a is None or b is None or b == 0:
        return None
    return round((a / b - 1.0) * 100.0, 2)


def _fmt(v: float | None, suffix: str = "") -> str:
    if v is None:
        return "n/a"
    return f"{v:+.2f}{suffix}" if suffix == "%" else f"{v:,.2f}{suffix}"


def build_context(symbol: str) -> tuple[str, list[str]] | None:
    """(context text for the model, list of data sections actually present).
    None when the store has nothing at all for this symbol."""
    sym = symbol.upper()
    chart = store.chart(sym)
    quote = store.quote(sym)
    if not chart and not quote:
        return None

    sections: list[str] = []
    used: list[str] = []
    bars = (chart or {}).get("bars") or []
    ltp = (quote or {}).get("ltp") or (bars[-1]["close"] if bars else None)
    name = (quote or {}).get("name") or (chart or {}).get("name") or sym
    as_of = (chart or {}).get("as_of") or store.meta().get("as_of")

    # --- price ------------------------------------------------------------------
    lines = [f"Symbol: {sym} ({name})", f"Data as of: {as_of}", f"Last close (LTP): ₹{_fmt(ltp)}"]
    if quote and quote.get("change_pct") is not None:
        lines.append(f"Change on the day: {_fmt(quote['change_pct'], '%')}")
    if bars:
        closes = [b["close"] for b in bars]
        year = bars[-252:]
        hi = max(b["high"] for b in year)
        lo = min(b["low"] for b in year)
        lines += [
            f"52-week high: ₹{_fmt(hi)} (price is {_fmt(_pct(ltp, hi), '%')} from it)",
            f"52-week low: ₹{_fmt(lo)} (price is {_fmt(_pct(ltp, lo), '%')} from it)",
        ]
        for n, label in ((5, "1 week"), (21, "1 month"), (63, "3 months")):
            if len(closes) > n:
                lines.append(f"Return over {label}: {_fmt(_pct(closes[-1], closes[-1 - n]), '%')}")
        recent = bars[-RECENT_CLOSES:]
        lines.append(
            "Last sessions (date close volume delivery%): "
            + "; ".join(
                f"{b['time']} ₹{b['close']} vol {b['volume']:,}"
                + (f" del {b['delivery_pct']}%" if b.get("delivery_pct") is not None else "")
                for b in recent
            )
        )
    sections.append("## PRICE\n" + "\n".join(lines))
    used.append("price")

    # --- technicals -------------------------------------------------------------
    t = (chart or {}).get("technicals") or {}
    if t:
        sections.append(
            "## TECHNICALS\n"
            f"RSI(14): {t.get('rsi_14')}\n"
            f"ATR as % of price (typical daily range): {t.get('atr_pct')}%\n"
            f"Today's volume vs 20-day average: {t.get('rel_volume_20d')}x\n"
            f"Distance from 20-day average: {_fmt(t.get('dist_20dma_pct'), '%')}\n"
            f"Distance from 50-day average: {_fmt(t.get('dist_50dma_pct'), '%')}\n"
            f"Distance from 200-day average: {_fmt(t.get('dist_200dma_pct'), '%')}"
        )
        used.append("technicals")

    # --- setup pattern ----------------------------------------------------------
    row = next((r for r in (store.screener().get("rows") or []) if r.get("symbol") == sym), None)
    patterns = (row or {}).get("patterns") or []
    if patterns:
        plines = []
        for p in patterns:
            pivot, stop, target = p.get("pivot_price"), p.get("stop_suggestion"), p.get("target_suggestion")
            gap = _pct(ltp, pivot)
            risk = _pct(stop, ltp)
            reward = _pct(target, ltp)
            rr = round(reward / abs(risk), 2) if (risk and reward is not None and risk < 0) else None
            extended = gap is not None and gap > EXTENDED_PCT
            plines.append(
                f"- Pattern {p.get('code')} | stage {p.get('stage')} | confidence {p.get('confidence')}\n"
                f"  pivot (buy trigger) ₹{_fmt(pivot)}; price is {_fmt(gap, '%')} vs pivot"
                f"{' — EXTENDED (more than 5% past the pivot)' if extended else ''}\n"
                f"  suggested stop ₹{_fmt(stop)} = {_fmt(risk, '%')} from price\n"
                f"  target ₹{_fmt(target)} = {_fmt(reward, '%')} from price\n"
                f"  reward-to-risk from today's price: {rr if rr is not None else 'n/a'}\n"
                f"  base started {p.get('base_start_date')}; breakout date {p.get('breakout_date') or 'none yet'}"
            )
        sections.append("## SETUP PATTERN (rule-based screener)\n" + "\n".join(plines))
        used.append("pattern")
    else:
        sections.append("## SETUP PATTERN\nNo rule-based setup pattern detected on this stock tonight.")

    # --- institutional deals ----------------------------------------------------
    inst = store.institutional() or {}
    deals = sorted(
        (d for d in (inst.get("deals") or []) if d.get("symbol") == sym),
        key=lambda d: d.get("date") or "",
        reverse=True,
    )[:MAX_DEALS]
    if deals:
        # A client that both BUYS and SELLS the same stock on the same day is an
        # intraday/arbitrage desk turning over inventory, not an investor accumulating.
        # Flag it here rather than trusting the model to spot it.
        sides: dict[tuple[str, str], set[str]] = {}
        for d in deals:
            sides.setdefault((d.get("date"), d.get("client")), set()).add(d.get("side"))
        net_buy_cr = 0.0
        dlines = []
        for d in deals:
            since = _pct(ltp, d.get("price"))
            churn = sides.get((d.get("date"), d.get("client"))) == {"BUY", "SELL"}
            value_cr = (d.get("value") or 0) / 1e7
            if not churn:
                net_buy_cr += value_cr if d.get("side") == "BUY" else -value_cr
            dlines.append(
                f"- {d.get('date')}: {d.get('side')} {d.get('kind')} deal by {d.get('client')} — "
                f"{d.get('qty'):,} shares at ₹{_fmt(d.get('price'))} (≈₹{value_cr:,.1f} cr); "
                f"price has moved {_fmt(since, '%')} since that deal price"
                + (" — OFFSETTING: same client bought AND sold this day (intraday/arbitrage, NOT accumulation)" if churn else "")
            )
        dlines.append(
            f"Net value of genuine (non-offsetting) deals: ₹{net_buy_cr:+,.1f} cr "
            f"({'net buying' if net_buy_cr > 0 else 'net selling' if net_buy_cr < 0 else 'none — all deals offset'})"
        )
        sections.append("## BULK / BLOCK DEALS (NSE disclosures)\n" + "\n".join(dlines))
        used.append("deals")
    pick = next((m for m in (inst.get("ai_money_flow") or []) if m.get("symbol") == sym), None)
    if pick:
        sections.append(f"## NIGHTLY MONEY-FLOW PICK\nConviction {pick.get('conviction')}: {pick.get('rationale')}")

    # --- F&O --------------------------------------------------------------------
    fno = store.fno(sym) or {}
    if fno.get("buildup") or fno.get("option_chain"):
        b = fno.get("buildup") or {}
        oc = fno.get("option_chain") or {}
        sections.append(
            "## F&O POSITIONING\n"
            f"Futures buildup: {b.get('label')} — {b.get('note')} "
            f"(price {_fmt(b.get('price_chg_pct'), '%')}, open interest {_fmt(b.get('oi_chg_pct'), '%')})\n"
            f"Option chain {oc.get('expiry')}: put-call ratio {oc.get('pcr')}; "
            f"biggest call OI (resistance) at ₹{oc.get('max_call_oi_strike')}; "
            f"biggest put OI (support) at ₹{oc.get('max_put_oi_strike')}"
        )
        used.append("fno")

    # --- fundamentals -----------------------------------------------------------
    quarters = ((store.fundamentals(sym) or {}).get("quarters") or [])[-MAX_QUARTERS:]
    if quarters:
        sections.append(
            "## QUARTERLY RESULTS (filed with NSE)\n"
            + "\n".join(
                f"- {q.get('label')}: revenue ₹{q.get('revenue_cr')} cr (QoQ {_fmt(q.get('revenue_qoq_pct'), '%')}), "
                f"net profit ₹{q.get('net_income_cr')} cr (QoQ {_fmt(q.get('net_income_qoq_pct'), '%')}), EPS {q.get('eps')}"
                for q in quarters
            )
        )
        used.append("fundamentals")

    # --- news -------------------------------------------------------------------
    news = [n for n in ((store.news() or {}).get("items") or []) if n.get("symbol") == sym][:MAX_NEWS]
    if news:
        sections.append(
            "## RECENT ANNOUNCEMENTS\n"
            + "\n".join(
                f"- {n.get('date')} [{n.get('category')}, impact {n.get('impact', 'unclassified')}]: {n.get('headline')}"
                for n in news
            )
        )
        used.append("news")

    # --- sector -----------------------------------------------------------------
    for s in (store.sectors() or {}).get("sectors") or []:
        if any(c.get("symbol") == sym for c in s.get("constituents") or []):
            sections.append(
                "## SECTOR\n"
                f"{s.get('name')}: rank {s.get('rank')} of {len(store.sectors()['sectors'])} by 1-month momentum "
                f"(rank change {s.get('rank_delta')}); returns 1W {_fmt(s.get('return_1w'), '%')}, "
                f"1M {_fmt(s.get('return_1m'), '%')}, 3M {_fmt(s.get('return_3m'), '%')}"
            )
            used.append("sector")
            break

    # --- market backdrop --------------------------------------------------------
    outlook = store.weekly_outlook() or {}
    if outlook.get("market_view"):
        mv = outlook["market_view"]
        sections.append(f"## MARKET BACKDROP (weekly AI outlook)\n{mv.get('direction')}: {mv.get('rationale')}")
        used.append("market")

    return "\n\n".join(sections), used


SYSTEM_PROMPT = """You are a senior swing-trading analyst for Indian equities (NSE), sitting beside a retail \
trader who is looking at one stock's chart. Your job is to help them make a clear, disciplined decision — \
not to hype, and not to hedge everything into mush.

TODAY: {today}

# HARD RULES — never break these
1. Use ONLY the data in the STOCK DATA block below. You have no internet, no live prices, and no memory of \
this company beyond that block. If something is not in the data, say plainly "that isn't in the data I have" \
— never fill the gap from general knowledge, and never guess a number.
2. Every number you state must appear in the STOCK DATA block. All percentages, distances, risk and \
reward-to-risk figures are ALREADY CALCULATED for you — quote them exactly. Do NOT do your own arithmetic.
3. Never promise outcomes or use words like "sure shot", "guaranteed", "will definitely". Markets are \
probabilistic; talk in terms of setups, risk and odds.
4. Never give a bare "buy" or "sell" instruction. Give a verdict framed as a plan with conditions, e.g. \
"Wait — better entry near ₹X" or "Valid entry only above ₹X with a stop at ₹Y".
5. Data is from the last nightly run (see "Data as of"). If the user asks about today's live move, say the \
data is end-of-day and may already be out of date.
6. Answer in simple English a beginner understands. Explain any term in a few words the first time (for \
example "pivot = the breakout level").
7. Stay on this stock and trading. Politely decline anything unrelated.

# HOW TO THINK (do this silently before answering)
1. Trend: where is price vs its 20/50/200-day averages and its 52-week high/low? Up, down, or sideways?
2. Setup: is there a pattern? What stage — forming, confirmed, or extended? How far is price from the pivot?
3. Timing — the most common mistake is chasing. If price is EXTENDED (>5% past the pivot) or has run far \
since a big deal, the entry is late: risk to the stop is wide and reward-to-risk is poor. Say so directly.
4. Risk: where is the stop, what % is that from price, and what is reward-to-risk? Below ~2 is weak.
5. Confirmation: volume vs average, delivery %, RSI (>70 = stretched, <30 = weak), F&O buildup.
6. Big players: a BUY deal is meaningful mainly when it is large or repeated by the same client. A single \
deal can be a one-off. A SELL deal by a promoter/insider is a caution flag. Note where price is vs the deal price.
7. Fundamentals & news: do results show growth in both revenue and profit? Any announcement that changes the story?
8. Weigh the evidence both ways. Name the strongest point FOR and the strongest AGAINST.

# ANSWER FORMAT (use these exact headings, markdown, keep it tight — about 150-250 words total)
**Verdict:** one line — e.g. "Wait for a pullback", "Valid setup — entry above ₹X", "Avoid for now", \
"Not enough data to judge".

**Why:**
- 3-5 short bullets, each tied to a specific number from the data.

**Plan:**
- Entry: the price or condition to act on.
- Stop: the price, and the % risk.
- Target: the price, and reward-to-risk.
(If the data has no pattern/stop/target, say so and suggest what to watch instead — do not invent levels.)

**Risks:** 1-2 bullets on what would prove this wrong.

For simple follow-up questions (e.g. "what is RSI?", "what does delivery % mean?") skip the format and just \
answer in 2-4 sentences.

End every full analysis with this exact line:
_Educational read from end-of-day data, not investment advice._

# STOCK DATA
{context}
"""


def system_prompt(context: str, today: date) -> str:
    return SYSTEM_PROMPT.format(context=context, today=today.isoformat())
