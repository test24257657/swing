"use client";

import { useMemo, useState } from "react";

import { ExternalLink } from "lucide-react";

import { Card } from "@/components/ui";
import type { ChartBar, FundamentalsData, NewsItem, PatternMatch, Technicals } from "@/lib/api/market-types";
import { cn } from "@/lib/cn";
import { direction, pct, price } from "@/lib/format";
import { safeGridCols } from "@/lib/grid";
import { IMPACT_META } from "@/lib/news-impact";
import type { Tone } from "@/lib/tone";

function toneClass(v: number | null | undefined) {
  const d = direction(v);
  return d === "up" ? "text-up-text" : d === "down" ? "text-down-text" : "text-text-secondary";
}

/** One plain-English read combining every indicator on the page — trend (price vs the
 * three DMAs), momentum (RSI), volume, and the active setup pattern's stage, if any —
 * so the six numbers in the snapshot below resolve into a single "what does this mean"
 * instead of leaving that synthesis to the reader. */
export function technicalVerdict(t: Technicals, pattern: PatternMatch | null): { label: string; note: string; tone: Tone } {
  if (pattern?.stage === "confirmed") {
    return {
      label: "Bullish — breakout confirmed",
      tone: "up",
      note: "A setup just confirmed on above-average volume — trend and pattern agree.",
    };
  }

  const above20 = t.dist_20dma_pct != null && t.dist_20dma_pct > 0;
  const above50 = t.dist_50dma_pct != null && t.dist_50dma_pct > 0;
  const above200 = t.dist_200dma_pct != null && t.dist_200dma_pct > 0;
  const knownShort = t.dist_20dma_pct != null && t.dist_50dma_pct != null;
  const aboveAll = knownShort && above20 && above50 && (t.dist_200dma_pct == null || above200);
  const belowAll = knownShort && !above20 && !above50 && (t.dist_200dma_pct == null || !above200);
  const overbought = t.rsi_14 != null && t.rsi_14 >= 70;
  const oversold = t.rsi_14 != null && t.rsi_14 <= 30;
  const highVolume = t.rel_volume_20d != null && t.rel_volume_20d >= 1.5;
  const volNote = highVolume ? " Volume is running above average, backing the move." : "";

  if (aboveAll && overbought) {
    return {
      label: "Bullish, but extended",
      tone: "neutral",
      note: "Price is above all its moving averages, but RSI is overbought — a pause or pullback wouldn't be unusual before the next leg.",
    };
  }
  if (aboveAll) {
    return {
      label: "Bullish trend",
      tone: "up",
      note: `Price is above the 20/50${t.dist_200dma_pct != null ? "/200" : ""}-day averages — the trend is up.${volNote}`,
    };
  }
  if (belowAll && oversold) {
    return {
      label: "Bearish, but oversold",
      tone: "neutral",
      note: "Price is below all its moving averages, but RSI is oversold — a bounce wouldn't be unusual before the next leg down.",
    };
  }
  if (belowAll) {
    return {
      label: "Bearish trend",
      tone: "down",
      note: `Price is below the 20/50${t.dist_200dma_pct != null ? "/200" : ""}-day averages — the trend is down.${volNote}`,
    };
  }
  if (above200 && !aboveAll) {
    return {
      label: "Uptrend, short-term pullback",
      tone: "up",
      note: "Above the 200-day average (long-term uptrend intact) but below one or both shorter averages — a dip within the trend, not a reversal yet.",
    };
  }
  if (!above200 && t.dist_200dma_pct != null && !belowAll) {
    return {
      label: "Downtrend, short-term bounce",
      tone: "down",
      note: "Below the 200-day average (long-term downtrend intact) but above one or both shorter averages — a bounce within the trend, not a reversal yet.",
    };
  }
  return {
    label: "No clear trend",
    tone: "neutral",
    note: "Price is chopping around its moving averages with no consistent direction — wait for a clearer signal.",
  };
}

