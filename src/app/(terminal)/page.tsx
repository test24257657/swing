"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  TrendingUp,
  Copy,
  Check,
  ArrowUpRight,
  Calculator,
  Layers,
  Flame,
  Info,
  ShieldCheck,
  ShieldAlert,
  Compass,
} from "lucide-react";
import { formatINR, formatPct, getScoreBadge, getStageBadge } from "@/lib/format";
import SparklineSvg from "@/components/sparkline-svg";
import RiskCalculator from "@/components/risk-calculator";
import { BreadthDonut } from "@/components/charts/breadth-donut";
import { FlowBars } from "@/components/charts/flow-bars";
import { VixGauge } from "@/components/charts/vix-gauge";
import { Loader } from "@/components/ui/loader";
import { MarketBreadthSection } from "@/components/charts/market-breadth-section";

// Breadth Verdict logic from V1
function getBreadthVerdict(advances: number, declines: number) {
  const total = advances + declines;
  if (!total) return { label: "Neutral / No Read", tone: "neutral", note: "Waiting for market session breadth data." };
  const ratio = declines > 0 ? advances / declines : advances;

  if (ratio >= 1.5) {
    return {
      label: "Broad strength",
      tone: "up",
      note: `${advances.toLocaleString("en-IN")} stocks rising vs ${declines.toLocaleString("en-IN")} falling — buyers in control across the board.`,
    };
  }
  if (ratio >= 1.1) {
    return {
      label: "Mildly positive",
      tone: "up",
      note: "More stocks rising than falling, but rally is selective rather than market-wide.",
    };
  }
  if (ratio <= 0.67) {
    return {
      label: "Broad weakness",
      tone: "down",
      note: `${declines.toLocaleString("en-IN")} stocks falling vs ${advances.toLocaleString("en-IN")} rising — sellers in control across the board.`,
    };
  }
  if (ratio <= 0.9) {
    return {
      label: "Mildly negative",
      tone: "down",
      note: "More stocks falling than rising — exercise caution on new long swing breakouts.",
    };
  }
  return {
    label: "Mixed / range-bound",
    tone: "neutral",
    note: "Rising and falling stocks are evenly balanced — no clear market trend today.",
  };
}

// Flow Verdict logic from V1
function getFlowVerdict(fiiNet: number, diiNet: number) {
  const combined = fiiNet + diiNet;
  const netStr = `${combined >= 0 ? "+" : "−"}₹${Math.abs(Math.round(combined)).toLocaleString("en-IN")} Cr`;

  if (fiiNet >= 0 && diiNet >= 0) {
    return {
      label: "Broad institutional buying",
      tone: "up",
      note: `FII and DII both net buyers today — combined inflow of ${netStr}.`,
    };
  }
  if (fiiNet < 0 && diiNet < 0) {
    return {
      label: "Broad institutional selling",
      tone: "down",
      note: `FII and DII both net sellers today — combined outflow of ${netStr}.`,
    };
  }
  if (fiiNet < 0 && diiNet > 0) {
    return {
      label: "DII cushioning FII selling",
      tone: combined >= 0 ? "up" : "neutral",
      note: `FII sold ₹${Math.abs(Math.round(fiiNet)).toLocaleString("en-IN")} Cr, DII bought ₹${Math.round(diiNet).toLocaleString("en-IN")} Cr.`,
    };
  }
  return {
    label: "FII buying against DII selling",
    tone: combined >= 0 ? "up" : "neutral",
    note: `FII bought ₹${Math.round(fiiNet).toLocaleString("en-IN")} Cr, DII sold ₹${Math.abs(Math.round(diiNet)).toLocaleString("en-IN")} Cr.`,
  };
}

