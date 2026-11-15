"use client";

/**
 * MarketBreadthSection — Full Market Breadth Dashboard
 * Design: clean white cards, violet accent (#7c3aed), JetBrains Mono
 * Charts: lightweight-charts v5 for time-series, SVG for sparklines/bars
 */

import React, { useEffect, useRef, useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  BarChart2,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  XCircle,
  Target,
  Zap,
  Eye,
} from "lucide-react";

// ─── Utility helpers ───────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

function formatCr(v: number) {
  const abs = Math.abs(Math.round(v));
  return `${v >= 0 ? "+" : "−"}₹${abs.toLocaleString("en-IN")} Cr`;
}

/** Percentage progress bar (tailwind-safe, inline style for dynamic width) */
function PctBar({
  value,
  max = 100,
  color = "#7c3aed",
  height = 6,
}: {
  value: number;
  max?: number;
  color?: string;
  height?: number;
}) {
  const pct = clamp((value / max) * 100, 0, 100);
  return (
    <div
      className="w-full rounded-full overflow-hidden bg-slate-200"
      style={{ height }}
    >
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

// ─── Inline SVG Sparkline ─────────────────────────────────────────────────

function Sparkline({
  data,
  color,
  height = 36,
  width = 90,
  filled = false,
}: {
  data: number[];
  color: string;
  height?: number;
  width?: number;
  filled?: boolean;
}) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const toY = (v: number) =>
    height - 2 - ((v - min) / range) * (height - 4);
  const step = width / (data.length - 1);
  const pts = data.map((v, i) => `${(i * step).toFixed(1)},${toY(v).toFixed(1)}`).join(" ");
  const id = `spk-${color.replace("#", "")}-${Math.random().toString(36).slice(2, 6)}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
    >
      {filled && (
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
      )}
      {filled && (
        <polygon
          points={`0,${height} ${pts} ${((data.length - 1) * step).toFixed(1)},${height}`}
          fill={`url(#${id})`}
        />
      )}
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={filled ? 2 : 1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ─── Multi-line area chart (SVG, responsive) ─────────────────────────────

interface LineData {
  values: number[];
  color: string;
  fill?: boolean;
}

function MultiLineChart({
  lines,
  height = 100,
  labels,
}: {
  lines: LineData[];
  height: number;
  labels?: string[];
}) {
  if (!lines[0]?.values?.length) return null;
  const allVals = lines.flatMap((l) => l.values);
  const minV = Math.min(...allVals) * 0.95;
  const maxV = Math.max(...allVals) * 1.05;
  const range = maxV - minV || 1;
  const n = lines[0].values.length;
  const W = 500; // viewBox width, scales with CSS

  const toX = (i: number) => (i / (n - 1)) * W;
  const toY = (v: number) => height - ((v - minV) / range) * (height - 8) - 4;

  return (
    <svg
      viewBox={`0 0 ${W} ${height}`}
      className="w-full overflow-visible"
      preserveAspectRatio="none"
      style={{ height }}
    >
      <defs>
        {lines.map((l, i) =>
          l.fill ? (
            <linearGradient key={i} id={`mlg-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={l.color} stopOpacity="0.2" />
              <stop offset="100%" stopColor={l.color} stopOpacity="0" />
            </linearGradient>
          ) : null
        )}
      </defs>
      {/* Horizontal grid lines */}
      {[25, 50, 75].map((pct) => {
        const y = toY(minV + (range * pct) / 100);
        return (
          <line
            key={pct}
            x1={0}
            y1={y}
            x2={W}
            y2={y}
            stroke="#e2e8f0"
            strokeWidth={0.8}
            strokeDasharray="4 4"
          />
        );
      })}
      {lines.map((l, i) => {
        const pts = l.values.map((v, j) => `${toX(j).toFixed(1)},${toY(v).toFixed(1)}`).join(" ");
        const fillPts = `0,${height} ${pts} ${W},${height}`;
        return (
          <g key={i}>
            {l.fill && (
              <polygon points={fillPts} fill={`url(#mlg-${i})`} />
            )}
            <polyline
              points={pts}
              fill="none"
              stroke={l.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </g>
        );
      })}
      {/* Last value dots */}
      {lines.map((l, i) => {
        const lv = l.values[l.values.length - 1];
        return (
          <circle
            key={i}
            cx={W}
            cy={toY(lv)}
            r={3}
            fill={l.color}
            stroke="white"
            strokeWidth={1.5}
          />
        );
      })}
    </svg>
  );
}

// ─── Signed bar chart (net H-L / FII-DII) ────────────────────────────────

function SignedBarChart({
  data,
  height = 80,
  posColor = "#16a34a",
  negColor = "#dc2626",
}: {
  data: number[];
  height: number;
  posColor?: string;
  negColor?: string;
}) {
  if (!data.length) return null;
  const absMax = Math.max(...data.map(Math.abs), 1);
  const n = data.length;
  const W = 500;
  const barW = Math.max(4, W / n - 2);
  const midY = height / 2;

  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="w-full overflow-visible" style={{ height }} preserveAspectRatio="none">
      <line x1={0} y1={midY} x2={W} y2={midY} stroke="#cbd5e1" strokeWidth={1} strokeDasharray="3 3" />
      {data.map((v, i) => {
        const isPos = v >= 0;
        const barH = Math.max(2, (Math.abs(v) / absMax) * (midY - 4));
        const x = (i / n) * W + 1;
        const y = isPos ? midY - barH : midY;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barW}
            height={barH}
            rx={1.5}
            fill={isPos ? posColor : negColor}
            opacity={0.85}
          />
        );
      })}
    </svg>
  );
}