const TECH_ROWS: {
  key: keyof Technicals;
  label: string;
  tip: string;
  format: (v: number) => string;
  bar: (v: number) => number; // 0-100
  tone: (v: number) => "up" | "down" | "neutral";
}[] = [
  {
    key: "rsi_14",
    label: "RSI (14)",
    tip: "Relative Strength Index — above 70 is typically overbought, below 30 oversold.",
    format: (v) => v.toFixed(1),
    bar: (v) => v,
    tone: (v) => (v >= 70 ? "down" : v <= 30 ? "up" : "neutral"),
  },
  {
    key: "atr_pct",
    label: "ATR %",
    tip: "Average True Range as a percent of price — a volatility measure, used for stop distance.",
    format: (v) => `${v.toFixed(2)}%`,
    bar: (v) => Math.min((v / 8) * 100, 100),
    tone: () => "neutral",
  },
  {
    key: "rel_volume_20d",
    label: "Rel. volume",
    tip: "Today's volume as a multiple of the trailing 20-session average.",
    format: (v) => `${v.toFixed(2)}×`,
    bar: (v) => Math.min((v / 3) * 100, 100),
    tone: (v) => (v >= 1.5 ? "up" : "neutral"),
  },
  {
    key: "dist_20dma_pct",
    label: "vs 20 DMA",
    tip: "Percent above/below the 20-day moving average.",
    format: (v) => pct(v),
    bar: (v) => Math.min(Math.max(50 + v * 2, 0), 100),
    tone: (v) => (v >= 0 ? "up" : "down"),
  },
  {
    key: "dist_50dma_pct",
    label: "vs 50 DMA",
    tip: "Percent above/below the 50-day moving average.",
    format: (v) => pct(v),
    bar: (v) => Math.min(Math.max(50 + v * 2, 0), 100),
    tone: (v) => (v >= 0 ? "up" : "down"),
  },
  {
    key: "dist_200dma_pct",
    label: "vs 200 DMA",
    tip: "Percent above/below the 200-day moving average — the long-term trend line.",
    format: (v) => pct(v),
    bar: (v) => Math.min(Math.max(50 + v * 2, 0), 100),
    tone: (v) => (v >= 0 ? "up" : "down"),
  },
];

const BAR_COLOR = { up: "var(--color-up)", down: "var(--color-down)", neutral: "var(--color-accent)" };

export function TechnicalSnapshot({ technicals, asOf }: { technicals: Technicals; asOf: string | null }) {
  return (
    <Card className="p-4">
      <div className="mb-2.5 text-[13px] font-semibold">Technical snapshot</div>
      {TECH_ROWS.map((row) => {
        const v = technicals[row.key];
        if (v == null) return null;
        const tone = row.tone(v);
        return (
          <div key={row.key} className="grid grid-cols-[minmax(0,1fr)_64px_minmax(0,1fr)] items-center gap-2.5 border-b border-border py-1.5 last:border-0">
            <span className="truncate text-[12px] text-text-secondary" title={row.tip}>
              {row.label}
            </span>
            <span className={cn("tnum text-right text-[13px] font-medium", tone === "neutral" ? "text-text" : toneClass(tone === "up" ? 1 : -1))}>
              {row.format(v)}
            </span>
            <div className="h-1 rounded-full bg-surface-2">
              <div className="h-1 rounded-full opacity-80" style={{ width: `${row.bar(v)}%`, background: BAR_COLOR[tone] }} />
            </div>
          </div>
        );
      })}
      <div className="mt-2 font-mono text-[11px] text-text-faint">derived · EOD {asOf}</div>
    </Card>
  );
}

export function DeliveryTrend({ bars }: { bars: ChartBar[] }) {
  const recent = bars.filter((b) => b.delivery_pct != null).slice(-20);
  if (recent.length === 0) return null;
  const values = recent.map((b) => b.delivery_pct as number);
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  const today = values.at(-1)!;
  const max = Math.max(...values, avg);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="text-[13px] font-semibold">Delivery trend · {recent.length} sessions</div>
        <div className="tnum text-[11px] text-text-secondary">
          avg {avg.toFixed(0)}% · today <span className={toneClass(today - avg)}>{today.toFixed(0)}%</span>
        </div>
      </div>
      <div className="mt-2.5 flex h-16 items-end gap-1">
        {recent.map((b, i) => (
          <div
            key={b.time}
            className="flex-1 rounded-t-sm"
            style={{
              height: `${Math.max(((values[i] ?? 0) / max) * 100, 3)}%`,
              background: (values[i] ?? 0) >= avg ? "var(--color-up)" : "var(--color-border)",
              opacity: 0.85,
            }}
            title={`${b.time}: ${values[i].toFixed(1)}%`}
          />
        ))}
      </div>
      <div className="mt-2 font-mono text-[11px] text-text-faint">source: NSE security-wise delivery data</div>
    </Card>
  );
}

export function FundamentalsCard({ data }: { data: FundamentalsData }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="text-[13px] font-semibold">Fundamentals · last {data.quarters.length} quarters</div>
        <div className="text-[11px] text-text-muted">₹cr · QoQ</div>
      </div>
      <div className="mt-2.5 overflow-x-auto">
        <div
          className="grid min-w-[300px] gap-1.5"
          style={{ gridTemplateColumns: safeGridCols(`1fr repeat(${data.quarters.length}, 1fr)`) }}
        >
          <div />
          {data.quarters.map((q) => (
            <div key={q.label} className="text-right text-[11px] text-text-muted">
              {q.label}
            </div>
          ))}
          <div className="self-center text-[12px] text-text-secondary">Revenue</div>
          {data.quarters.map((q) => (
            <QuarterCell key={q.label} value={q.revenue_cr} qoq={q.revenue_qoq_pct} />
          ))}
          <div className="self-center text-[12px] text-text-secondary">Net income</div>
          {data.quarters.map((q) => (
            <QuarterCell key={q.label} value={q.net_income_cr} qoq={q.net_income_qoq_pct} />
          ))}
        </div>
      </div>
      <div className="mt-2.5 font-mono text-[11px] text-text-faint">source: yfinance · quarterly income statement</div>
    </Card>
  );
}