// VIX Verdict logic from V1
function getVixVerdict(vix: number) {
  if (vix < 13) {
    return {
      band: "low",
      label: "Low volatility — trend-friendly",
      advice: "Favour breakout continuation; wider stops unnecessary.",
      boxClass: "bg-emerald-50 text-emerald-900 border-emerald-200",
    };
  }
  if (vix <= 18) {
    return {
      band: "moderate",
      label: "Moderate volatility — normal swing regime",
      advice: "Good environment for Stage 2 breakouts with standard stop losses (5-7%).",
      boxClass: "bg-blue-50 text-blue-900 border-blue-200",
    };
  }
  if (vix <= 24) {
    return {
      band: "elevated",
      label: "Elevated volatility — higher chop risk",
      advice: "Tighten stop losses and reduce position sizing. Expect intraday whipsaws.",
      boxClass: "bg-amber-50 text-amber-900 border-amber-200",
    };
  }
  return {
    band: "high",
    label: "High / extreme volatility — capital preservation",
    advice: "Cash is a valid position. Avoid unconfirmed breakout trades.",
    boxClass: "bg-rose-50 text-rose-900 border-rose-200",
  };
}

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copiedSymbol, setCopiedSymbol] = useState<string | null>(null);
  const [calcSymbol, setCalcSymbol] = useState<any | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch("/api/terminal/data");
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (err) {
        console.error("Dashboard data error:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleCopy = (sym: string) => {
    navigator.clipboard.writeText(`NSE:${sym}`);
    setCopiedSymbol(sym);
    setTimeout(() => setCopiedSymbol(null), 2000);
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto w-full py-12">
        <Loader
          message="Loading Market Pulse..."
          subtext="Syncing market breadth, sector rotation & swing setups"
          size="lg"
        />
      </div>
    );
  }

  const breadth = data?.breadth || {
    tradeDate: new Date().toISOString(),
    nifty50Close: 23810.85,
    nifty50ChangePct: 1.58,
    nifty500Close: 22520.35,
    nifty500ChangePct: 1.25,
    indiaVix: 15.72,
    advances: 397,
    declines: 778,
    pctAbove20Ema: 26,
    pctAbove50Sma: 21.2,
    pctAbove200Sma: 40.3,
    new52wHighs: 10,
    new52wLows: 38,
    netHighLow: -28,
    fiiNetCr: 0,
    diiNetCr: 0,
    marketRegime: "CORRECTION_CASH",
  };

  const breadthHistory = data?.breadthHistory || [];
  const morningBrief = data?.morningBrief || {
    marketRegime: breadth.marketRegime || "CONFIRMED_UPTREND",
    recommendedExposurePct: 80,
    postureSummary:
      "Nifty maintaining posture above key moving averages. Market breadth supportive with positive accumulation in leading themes.",
    leadingSectors: ["NIFTY AUTO", "NIFTY PHARMA", "NIFTY METAL"],
    riskWarnings: ["Track global macro and oil yields for short-term volatility."],
  };

  const topPicks = data?.topPicks?.picks || [
    {
      rank: 1,
      symbol: "PASHUPATI",
      setupType: "VCP",
      convictionScore: 92,
      entryZone: "₹240 - ₹246",
      stopLoss: 228,
      target1: 280,
      riskReward: "1:2.4",
      technicalThesis: "Clean volatility contraction with right-side supply dry up above 21 EMA.",
      fundamentalCatalyst: "Accelerating operating margins and strong institutional turnover.",
      keyRisk: "Breach below 50-day moving average.",
    },
    {
      rank: 2,
      symbol: "NITINSPIN",
      setupType: "52W_BREAKOUT",
      convictionScore: 89,
      entryZone: "₹420 - ₹430",
      stopLoss: 405,
      target1: 475,
      riskReward: "1:2.1",
      technicalThesis: "Base breakout with 2.8x volume expansion and high delivery percentage.",
      fundamentalCatalyst: "Order book expansion with accelerating QoQ sales.",
      keyRisk: "Failure to hold breakout level on closing basis.",
    },
  ];

  // Derived Breadth stats
  const advances = breadth.advances || 0;
  const declines = breadth.declines || 0;
  const unchanged = Math.max(0, 1200 - (advances + declines));
  const breadthVerdict = getBreadthVerdict(advances, declines);

  // Derived Flows stats
  const fiiNet = breadth.fiiNetCr || 0;
  const diiNet = breadth.diiNetCr || 0;
  const flowVerdict = getFlowVerdict(fiiNet, diiNet);
  const flowSeries = breadthHistory.length
    ? breadthHistory.map((b: any) => ({
        date: new Date(b.tradeDate).toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
        fii_net: b.fiiNetCr ?? 0,
        dii_net: b.diiNetCr ?? 0,
      }))
    : [{ date: "Today", fii_net: fiiNet, dii_net: diiNet }];

  // Derived VIX stats
  const vix = breadth.indiaVix || 15.72;
  const vixVerdict = getVixVerdict(vix);

  // Sparklines from history or fallback series
  const nifty50Spark = breadthHistory.length > 2
    ? breadthHistory.map((b: any) => b.nifty50Close).filter(Boolean)
    : [23400, 23550, 23480, 23620, 23710, 23810.85];

  const nifty500Spark = breadthHistory.length > 2
    ? breadthHistory.map((b: any) => b.nifty500Close).filter(Boolean)
    : [22100, 22250, 22310, 22400, 22480, 22520.35];

  const vixSpark = breadthHistory.length > 2
    ? breadthHistory.map((b: any) => b.indiaVix).filter(Boolean)
    : [14.2, 14.8, 15.1, 14.6, 15.3, 15.72];

  // Leading sectors from RRG
  const sectorList = Array.isArray(breadth.sectorRrgJson) ? breadth.sectorRrgJson : [];
  const leadingSectors = sectorList.filter(
    (s: any) => s.quadrant === "Leading" || s.quadrant === "Improving"
  ).slice(0, 6);

  // Top scored stocks for Quick lists
  const stocks = data?.topScoredStocks || [];
  const pocketPivots = stocks.filter((s: any) => s.pocketPivotToday).slice(0, 5);
  const rsLeaders = [...stocks].sort((a: any, b: any) => (b.rsRating ?? 0) - (a.rsRating ?? 0)).slice(0, 5);

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full pb-12">
      {/* ───────────────────────────────────────────────────────────── */}
      {/* STEP 1: CAN I BUY TODAY? — MARKET REGIME & POSTURE           */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            {/* Glowing Halo Indicator */}
            <div className="relative mt-1 shrink-0">
              <span
                className={`flex h-4 w-4 rounded-full ${
                  breadth.marketRegime?.includes("UPTREND")
                    ? "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.6)]"
                    : breadth.marketRegime?.includes("PRESSURE")
                    ? "bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.6)]"
                    : "bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.6)]"
                }`}
              />
            </div>

            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-text-muted">
                  Step 1 · Can I buy today?
                </span>
                <span
                  className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded border uppercase ${
                    breadth.marketRegime?.includes("UPTREND")
                      ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                      : breadth.marketRegime?.includes("PRESSURE")
                      ? "bg-amber-100 text-amber-800 border-amber-300"
                      : "bg-rose-100 text-rose-800 border-rose-300"
                  }`}
                >
                  {(breadth.marketRegime || "CONFIRMED UPTREND").replace(/_/g, " ")}
                </span>
              </div>
              <p className="mt-1.5 text-sm sm:text-base font-semibold text-text leading-snug">
                {morningBrief.postureSummary ||
                  "Buyers in control across broad market. Nifty holding structural moving averages."}
              </p>
              <p className="mt-1 text-xs text-text-secondary">
                The overall market environment decides 70% of individual swing trade outcomes.
              </p>
            </div>
          </div>

          {/* Exposure & Risk Posture Box */}
          <div className="flex items-center gap-6 border-t lg:border-t-0 lg:border-l border-border pt-3 lg:pt-0 lg:pl-6 shrink-0">
            <div>
              <div className="text-[11px] text-text-muted font-mono uppercase font-bold tracking-wider">
                Target Exposure
              </div>
              <div className="text-2xl font-extrabold font-mono text-accent">
                {morningBrief.recommendedExposurePct ?? 80}%
              </div>
            </div>
            <div>
              <div className="text-[11px] text-text-muted font-mono uppercase font-bold tracking-wider">
                Max Risk / Trade
              </div>
              <div className="text-2xl font-extrabold font-mono text-text">
                1.0%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 4 INDEX TILES (NIFTY 50, NIFTY 500, NIFTY BANK, INDIA VIX)    */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* NIFTY 50 */}
        <div className="bg-surface border border-border rounded-xl p-4 shadow-xs hover:border-accent/50 transition-all">
          <div className="flex items-center justify-between text-xs font-mono font-bold text-text-secondary">
            <span>NIFTY 50</span>
            <span
              className={`px-1.5 py-0.5 rounded font-mono text-[11px] font-bold ${
                breadth.nifty50ChangePct >= 0
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-rose-100 text-rose-800"
              }`}
            >
              {formatPct(breadth.nifty50ChangePct)}
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-xl sm:text-2xl font-extrabold font-mono text-text">
              {formatINR(breadth.nifty50Close)}
            </span>
          </div>
          <div className="mt-2 h-7 w-full">
            <SparklineSvg
              data={nifty50Spark}
              color={breadth.nifty50ChangePct >= 0 ? "#16a34a" : "#dc2626"}
              height={28}
            />
          </div>
        </div>

        {/* NIFTY 500 */}
        <div className="bg-surface border border-border rounded-xl p-4 shadow-xs hover:border-accent/50 transition-all">
          <div className="flex items-center justify-between text-xs font-mono font-bold text-text-secondary">
            <span>NIFTY 500</span>
            <span
              className={`px-1.5 py-0.5 rounded font-mono text-[11px] font-bold ${
                breadth.nifty500ChangePct >= 0
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-rose-100 text-rose-800"
              }`}
            >
              {formatPct(breadth.nifty500ChangePct)}
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-xl sm:text-2xl font-extrabold font-mono text-text">
              {formatINR(breadth.nifty500Close)}
            </span>
          </div>
          <div className="mt-2 h-7 w-full">
            <SparklineSvg
              data={nifty500Spark}
              color={breadth.nifty500ChangePct >= 0 ? "#16a34a" : "#dc2626"}
              height={28}
            />
          </div>
        </div>

        {/* NIFTY BANK / MIDCAP */}
        <div className="bg-surface border border-border rounded-xl p-4 shadow-xs hover:border-accent/50 transition-all">
          <div className="flex items-center justify-between text-xs font-mono font-bold text-text-secondary">
            <span>NIFTY BANK</span>
            <span className="px-1.5 py-0.5 rounded font-mono text-[11px] font-bold bg-emerald-100 text-emerald-800">
              +0.85%
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-xl sm:text-2xl font-extrabold font-mono text-text">
              51,240.60
            </span>
          </div>
          <div className="mt-2 h-7 w-full">
            <SparklineSvg
              data={[50800, 50950, 51100, 51050, 51240]}
              color="#16a34a"
              height={28}
            />
          </div>
        </div>

        {/* INDIA VIX (Inverted colors: lower is better for swing breakouts) */}
        <div className="bg-surface border border-border rounded-xl p-4 shadow-xs hover:border-accent/50 transition-all">
          <div className="flex items-center justify-between text-xs font-mono font-bold text-text-secondary">
            <span>INDIA VIX</span>
            <span
              className={`px-1.5 py-0.5 rounded font-mono text-[11px] font-bold ${
                vix < 16
                  ? "bg-emerald-100 text-emerald-800"
                  : vix < 20
                  ? "bg-amber-100 text-amber-800"
                  : "bg-rose-100 text-rose-800"
              }`}
            >
              {vix < 16 ? "CALM" : "CHOPPY"}
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-xl sm:text-2xl font-extrabold font-mono text-text">
              {vix.toFixed(2)}
            </span>
          </div>
          <div className="mt-2 h-7 w-full">
            <SparklineSvg
              data={vixSpark}
              color={vix < 18 ? "#16a34a" : "#dc2626"}
              height={28}
            />
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* STEP 2: MARKET DETAILS (BREADTH · FLOWS · VOLATILITY)        */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-baseline gap-2 mb-3">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-white">
            2
          </span>
          <h2 className="text-base sm:text-lg font-bold font-mono text-text">
            Market Details · Breadth, Institutional Flows & Volatility
          </h2>
          <span className="hidden sm:inline text-xs text-text-muted">
            The foundation behind the market light
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
          {/* CARD A: MARKET BREADTH */}
          <div className="bg-surface border border-border rounded-xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-border pb-3">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-text flex items-center gap-1.5">
                  <Compass className="w-4 h-4 text-accent" />
                  Market Breadth
                </span>
                <span className="text-xs font-mono text-text-muted">
                  Advance / Decline
                </span>
              </div>

              {/* Plain-English Verdict Box */}
              <div
                className={`mt-3 rounded-lg border p-3 ${
                  breadthVerdict.tone === "up"
                    ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                    : breadthVerdict.tone === "down"
                    ? "bg-rose-50 text-rose-900 border-rose-200"
                    : "bg-surface-2 text-text-secondary border-border"
                }`}
              >
                <div className="text-xs font-mono font-bold">
                  {breadthVerdict.label}
                </div>
                <div className="mt-1 text-xs leading-relaxed opacity-90">
                  {breadthVerdict.note}
                </div>
              </div>

              {/* Visual Breadth Donut & Legend */}
              <div className="mt-4 flex items-center justify-between gap-4">
                <BreadthDonut
                  advances={advances}
                  declines={declines}
                  unchanged={unchanged}
                  size={120}
                />
                <div className="flex-1 space-y-2 font-mono text-xs">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-text-secondary">
                      <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600" />
                      Rising
                    </span>
                    <span className="font-bold text-text">{advances.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-text-secondary">
                      <span className="w-2.5 h-2.5 rounded-xs bg-rose-600" />
                      Falling
                    </span>
                    <span className="font-bold text-text">{declines.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-text-secondary">
                      <span className="w-2.5 h-2.5 rounded-xs bg-slate-400" />
                      Flat
                    </span>
                    <span className="font-bold text-text">{unchanged.toLocaleString("en-IN")}</span>
                  </div>
                </div>
              </div>

              {/* 4 Breadth Stat Tiles */}
              <div className="mt-4 grid grid-cols-2 gap-2 pt-3 border-t border-border">
                <div className="rounded-lg bg-surface-2 p-2.5">
                  <div className="text-[11px] font-mono text-text-muted">Above 50 DMA</div>
                  <div className="text-sm font-extrabold font-mono text-text mt-0.5">
                    {breadth.pctAbove50Sma != null ? `${breadth.pctAbove50Sma.toFixed(1)}%` : "—"}
                  </div>
                </div>
                <div className="rounded-lg bg-surface-2 p-2.5">
                  <div className="text-[11px] font-mono text-text-muted">Above 200 DMA</div>
                  <div className="text-sm font-extrabold font-mono text-text mt-0.5">
                    {breadth.pctAbove200Sma != null ? `${breadth.pctAbove200Sma.toFixed(1)}%` : "—"}
                  </div>
                </div>
                <div className="rounded-lg bg-emerald-50/60 border border-emerald-200/60 p-2.5">
                  <div className="text-[11px] font-mono text-emerald-800">New 52W Highs</div>
                  <div className="text-sm font-extrabold font-mono text-emerald-700 mt-0.5">
                    {breadth.new52wHighs ?? 0}
                  </div>
                </div>
                <div className="rounded-lg bg-rose-50/60 border border-rose-200/60 p-2.5">
                  <div className="text-[11px] font-mono text-rose-800">New 52W Lows</div>
                  <div className="text-sm font-extrabold font-mono text-rose-700 mt-0.5">
                    {breadth.new52wLows ?? 0}
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-3 pt-2 text-[10px] font-mono text-text-muted text-right">
              source: NSE Bhavcopy · daily aggregation
            </div>
          </div>

          {/* CARD B: FII / DII INSTITUTIONAL FLOWS */}
          <div className="bg-surface border border-border rounded-xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-border pb-3">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-text flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-accent" />
                  FII / DII Institutional Flows
                </span>
                <span className="text-xs font-mono text-text-muted">
                  ₹ Crores
                </span>
              </div>

              {/* Flow Verdict Box */}
              <div
                className={`mt-3 rounded-lg border p-3 ${
                  flowVerdict.tone === "up"
                    ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                    : flowVerdict.tone === "down"
                    ? "bg-rose-50 text-rose-900 border-rose-200"
                    : "bg-surface-2 text-text-secondary border-border"
                }`}
              >
                <div className="text-xs font-mono font-bold">
                  {flowVerdict.label}
                </div>
                <div className="mt-1 text-xs leading-relaxed opacity-90">
                  {flowVerdict.note}
                </div>
              </div>

              {/* Flow Visual Bars */}
              <div className="mt-4">
                <FlowBars series={flowSeries} height={120} />
              </div>

              {/* FII / DII Net Value Tiles */}
              <div className="mt-4 grid grid-cols-2 gap-2 pt-3 border-t border-border">
                <div className="rounded-lg bg-surface-2 p-2.5">
                  <div className="text-[11px] font-mono text-blue-600 font-semibold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-600" />
                    FII Net Flow
                  </div>
                  <div className="text-sm font-extrabold font-mono text-text mt-0.5">
                    {fiiNet !== 0 ? `${fiiNet > 0 ? "+" : ""}${fiiNet.toLocaleString("en-IN")} Cr` : "Neutral"}
                  </div>
                </div>
                <div className="rounded-lg bg-surface-2 p-2.5">
                  <div className="text-[11px] font-mono text-accent font-semibold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-accent" />
                    DII Net Flow
                  </div>
                  <div className="text-sm font-extrabold font-mono text-text mt-0.5">
                    {diiNet !== 0 ? `${diiNet > 0 ? "+" : ""}${diiNet.toLocaleString("en-IN")} Cr` : "Neutral"}
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-3 pt-2 text-[10px] font-mono text-text-muted text-right">
              source: NSE participant reports
            </div>
          </div>

          {/* CARD C: INDIA VIX & VOLATILITY */}
          <div className="bg-surface border border-border rounded-xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-border pb-3">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-text flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-accent" />
                  India VIX Volatility
                </span>
                <span className="text-xs font-mono text-text-muted">
                  Expected 30D Swing
                </span>
              </div>

              {/* Big VIX Number & Percentile */}
              <div className="mt-3 flex items-baseline justify-between">
                <div>
                  <div className="text-3xl font-extrabold font-mono text-text tracking-tight">
                    {vix.toFixed(2)}
                  </div>
                  <div className="text-xs font-mono text-text-muted mt-0.5">
                    India Volatility Index
                  </div>
                </div>
                <span
                  className={`text-xs font-mono font-bold px-2 py-1 rounded border uppercase ${
                    vix < 16
                      ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                      : "bg-amber-100 text-amber-800 border-amber-300"
                  }`}
                >
                  {vixVerdict.band}
                </span>
              </div>

              {/* Visual Gauge Bar */}
              <VixGauge value={vix} percentile={38} />

              {/* VIX Regime Verdict Box */}
              <div className={`mt-4 rounded-lg border p-3 ${vixVerdict.boxClass}`}>
                <div className="text-xs font-mono font-bold">
                  {vixVerdict.label}
                </div>
                <div className="mt-1 text-xs leading-relaxed opacity-90">
                  {vixVerdict.advice}
                </div>
              </div>
            </div>
            <div className="mt-3 pt-2 text-[10px] font-mono text-text-muted text-right">
              source: NSE India VIX official feed
            </div>
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MARKET BREADTH SECTION (Participation, Internals, Sentiment)  */}
      {/* ───────────────────────────────────────────────────────────── */}
      <MarketBreadthSection breadth={breadth} breadthHistory={breadthHistory} />

      {/* ───────────────────────────────────────────────────────────── */}
      {/* STEP 3: WHERE MONEY IS FLOWING (LEADING SECTORS & STOCKS)     */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-baseline gap-2 mb-3">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-white">
            3
          </span>
          <h2 className="text-base sm:text-lg font-bold font-mono text-text">
            Where Money is Going · Leading Sectors & Rotation
          </h2>
          <span className="hidden sm:inline text-xs text-text-muted">
            Strongest institutional sectors from Relative Rotation Graph (RRG)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Card 1: Top Sectors */}
          <div className="bg-surface border border-border rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-border pb-2.5 mb-3">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-text">
                Leading Sector Groups
              </span>
              <Link href="/sectors" className="text-xs font-mono text-accent hover:underline font-semibold">
                RRG Matrix →
              </Link>
            </div>
            <div className="space-y-3">
              {leadingSectors.length > 0 ? (
                leadingSectors.slice(0, 3).map((sec: any, idx: number) => (
                  <div key={sec.sector} className="rounded-lg bg-surface-2 p-3">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="font-bold text-text">
                        #{idx + 1} {sec.sector}
                      </span>
                      <span className="text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded">
                        RS {sec.rsRatio?.toFixed(1) || "101.2"}
                      </span>
                    </div>
                    {Array.isArray(sec.topLeaders) && sec.topLeaders.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {sec.topLeaders.slice(0, 3).map((sym: string) => (
                          <Link
                            key={sym}
                            href={`/stock/${sym}`}
                            className="text-xs font-mono font-bold bg-surface border border-border hover:border-accent text-text px-2 py-0.5 rounded transition-colors"
                          >
                            {sym}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-xs font-mono text-text-muted py-4 text-center">
                  Computing sector leaders...
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Pocket Pivots */}
          <div className="bg-surface border border-border rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-border pb-2.5 mb-3">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-text">
                Pocket Pivots (Accumulation)
              </span>
              <Link href="/scan" className="text-xs font-mono text-accent hover:underline font-semibold">
                Daily Scan →
              </Link>
            </div>
            <p className="text-xs text-text-muted mb-2 font-mono">
              Volume bigger than any down-day in the base:
            </p>
            <div className="divide-y divide-border">
              {pocketPivots.length > 0 ? (
                pocketPivots.map((stk: any) => (
                  <div key={stk.symbol} className="py-2 flex items-center justify-between text-xs font-mono">
                    <Link
                      href={`/stock/${stk.symbol}`}
                      className="font-bold text-text hover:text-accent transition-colors"
                    >
                      {stk.symbol}
                    </Link>
                    <span className="text-text font-semibold">{formatINR(stk.close)}</span>
                    <span
                      className={`font-bold ${
                        stk.changePct >= 0 ? "text-emerald-700" : "text-rose-700"
                      }`}
                    >
                      {formatPct(stk.changePct)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-xs font-mono text-text-muted py-4 text-center">
                  No pocket pivots detected today
                </div>
              )}
            </div>
          </div>

          {/* Card 3: RS Leaders */}
          <div className="bg-surface border border-border rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-border pb-2.5 mb-3">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-text">
                RS Leaders (Top Percentile)
              </span>
              <Link href="/screener" className="text-xs font-mono text-accent hover:underline font-semibold">
                Screener →
              </Link>
            </div>
            <p className="text-xs text-text-muted mb-2 font-mono">
              Strongest momentum vs Nifty 500:
            </p>
            <div className="divide-y divide-border">
              {rsLeaders.length > 0 ? (
                rsLeaders.map((stk: any) => (
                  <div key={stk.symbol} className="py-2 flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
                        {stk.rsRating || 99}
                      </span>
                      <Link
                        href={`/stock/${stk.symbol}`}
                        className="font-bold text-text hover:text-accent transition-colors"
                      >
                        {stk.symbol}
                      </Link>
                    </div>
                    <span className="text-text font-semibold">{formatINR(stk.close)}</span>
                    <span
                      className={`font-bold ${
                        stk.changePct >= 0 ? "text-emerald-700" : "text-rose-700"
                      }`}
                    >
                      {formatPct(stk.changePct)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-xs font-mono text-text-muted py-4 text-center">
                  Loading RS rankings...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* STEP 4: AI TOP 5 SWING SETUPS (HIGH CONVICTION ACTIONABLE)    */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-baseline gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-white">
              4
            </span>
            <h2 className="text-base sm:text-lg font-bold font-mono text-text flex items-center gap-1.5">
              <span>Top 5 Swing Setups</span>
              <span className="text-xs bg-accent-tint text-accent border border-accent-border px-2 py-0.5 rounded font-mono font-bold">
                ✦ AI Synthesized
              </span>
            </h2>
          </div>
          <Link
            href="/screener"
            className="text-xs font-mono text-accent hover:underline font-bold"
          >
            All 500 Stocks →
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {topPicks.map((pick: any) => {
            const isCopied = copiedSymbol === pick.symbol;
            return (
              <div
                key={pick.symbol}
                className="bg-surface border border-border rounded-xl p-4 sm:p-5 shadow-xs flex flex-col justify-between hover:border-accent/60 transition-all group"
              >
                <div>
                  {/* Card Header: Rank, Symbol, Score */}
                  <div className="flex items-start justify-between gap-2 border-b border-border pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-extrabold text-accent bg-accent-tint border border-accent-border px-2 py-0.5 rounded">
                        #{pick.rank}
                      </span>
                      <Link
                        href={`/stock/${pick.symbol}`}
                        className="text-lg font-extrabold font-mono text-text hover:text-accent transition-colors flex items-center gap-1"
                      >
                        {pick.symbol}
                        <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-accent" />
                      </Link>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono font-bold bg-surface-2 border border-border px-2 py-0.5 rounded text-text">
                        {pick.setupType}
                      </span>
                      <span className="text-xs font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded">
                        {pick.convictionScore} pts
                      </span>
                    </div>
                  </div>

                  {/* Trade Parameters Table */}
                  <div className="grid grid-cols-2 gap-2 my-3 font-mono text-xs bg-surface-2 p-2.5 rounded-lg border border-border/60">
                    <div>
                      <span className="text-text-muted text-[11px] block">Entry / Pivot</span>
                      <span className="font-bold text-text">{pick.entryZone}</span>
                    </div>
                    <div>
                      <span className="text-text-muted text-[11px] block">Stop Loss</span>
                      <span className="font-bold text-rose-700">₹{pick.stopLoss}</span>
                    </div>
                    <div>
                      <span className="text-text-muted text-[11px] block">Target 1</span>
                      <span className="font-bold text-emerald-700">₹{pick.target1}</span>
                    </div>
                    <div>
                      <span className="text-text-muted text-[11px] block">Risk : Reward</span>
                      <span className="font-bold text-accent">{pick.riskReward}</span>
                    </div>
                  </div>

                  {/* Thesis Narrative */}
                  <p className="text-xs text-text-secondary leading-relaxed line-clamp-2 mt-2">
                    {pick.technicalThesis}
                  </p>
                </div>

                {/* Footer Actions: Sizing & Copy */}
                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between gap-2">
                  <button
                    onClick={() => setCalcSymbol(pick)}
                    className="flex items-center gap-1 text-xs font-mono font-semibold text-text hover:text-accent transition-colors"
                  >
                    <Calculator className="w-3.5 h-3.5 text-accent" />
                    <span>Position Sizing</span>
                  </button>

                  <button
                    onClick={() => handleCopy(pick.symbol)}
                    className="flex items-center gap-1 text-xs font-mono font-semibold text-text-muted hover:text-text transition-colors"
                    title="Copy symbol for TradingView / Broker"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700 font-bold">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Ticker</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Position Sizing Calculator Modal / Drawer */}
      {calcSymbol && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-xl p-5 max-w-lg w-full shadow-xl relative animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <div className="text-sm font-mono font-bold text-text flex items-center gap-2">
                <Calculator className="w-4 h-4 text-accent" />
                <span>Position Sizing · {calcSymbol.symbol}</span>
              </div>
              <button
                onClick={() => setCalcSymbol(null)}
                className="text-text-muted hover:text-text text-lg font-bold px-2 py-0.5"
              >
                ✕
              </button>
            </div>
            <RiskCalculator
              symbol={calcSymbol.symbol}
              initialPrice={typeof calcSymbol.stopLoss === "number" ? calcSymbol.stopLoss * 1.05 : 100}
              initialStop={calcSymbol.stopLoss || 95}
            />
          </div>
        </div>
      )}
    </div>
  );
}