// ─── Stat card helpers ────────────────────────────────────────────────────

function StatCard({
  label,
  icon: Icon,
  iconColor = "text-accent",
  children,
  className = "",
}: {
  label: string;
  icon?: any;
  iconColor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-surface border border-border rounded-xl p-4 shadow-xs flex flex-col gap-2 ${className}`}>
      <div className={`flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-wider text-text-muted`}>
        {Icon && <Icon className={`w-3.5 h-3.5 ${iconColor}`} />}
        {label}
      </div>
      {children}
    </div>
  );
}

// ─── Sentiment logic ──────────────────────────────────────────────────────

function getSentiment(ratio: number, pct50: number) {
  if (ratio >= 1.5 && pct50 >= 60)
    return { label: "Strong Bullish", emoji: "🟢", color: "text-emerald-700", badgeCls: "bg-emerald-100 text-emerald-800 border-emerald-300", icon: TrendingUp, sub: "Strong market breadth. Favour breakout longs." };
  if (ratio >= 1.1)
    return { label: "Bullish", emoji: "🟩", color: "text-emerald-600", badgeCls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: TrendingUp, sub: "Positive breadth. Focus on Stage 2 leaders." };
  if (ratio < 0.9)
    return { label: "Bearish", emoji: "🔴", color: "text-rose-700", badgeCls: "bg-rose-100 text-rose-800 border-rose-300", icon: TrendingDown, sub: "Broad selling pressure. Raise cash, avoid new longs." };
  return { label: "Neutral", emoji: "🟡", color: "text-amber-700", badgeCls: "bg-amber-100 text-amber-800 border-amber-300", icon: Minus, sub: "Mixed internals. Only trade high-conviction setups." };
}

// ─── Main component ───────────────────────────────────────────────────────

interface Props {
  breadth: any;
  breadthHistory: any[];
}

export function MarketBreadthSection({ breadth, breadthHistory }: Props) {
  // ── derive values ──────────────────────────────────────────────────────
  const advances   = breadth?.advances       ?? 0;
  const declines   = breadth?.declines       ?? 0;
  const totalStocks = advances + declines || 2051;
  const unchanged  = Math.max(0, totalStocks - advances - declines);

  const pct20   = breadth?.pctAbove20Ema  ?? 0;
  const pct50   = breadth?.pctAbove50Sma  ?? 0;
  const pct200  = breadth?.pctAbove200Sma ?? 0;
  const hi52    = breadth?.new52wHighs    ?? 0;
  const lo52    = breadth?.new52wLows     ?? 0;
  const netHL   = breadth?.netHighLow     ?? (hi52 - lo52);
  const fiiNet  = breadth?.fiiNetCr       ?? 0;
  const diiNet  = breadth?.diiNetCr       ?? 0;
  const vix     = breadth?.indiaVix       ?? 0;

  const adRatio      = declines > 0 ? +(advances / declines).toFixed(2) : advances ? advances : 1;
  const breadthScore = Math.round((advances / (advances + declines || 1)) * 100);

  const sentiment = getSentiment(adRatio, pct50);
  const SIcon = sentiment.icon;

  // ── History arrays ─────────────────────────────────────────────────────
  const hist = useMemo(() => {
    const H = breadthHistory ?? [];
    if (H.length < 2) {
      // Synthetic fallback so charts always render
      return {
        labels:  ["Nov 7","Nov 8","Nov 9","Nov 10","Nov 11","Nov 12","Nov 13"],
        pct20s:  [30, 33, 31, 35, 36, 38, pct20  || 36],
        pct50s:  [45, 44, 46, 45, 47, 48, pct50  || 47],
        pct200s: [55, 54, 55, 56, 55, 56, pct200 || 55],
        netHLs:  [20, 45, 30, 60, 55, 70, netHL  ||  85],
        fiis:    [1200, -800, 1500, 2000, -500, 900, fiiNet || 1000],
        diis:    [800, 1200, 600, 400, 1100, 700, diiNet || 800],
      };
    }
    return {
      labels:  H.map((b: any) => new Date(b.tradeDate).toLocaleDateString("en-IN", { month: "short", day: "numeric" })),
      pct20s:  H.map((b: any) => b.pctAbove20Ema  ?? 0),
      pct50s:  H.map((b: any) => b.pctAbove50Sma  ?? 0),
      pct200s: H.map((b: any) => b.pctAbove200Sma ?? 0),
      netHLs:  H.map((b: any) => b.netHighLow ?? ((b.new52wHighs ?? 0) - (b.new52wLows ?? 0))),
      fiis:    H.map((b: any) => b.fiiNetCr ?? 0),
      diis:    H.map((b: any) => b.diiNetCr ?? 0),
    };
  }, [breadthHistory, pct20, pct50, pct200, netHL, fiiNet, diiNet]);

  // ── Sector tiles ───────────────────────────────────────────────────────
  const sectors: { name: string; chg: number | null; quad: string }[] = useMemo(() => {
    if (Array.isArray(breadth?.sectorRrgJson) && breadth.sectorRrgJson.length > 0) {
      return breadth.sectorRrgJson.slice(0, 10).map((s: any) => ({
        name: (s.sector ?? "").replace("NIFTY ", ""),
        chg:  s.momentum ?? null,
        quad: s.quadrant ?? "",
      }));
    }
    return [
      { name: "Banking",   chg: null, quad: "" },
      { name: "IT",        chg: null, quad: "" },
      { name: "Pharma",    chg: null, quad: "" },
      { name: "Auto",      chg: null, quad: "" },
      { name: "FMCG",      chg: null, quad: "" },
      { name: "Metal",     chg: null, quad: "" },
      { name: "Realty",    chg: null, quad: "" },
      { name: "Energy",    chg: null, quad: "" },
      { name: "PSU Bank",  chg: null, quad: "" },
      { name: "Cap. Goods",chg: null, quad: "" },
    ];
  }, [breadth?.sectorRrgJson]);

  // ── Trading recommendation ─────────────────────────────────────────────
  const conditions = [
    { label: "A/D Ratio > 1.5",          met: adRatio >= 1.5 },
    { label: "> 60% above 50 SMA",        met: pct50 >= 60 },
    { label: "Positive Net Highs − Lows", met: netHL >= 0 },
    { label: "FII + DII net buying",       met: fiiNet + diiNet >= 0 },
    { label: "India VIX < 18",            met: vix > 0 && vix < 18 },
  ];
  const metCount = conditions.filter((c) => c.met).length;
  const rec =
    metCount >= 4
      ? { label: "Strong Bullish", sub: "Market breadth is healthy. Look for long breakouts with volume.", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" }
      : metCount >= 3
      ? { label: "Bullish",        sub: "Conditions broadly supportive. Focus on high RS, Stage 2 leaders.",color: "text-emerald-600", bg: "bg-emerald-50/70 border-emerald-200/70" }
      : metCount >= 2
      ? { label: "Selective",      sub: "Mixed signals. Only trade high-conviction setups with tight stops.", color: "text-amber-700", bg: "bg-amber-50 border-amber-200" }
      : { label: "Cautious",       sub: "Breadth deteriorating. Reduce exposure, preserve capital.",        color: "text-rose-700",  bg: "bg-rose-50 border-rose-200" };

  // ──────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Section header ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/10 border border-accent/30">
          <Activity className="w-4 h-4 text-accent" />
        </div>
        <div>
          <h2 className="text-base sm:text-lg font-bold font-mono text-text leading-tight">
            Market Breadth
          </h2>
          <p className="text-xs text-text-muted font-mono">Overall market participation and sentiment</p>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ROW 1 — 5 STAT CARDS                                              */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">

        {/* 1. Market Sentiment */}
        <div className={`rounded-xl border p-4 shadow-xs flex flex-col gap-2 ${sentiment.badgeCls.includes("emerald") ? "bg-emerald-50 border-emerald-200" : sentiment.badgeCls.includes("rose") ? "bg-rose-50 border-rose-200" : "bg-amber-50 border-amber-200"}`}>
          <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-wider text-text-muted">
            <SIcon className="w-3.5 h-3.5" />
            Market Sentiment
          </div>
          <div className={`text-2xl font-extrabold font-mono leading-tight ${sentiment.color}`}>
            {sentiment.label}
          </div>
          <div className="text-[11px] text-text-secondary font-mono leading-snug">{sentiment.sub}</div>
        </div>

        {/* 2. Breadth Score */}
        <StatCard label="Breadth Score" icon={BarChart2} iconColor="text-accent">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-extrabold font-mono text-text">{breadthScore}</span>
            <span className="text-sm text-text-muted font-mono">/ 100</span>
          </div>
          <PctBar
            value={breadthScore}
            color={breadthScore >= 60 ? "#16a34a" : breadthScore >= 40 ? "#f59e0b" : "#dc2626"}
          />
          <div className={`text-[11px] font-mono font-semibold ${breadthScore >= 60 ? "text-emerald-700" : breadthScore >= 40 ? "text-amber-700" : "text-rose-700"}`}>
            {breadthScore >= 60 ? "Healthy" : breadthScore >= 40 ? "Moderate" : "Weak"} breadth
          </div>
        </StatCard>

        {/* 3. A/D Ratio */}
        <StatCard label="Advance / Decline Ratio">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-extrabold font-mono text-text">{adRatio.toFixed(2)}</span>
          </div>
          <div className="h-8 mt-1">
            <Sparkline
              data={hist.pct20s.slice(-10)}
              color={adRatio >= 1 ? "#16a34a" : "#dc2626"}
              height={32}
              width={100}
            />
          </div>
          <div className={`text-[11px] font-mono font-bold ${adRatio >= 1.5 ? "text-emerald-700" : adRatio >= 1.1 ? "text-emerald-600" : adRatio < 0.9 ? "text-rose-700" : "text-amber-700"}`}>
            {adRatio >= 1.5 ? "▲ Healthy" : adRatio >= 1.1 ? "▲ Positive" : adRatio < 0.9 ? "▼ Negative" : "→ Even"}
          </div>
        </StatCard>

        {/* 4. Advancing Stocks */}
        <StatCard label="Advancing Stocks" icon={ArrowUpRight} iconColor="text-emerald-600">
          <div className="text-2xl font-extrabold font-mono text-text">{advances.toLocaleString("en-IN")}</div>
          <div className="text-[11px] text-text-secondary font-mono">
            {Math.round((advances / totalStocks) * 100)}% of {totalStocks.toLocaleString("en-IN")}
          </div>
          <PctBar value={(advances / totalStocks) * 100} color="#16a34a" />
        </StatCard>

        {/* 5. Declining Stocks */}
        <StatCard label="Declining Stocks" icon={ArrowDownRight} iconColor="text-rose-600">
          <div className="text-2xl font-extrabold font-mono text-text">{declines.toLocaleString("en-IN")}</div>
          <div className="text-[11px] text-text-secondary font-mono">
            {Math.round((declines / totalStocks) * 100)}% of {totalStocks.toLocaleString("en-IN")}
          </div>
          <PctBar value={(declines / totalStocks) * 100} color="#dc2626" />
        </StatCard>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ROW 2 — TREND CHART + INDICATORS + SECTOR TILES                   */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

        {/* Advance vs Decline Trend — col-span-5 */}
        <div className="lg:col-span-5 bg-surface border border-border rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-border pb-2 mb-4">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-text flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-accent" /> Advance vs Decline Trend
            </span>
            <div className="flex items-center gap-3 text-[10px] font-mono text-text-muted">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 rounded bg-emerald-500 inline-block" /> Advancing %
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 rounded bg-blue-500 inline-block" /> Declining %
              </span>
            </div>
          </div>

          <div className="relative" style={{ height: 110 }}>
            <MultiLineChart
              lines={[
                { values: hist.pct20s, color: "#16a34a", fill: true },
                { values: hist.pct200s, color: "#ef4444", fill: false },
              ]}
              height={110}
            />
          </div>

          {/* Value callouts */}
          <div className="mt-3 flex items-center justify-between border-t border-border pt-2">
            <div className="flex items-center gap-4 text-[11px] font-mono">
              <span className="text-emerald-700 font-bold">
                {pct20.toFixed(1)}% <span className="font-normal text-text-muted">above 20 EMA</span>
              </span>
              <span className="text-rose-700 font-bold">
                {pct200.toFixed(1)}% <span className="font-normal text-text-muted">above 200 DMA</span>
              </span>
            </div>
            <span className="text-[10px] font-mono text-text-muted">
              {hist.labels[0]} → {hist.labels[hist.labels.length - 1]}
            </span>
          </div>
        </div>

        {/* Key Market Indicators — col-span-4 */}
        <div className="lg:col-span-4 bg-surface border border-border rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-border pb-2 mb-3">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-text flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-accent" /> Key Market Indicators
            </span>
          </div>
          <table className="w-full text-xs font-mono">
            <tbody>
              {[
                { label: "% Above 20 EMA",  value: `${pct20.toFixed(1)}%`,  good: pct20  >= 50 },
                { label: "% Above 50 SMA",  value: `${pct50.toFixed(1)}%`,  good: pct50  >= 50 },
                { label: "% Above 200 DMA", value: `${pct200.toFixed(1)}%`, good: pct200 >= 50 },
                { label: "New 52W Highs",   value: String(hi52),            good: hi52   >= 50 },
                { label: "New 52W Lows",    value: String(lo52),            good: lo52   <  30 },
                { label: "Net H − L",       value: `${netHL >= 0 ? "+" : ""}${netHL}`, good: netHL >= 0 },
                { label: "India VIX",       value: vix ? vix.toFixed(2) : "—", good: vix > 0 && vix < 18 },
              ].map((row) => (
                <tr key={row.label} className="border-b border-border/60 last:border-0 hover:bg-surface-2 transition-colors">
                  <td className="py-2 text-text-secondary">{row.label}</td>
                  <td className="py-2 text-right font-bold text-text pr-2">{row.value}</td>
                  <td className="py-2 text-right w-10">
                    <span className={`inline-flex items-center justify-center w-6 h-5 rounded text-[10px] font-bold ${row.good ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                      {row.good ? "▲" : "▼"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Sector Performance — col-span-3 */}
        <div className="lg:col-span-3 bg-surface border border-border rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-border pb-2 mb-3">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-text flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-accent" /> Sector Performance
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {sectors.slice(0, 10).map((sec, i) => {
              const leading  = sec.quad === "Leading"  || sec.quad === "Improving";
              const lagging  = sec.quad === "Lagging"  || sec.quad === "Weakening";
              const posChg   = sec.chg != null && sec.chg >= 0;
              const negChg   = sec.chg != null && sec.chg < 0;
              return (
                <div
                  key={i}
                  className={`rounded-lg px-2 py-2 text-center border transition-all ${
                    leading || posChg
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                      : lagging || negChg
                      ? "bg-rose-50 border-rose-200 text-rose-800"
                      : "bg-surface-2 border-border text-text"
                  }`}
                >
                  <div className="text-[10px] font-mono font-bold truncate">{sec.name}</div>
                  {sec.chg != null && (
                    <div className={`text-[9px] font-mono font-bold mt-0.5 ${sec.chg >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                      {sec.chg >= 0 ? "+" : ""}{sec.chg.toFixed(2)}%
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ROW 3 — PARTICIPATION + NET H-L + RECOMMENDATION                  */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

        {/* Market Participation — col-span-4 */}
        <div className="lg:col-span-4 bg-surface border border-border rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-border pb-2 mb-5">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-text flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-accent" /> Market Participation
            </span>
            <span className="text-[11px] font-mono text-text-muted">% of stocks</span>
          </div>

          {/* Three horizontal progress bars */}
          <div className="space-y-5">
            {[
              { label: "Above 20 EMA",  val: pct20,  color: "#16a34a" },
              { label: "Above 50 SMA",  val: pct50,  color: "#7c3aed" },
              { label: "Above 200 DMA", val: pct200, color: "#2563eb" },
            ].map((row) => (
              <div key={row.label}>
                <div className="flex items-center justify-between mb-2 font-mono text-xs">
                  <span className="flex items-center gap-2 text-text-secondary">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: row.color }} />
                    {row.label}
                  </span>
                  <span className="font-extrabold text-text" style={{ color: row.color }}>
                    {row.val.toFixed(0)}%
                  </span>
                </div>
                <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${clamp(row.val, 0, 100)}%`, background: row.color }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 pt-4 border-t border-border flex items-center justify-between">
            <div>
              <div className="text-[10px] font-mono text-text-muted uppercase tracking-wide">Total Stocks</div>
              <div className="text-xl font-extrabold font-mono text-text mt-0.5">{totalStocks.toLocaleString("en-IN")}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-mono text-text-muted uppercase tracking-wide">Flat / Unchanged</div>
              <div className="text-xl font-extrabold font-mono text-text mt-0.5">{unchanged.toLocaleString("en-IN")}</div>
            </div>
          </div>
        </div>

        {/* New Highs & Lows — col-span-4 */}
        <div className="lg:col-span-4 bg-surface border border-border rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-border pb-2 mb-4">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-text flex items-center gap-1.5">
              <BarChart2 className="w-3.5 h-3.5 text-accent" /> New Highs &amp; Lows · Net H−L
            </span>
          </div>

          {/* Big numbers row */}
          <div className="grid grid-cols-3 gap-2 text-center mb-4">
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 py-3">
              <div className="text-xl font-extrabold font-mono text-emerald-700">{hi52}</div>
              <div className="text-[10px] font-mono text-emerald-800 mt-0.5">52W Highs</div>
            </div>
            <div className={`rounded-xl border py-3 ${netHL >= 0 ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200"}`}>
              <div className={`text-xl font-extrabold font-mono ${netHL >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                {netHL >= 0 ? "+" : ""}{netHL}
              </div>
              <div className={`text-[10px] font-mono mt-0.5 ${netHL >= 0 ? "text-emerald-800" : "text-rose-800"}`}>Net H−L</div>
            </div>
            <div className="rounded-xl bg-rose-50 border border-rose-200 py-3">
              <div className="text-xl font-extrabold font-mono text-rose-700">{lo52}</div>
              <div className="text-[10px] font-mono text-rose-800 mt-0.5">52W Lows</div>
            </div>
          </div>

          {/* Rolling net H-L bar chart */}
          <div>
            <div className="text-[10px] font-mono text-text-muted mb-1.5 font-semibold uppercase tracking-wide">
              Rolling Net Highs − Lows
            </div>
            <div className="h-[70px]">
              <SignedBarChart data={hist.netHLs.slice(-20)} height={70} />
            </div>
          </div>

          {/* FII / DII quick tiles */}
          <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-surface-2 p-2.5 text-xs font-mono">
              <div className="text-[10px] text-blue-600 font-bold mb-0.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 inline-block" /> FII Net
              </div>
              <div className={`font-extrabold text-sm ${fiiNet >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                {fiiNet !== 0 ? formatCr(fiiNet) : "—"}
              </div>
            </div>
            <div className="rounded-lg bg-surface-2 p-2.5 text-xs font-mono">
              <div className="text-[10px] text-accent font-bold mb-0.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block" /> DII Net
              </div>
              <div className={`font-extrabold text-sm ${diiNet >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                {diiNet !== 0 ? formatCr(diiNet) : "—"}
              </div>
            </div>
          </div>
        </div>

        {/* Recommendation + Quick Summary — col-span-4 */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* Recommendation */}
          <div className={`flex-1 bg-surface border rounded-xl p-4 shadow-xs ${rec.bg}`}>
            <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-wider text-text-muted border-b border-border pb-2 mb-3">
              <Zap className="w-3.5 h-3.5 text-accent" /> Trading Recommendation
            </div>
            <div className={`text-xl font-extrabold font-mono mb-1 ${rec.color}`}>{rec.label}</div>
            <p className="text-xs font-mono text-text-secondary mb-4 leading-relaxed">{rec.sub}</p>
            <div className="space-y-2">
              {conditions.map((c) => (
                <div key={c.label} className="flex items-start gap-2 text-xs font-mono">
                  {c.met ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-rose-500 mt-0.5 shrink-0" />
                  )}
                  <span className={c.met ? "text-text" : "text-text-muted"}>{c.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Summary */}
          <div className="bg-surface border border-border rounded-xl p-4 shadow-xs">
            <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-text-muted mb-3">
              Quick Summary
            </div>
            <div className="space-y-2">
              {[
                { label: "Breadth Score",  value: `${breadthScore} / 100` },
                { label: "A/D Ratio",      value: adRatio.toFixed(2)      },
                { label: "% Above 50 SMA", value: `${pct50.toFixed(1)}%`  },
                { label: "New 52W Highs",  value: String(hi52)            },
                { label: "India VIX",      value: vix ? vix.toFixed(1) : "—" },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between text-xs font-mono">
                  <span className="flex items-center gap-1.5 text-text-secondary">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent/60 inline-block" />
                    {row.label}
                  </span>
                  <span className="font-bold text-text">{row.value}</span>
                </div>
              ))}
            </div>
            <div className={`mt-3 pt-2 border-t border-border text-[11px] font-mono font-semibold text-center rounded-lg py-2 ${rec.bg} ${rec.color}`}>
              {metCount >= 4
                ? "✓ Market is in a healthy bullish zone"
                : metCount >= 3
                ? "✓ Broadly positive — stay selective"
                : metCount >= 2
                ? "→ Mixed — high-conviction setups only"
                : "⚠ Reduce exposure, avoid new longs"}
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ROW 4 — BREADTH HISTORY MULTI-LINE CHART (full width)             */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-surface border border-border rounded-xl p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border pb-2 mb-4 gap-2">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-text flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-accent" />
            Market Breadth History · Last {hist.labels.length} Sessions
          </span>
          <div className="flex items-center flex-wrap gap-3 text-[10px] font-mono text-text-muted">
            {[
              { color: "#3b82f6", label: "% above 20 EMA" },
              { color: "#7c3aed", label: "% above 50 SMA" },
              { color: "#64748b", label: "% above 200 DMA" },
            ].map((leg) => (
              <span key={leg.label} className="flex items-center gap-1.5">
                <span className="w-4 h-0.5 rounded inline-block" style={{ background: leg.color }} />
                {leg.label}
              </span>
            ))}
          </div>
        </div>

        <div style={{ height: 100 }}>
          <MultiLineChart
            lines={[
              { values: hist.pct20s,  color: "#3b82f6", fill: true  },
              { values: hist.pct50s,  color: "#7c3aed", fill: false },
              { values: hist.pct200s, color: "#64748b", fill: false },
            ]}
            height={100}
          />
        </div>

        {/* x-axis labels */}
        <div className="flex justify-between mt-1 text-[9px] font-mono text-text-muted px-0.5">
          {hist.labels.length > 0 && (
            <>
              <span>{hist.labels[0]}</span>
              {hist.labels.length > 6 && <span>{hist.labels[Math.floor(hist.labels.length / 2)]}</span>}
              <span>{hist.labels[hist.labels.length - 1]}</span>
            </>
          )}
        </div>

        {/* Current day values */}
        <div className="mt-3 pt-3 border-t border-border flex flex-wrap gap-5 text-xs font-mono">
          {[
            { label: "% Above 20 EMA",  value: `${pct20.toFixed(1)}%`,  color: "#3b82f6" },
            { label: "% Above 50 SMA",  value: `${pct50.toFixed(1)}%`,  color: "#7c3aed" },
            { label: "% Above 200 DMA", value: `${pct200.toFixed(1)}%`, color: "#64748b" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />
              <span className="text-text-secondary">{item.label}</span>
              <span className="font-extrabold" style={{ color: item.color }}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

export default MarketBreadthSection;