function QuarterCell({ value, qoq }: { value: number | null; qoq: number | null }) {
  if (value == null) return <div className="text-right text-[12px] text-text-faint">—</div>;
  return (
    <div className="text-right">
      <div className="tnum text-[12px]">{value.toLocaleString("en-IN")}</div>
      {qoq != null && <div className={cn("tnum text-[10px]", toneClass(qoq))}>{pct(qoq)}</div>}
    </div>
  );
}

export function PositionSizing({ lastClose, atrPct, pattern }: { lastClose: number | null; atrPct: number | null; pattern: PatternMatch | null }) {
  const [capital, setCapital] = useState(100000);
  const [riskPct, setRiskPct] = useState(1);
  const [entry, setEntry] = useState<number | null>(lastClose);
  const [stop, setStop] = useState<number | null>(pattern?.stop_suggestion ?? (lastClose && atrPct ? Number((lastClose * (1 - (atrPct * 1.5) / 100)).toFixed(2)) : null));

  const result = useMemo(() => {
    if (!entry || !stop || entry <= stop) return null;
    const riskPerShare = entry - stop;
    const riskAmount = capital * (riskPct / 100);
    const shares = Math.floor(riskAmount / riskPerShare);
    const positionValue = shares * entry;
    return { riskPerShare, riskAmount, shares, positionValue, pctOfCapital: capital ? (positionValue / capital) * 100 : 0 };
  }, [entry, stop, capital, riskPct]);

  return (
    <Card className="p-4">
      <div className="text-[13px] font-semibold">Volatility &amp; position sizing</div>
      <div className="mt-2.5 grid grid-cols-2 gap-2.5">
        <Field label="Capital (₹)" value={capital} onChange={setCapital} />
        <Field label="Risk per trade (%)" value={riskPct} onChange={setRiskPct} step={0.1} />
        <Field label="Entry (₹)" value={entry} onChange={setEntry} step={0.05} />
        <Field label="Stop (₹)" value={stop} onChange={setStop} step={0.05} />
      </div>
      {result ? (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Stat label="Shares" value={result.shares.toLocaleString("en-IN")} />
          <Stat label="Position value" value={price(result.positionValue)} />
          <Stat label="% of capital" value={`${result.pctOfCapital.toFixed(1)}%`} />
        </div>
      ) : (
        <p className="mt-3 text-[12px] text-text-muted">Entry must be above stop to size a position.</p>
      )}
      <div className="mt-2.5 text-[11px] leading-relaxed text-text-muted">
        Risk per share {result ? price(result.riskPerShare) : "—"} · risking {price(result ? result.riskAmount : null)} of capital on this
        trade.
      </div>
    </Card>
  );
}

/** Recent announcements for this symbol, filtered client-side from the shared news
 * artifact (it's already scoped to the interesting universe, so no extra fetch). */
export function StockAnnouncements({ items }: { items: NewsItem[] }) {
  if (items.length === 0) return null;
  return (
    <Card className="p-4">
      <div className="text-[13px] font-semibold">Recent announcements</div>
      <div className="mt-2.5 flex flex-col gap-2">
        {items.slice(0, 5).map((n, i) => {
          const meta = IMPACT_META[n.impact];
          return (
            <div key={`${n.date}-${n.time}-${i}`} className="flex overflow-hidden rounded-md border border-border">
              <div className="w-1 flex-none" style={{ background: meta.bar }} />
              <div className="min-w-0 flex-1 p-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap"
                    style={{ color: meta.fg, background: meta.bg, borderColor: meta.bd }}
                  >
                    {meta.icon} {meta.label}
                  </span>
                  <span className="font-mono text-[11px] text-text-faint">
                    {n.date} · {n.time}
                  </span>
                  {n.filing_url && (
                    <a
                      href={n.filing_url}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-auto flex items-center gap-1 text-[11px] font-medium text-accent hover:text-accent-hover"
                    >
                      Filing <ExternalLink size={11} />
                    </a>
                  )}
                </div>
                <div className="mt-1.5 text-[13px] font-medium leading-snug">{n.headline}</div>
                {n.summary && <div className="mt-1 text-[12px] leading-relaxed text-text-secondary">{n.summary}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function Field({ label, value, onChange, step = 1 }: { label: string; value: number | null; onChange: (v: number) => void; step?: number }) {
  return (
    <label className="block">
      <span className="text-[11px] text-text-muted">{label}</span>
      <input
        type="number"
        step={step}
        value={value ?? ""}
        onChange={(e) => onChange(Number(e.target.value))}
        className="tnum mt-1 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-[13px] outline-none focus:border-accent"
      />
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-surface-2 px-2.5 py-2">
      <div className="text-[11px] text-text-muted">{label}</div>
      <div className="tnum mt-0.5 text-[13px] font-medium">{value}</div>
    </div>
  );
}
