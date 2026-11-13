"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Sparkles,
  BookmarkPlus,
  Calculator,
  Layers,
  Check,
  ShieldAlert,
  ArrowUpRight,
  TrendingUp,
  BarChart2,
  Calendar,
  Eye,
  SlidersHorizontal,
  BookOpen,
} from "lucide-react";
import PriceChart from "@/components/charts/price-chart";
import RiskCalculator from "@/components/risk-calculator";
import { Loader } from "@/components/ui/loader";
import { formatINR, formatPct } from "@/lib/format";
import {
  detectAllPatterns,
  ALL_PATTERNS_CATALOGUE,
  type DetectedPattern,
} from "@/lib/chart-patterns";

export default function StockDetailPage() {
  const params = useParams();
  const rawParam = params?.symbol as string;
  const symbol = (rawParam ? decodeURIComponent(rawParam) : "RELIANCE").toUpperCase().trim();

  const [activeTab, setActiveTab] = useState<"analysis" | "patterns">("analysis");
  const [thesis, setThesis] = useState<any>(null);
  const [tech, setTech] = useState<any>(null);
  const [funda, setFunda] = useState<any>(null);
  const [symbolMeta, setSymbolMeta] = useState<any>(null);
  const [backendPatterns, setBackendPatterns] = useState<any[]>([]);
  const [loadingThesis, setLoadingThesis] = useState(true);
  const [watchlistAdded, setWatchlistAdded] = useState(false);
  const [timeframe, setTimeframe] = useState<"D" | "W" | "M">("D");

  // Chart pattern detection state
  const [detectedPatterns, setDetectedPatterns] = useState<DetectedPattern[]>([]);
  const [selectedPattern, setSelectedPattern] = useState<DetectedPattern | null>(null);
  const [patternCategoryFilter, setPatternCategoryFilter] = useState<"all" | "reversal" | "continuation" | "neutral">("all");

  useEffect(() => {
    let cancelled = false;
    setLoadingThesis(true);
    setThesis(null);
    setTech(null);
    setFunda(null);
    setSymbolMeta(null);
    setBackendPatterns([]);

    async function loadThesis() {
      try {
        const res = await fetch(`/api/ai/thesis/${symbol}`);
        if (res.ok) {
          const json = await res.json();
          if (!cancelled) {
            setThesis(json.thesis);
            setTech(json.tech ?? null);
            setFunda(json.funda ?? null);
            setSymbolMeta(json.symbolMeta ?? null);
            setBackendPatterns(json.patterns ?? []);
          }
        }
      } catch (err) {
        console.error("Thesis error:", err);
      } finally {
        if (!cancelled) setLoadingThesis(false);
      }
    }
    loadThesis();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  // Load bars and run 20 PDF pattern detector
  useEffect(() => {
    let cancelled = false;
    async function loadPatterns() {
      try {
        const res = await fetch(`/api/stock/${symbol}/bars?tf=${timeframe}`);
        if (res.ok) {
          const json = await res.json();
          if (!cancelled && Array.isArray(json.bars)) {
            const found = detectAllPatterns(json.bars);
            setDetectedPatterns(found);
            if (found.length > 0) {
              setSelectedPattern(found[0]);
            } else {
              setSelectedPattern(null);
            }
          }
        }
      } catch (err) {
        console.error("Pattern detection error:", err);
      }
    }
    loadPatterns();
    return () => {
      cancelled = true;
    };
  }, [symbol, timeframe]);

  const handleAddToWatchlist = async () => {
    try {
      await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, listType: "WATCHLIST" }),
      });
      setWatchlistAdded(true);
      setTimeout(() => setWatchlistAdded(false), 3000);
    } catch (err) {
      console.error("Watchlist error:", err);
    }
  };

  const score = tech?.compositeScore ?? "—";
  const stage = tech?.weinsteinStage ?? "—";
  const rs = tech?.rsRating ?? "—";
  const epsQoQ = funda?.epsGrowthQoQ;
  const fiiQoQ = funda?.fiiChangeQoQ;
  const fundamentalScore = funda?.fundamentalScore ?? "—";

  // Pillar breakdowns (A=35, B=25, C=40)
  const pillarA = tech
    ? Math.round(
        Math.min(
          ((tech.rsRating ?? 0) / 100) * 35 +
            (tech.weinsteinStage?.startsWith("2") ? 10 : 0),
          35
        )
      )
    : "—";
  const pillarB = tech
    ? Math.round(
        Math.min(
          ((tech.rvol20d ?? 1) >= 1.0 ? 15 : 8) +
            ((tech.adrPct20d ?? 0) >= 3 ? 10 : 5),
          25
        )
      )
    : "—";
  const pillarC =
    typeof fundamentalScore === "number"
      ? Math.min(40, Math.round(fundamentalScore))
      : "—";

  // Chart symbol & meta
  const tvExchange = symbolMeta?.exchange || "NSE";
  const tvSymbol =
    tvExchange === "BSE" ? symbolMeta?.bseCode || symbol : symbol;
  const tvDirectUrl = `https://www.tradingview.com/chart/?symbol=${tvExchange}:${tvSymbol}&interval=${timeframe}`;

  // Risk calculator defaults
  const initPrice = selectedPattern?.keyLevels?.neckline || backendPatterns[0]?.pivotPrice || tech?.close || 1000;
  const initStop =
    selectedPattern?.keyLevels?.stopLoss ||
    backendPatterns[0]?.stopLossPrice ||
    (tech?.close ? Number((tech.close * 0.94).toFixed(2)) : 940);

  const filteredCatalog = ALL_PATTERNS_CATALOGUE.filter((p) => {
    if (patternCategoryFilter === "all") return true;
    return p.category === patternCategoryFilter;
  });

  return (
    <div className="space-y-5 max-w-7xl mx-auto w-full pb-10">
      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. Header & Stock Overview Banner                            */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Left: Breadcrumbs, Symbol, Company, Price */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-mono font-medium text-text-muted">
              <Link
                href="/screener"
                className="hover:text-accent transition-colors flex items-center gap-1 font-semibold"
              >
                ← Screener
              </Link>
              <span>/</span>
              <span className="text-text-secondary">{tvExchange}</span>
              <span>/</span>
              <span className="text-text font-bold">{symbol}</span>
            </div>

            <div className="flex flex-wrap items-baseline gap-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold font-mono text-text tracking-tight">
                {symbol}
              </h1>
              <span className="text-xs font-mono font-bold bg-accent-tint text-accent border border-accent-border px-2.5 py-1 rounded-md">
                {tvExchange}:{symbolMeta?.series || "EQ"}
              </span>

              {tech && (
                <div className="flex items-baseline gap-2">
                  <span className="text-xl sm:text-2xl font-bold font-mono text-text">
                    {formatINR(tech.close)}
                  </span>
                  <span
                    className={`text-sm font-mono font-bold ${
                      (tech.changePct ?? 0) >= 0
                        ? "text-emerald-700"
                        : "text-rose-700"
                    }`}
                  >
                    {formatPct(tech.changePct)}
                  </span>
                </div>
              )}
            </div>

            {symbolMeta?.companyName && (
              <p className="text-xs sm:text-sm font-mono text-text-secondary line-clamp-1">
                {symbolMeta.companyName}
              </p>
            )}
          </div>

          {/* Right: Actions & Modes */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Timeframe Selector: D, W, M */}
            <div className="flex items-center rounded-lg border border-border bg-surface-2 p-1 text-xs font-mono font-bold shadow-2xs">
              {(["D", "W", "M"] as const).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-3 py-1.5 rounded-md transition-all ${
                    timeframe === tf
                      ? "bg-accent text-white font-extrabold shadow-xs"
                      : "text-text-secondary hover:text-text hover:bg-surface"
                  }`}
                  title={
                    tf === "D"
                      ? "Daily Candles (1D)"
                      : tf === "W"
                      ? "Weekly Candles (1W)"
                      : "Monthly Candles (1M)"
                  }
                >
                  {tf}
                </button>
              ))}
            </div>

            {/* Direct TradingView.com tab */}
            <a
              href={tvDirectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface border border-border hover:border-accent text-xs sm:text-sm font-mono font-semibold text-text-secondary hover:text-accent transition-colors shadow-2xs"
              title="Open full interactive chart directly on TradingView.com in a new tab"
            >
              <span>TradingView.com ↗</span>
            </a>

            {/* Watchlist Button */}
            <button
              onClick={handleAddToWatchlist}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-accent text-white hover:bg-accent-hover text-xs sm:text-sm font-mono font-bold transition-all shadow-xs"
            >
              {watchlistAdded ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Saved to Watchlist</span>
                </>
              ) : (
                <>
                  <BookmarkPlus className="w-4 h-4" />
                  <span>+ Watchlist</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* Tab Navigation: Analysis vs Chart Patterns                    */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 border-b border-border pb-1 font-mono text-sm">
        <button
          onClick={() => setActiveTab("analysis")}
          className={`flex items-center gap-2 pb-2 px-1 border-b-2 font-bold transition-colors ${
            activeTab === "analysis"
              ? "border-accent text-accent"
              : "border-transparent text-text-secondary hover:text-text"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Technical Analysis</span>
        </button>

        <button
          onClick={() => setActiveTab("patterns")}
          className={`flex items-center gap-2 pb-2 px-1 border-b-2 font-bold transition-colors ${
            activeTab === "patterns"
              ? "border-accent text-accent"
              : "border-transparent text-text-secondary hover:text-text"
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Chart Patterns</span>
          {detectedPatterns.length > 0 && (
            <span className="text-[11px] bg-accent text-white font-extrabold px-1.5 py-0.2 rounded-full">
              {detectedPatterns.length}
            </span>
          )}
        </button>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. Main Grid: Left Chart Area (65%), Right Content (35%)       */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 min-h-[620px]">
        {/* Left: Native Fast Candlestick Chart (Works for all symbols) */}
        <div className="lg:col-span-8 flex flex-col h-[600px] sm:h-[660px] lg:h-[720px] bg-surface border border-border rounded-xl shadow-xs overflow-hidden">
          <PriceChart
            key={`native:${symbol}`}
            symbol={symbol}
            exchange={tvExchange}
            height={720}
            timeframe={timeframe}
            onTimeframeChange={setTimeframe}
            pattern={backendPatterns[0] ?? null}
            activePattern={selectedPattern ?? (detectedPatterns[0] ?? null)}
          />
        </div>

        {/* Right Side: Tab 1 = Analysis / Scorecard, Tab 2 = PDF Chart Patterns */}
        <div className="lg:col-span-4 space-y-5">
          {activeTab === "analysis" ? (
            <>
              {/* Card 1: Techno-Funda Quantitative Composite */}
              <div className="bg-surface border border-border rounded-xl p-4 sm:p-5 shadow-xs">
                <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
                  <div className="text-sm font-mono font-bold uppercase tracking-wider text-text flex items-center gap-2">
                    <Layers className="w-4 h-4 text-accent" />
                    <span>Techno-Funda Composite</span>
                  </div>
                  <span className="text-sm bg-emerald-100 text-emerald-900 border border-emerald-300 px-3 py-1 rounded-md font-mono font-extrabold shadow-2xs">
                    {loadingThesis ? "…" : `${score} / 100 Pts`}
                  </span>
                </div>

                {loadingThesis ? (
                  <div className="py-6">
                    <Loader
                      message="Loading Scorecard..."
                      subtext="Computing Techno-Funda pillars"
                      size="sm"
                    />
                  </div>
                ) : (
                  <div className="space-y-3 font-mono">
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <span className="text-text-secondary font-semibold">Pillar A (Tech & Relative Strength):</span>
                      <span className="text-emerald-700 font-extrabold text-sm sm:text-base">
                        {`${pillarA} / 35`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <span className="text-text-secondary font-semibold">Pillar B (Setup & Volume Delivery):</span>
                      <span className="text-emerald-700 font-extrabold text-sm sm:text-base">
                        {`${pillarB} / 25`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <span className="text-text-secondary font-semibold">Pillar C (Fundamentals Quality):</span>
                      <span className="text-emerald-700 font-extrabold text-sm sm:text-base">
                        {`${pillarC} / 40`}
                      </span>
                    </div>

                    <div className="border-t border-border pt-3 mt-3 grid grid-cols-2 gap-3 text-xs">
                      <div className="bg-surface-2 p-2.5 rounded-lg border border-border">
                        <span className="text-text-muted block text-[11px] font-semibold uppercase">Weinstein Stage</span>
                        <span className="font-extrabold text-text text-sm">
                          {stage || "—"}
                        </span>
                      </div>
                      <div className="bg-surface-2 p-2.5 rounded-lg border border-border">
                        <span className="text-text-muted block text-[11px] font-semibold uppercase">RS Rating (1-99)</span>
                        <span className="font-extrabold text-accent text-sm">
                          {rs != null && rs !== "—" ? `${rs} Percentile` : "—"}
                        </span>
                      </div>
                      <div className="bg-surface-2 p-2.5 rounded-lg border border-border">
                        <span className="text-text-muted block text-[11px] font-semibold uppercase">QoQ EPS Growth</span>
                        <span
                          className={`font-extrabold text-sm ${
                            (epsQoQ ?? 0) >= 0 ? "text-emerald-700" : "text-rose-700"
                          }`}
                        >
                          {epsQoQ != null ? `${epsQoQ.toFixed(1)}%` : "—"}
                        </span>
                      </div>
                      <div className="bg-surface-2 p-2.5 rounded-lg border border-border">
                        <span className="text-text-muted block text-[11px] font-semibold uppercase">FII Net Change</span>
                        <span
                          className={`font-extrabold text-sm ${
                            (fiiQoQ ?? 0) >= 0 ? "text-emerald-700" : "text-rose-700"
                          }`}
                        >
                          {fiiQoQ != null
                            ? `${fiiQoQ >= 0 ? "+" : ""}${fiiQoQ.toFixed(2)}%`
                            : "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Card 2: AI Institutional Thesis */}
              <div className="bg-surface border border-border rounded-xl p-4 sm:p-5 shadow-xs">
                <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-accent" />
                    <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-text">
                      AI Institutional Thesis
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono font-medium text-text-muted bg-surface-2 px-2 py-0.5 rounded border border-border">
                    7-Day DB Cache
                  </span>
                </div>

                {loadingThesis ? (
                  <div className="py-6">
                    <Loader
                      message="Synthesizing AI Thesis..."
                      subtext="Grounding technical setup and fundamentals"
                      size="sm"
                    />
                  </div>
                ) : thesis ? (
                  <div className="space-y-3.5 text-xs font-mono">
                    <div>
                      <span className="text-text-muted uppercase tracking-wider font-bold block mb-1 text-[11px]">
                        Summary
                      </span>
                      <p className="text-text font-semibold leading-relaxed">
                        {thesis.summary}
                      </p>
                    </div>

                    <div>
                      <span className="text-text-muted uppercase tracking-wider font-bold block mb-1 text-[11px]">
                        Technical Setup
                      </span>
                      <p className="text-text-secondary leading-relaxed">
                        {thesis.technicalSetup}
                      </p>
                    </div>

                    <div>
                      <span className="text-text-muted uppercase tracking-wider font-bold block mb-1 text-[11px]">
                        Fundamental Driver
                      </span>
                      <p className="text-text-secondary leading-relaxed">
                        {thesis.fundamentalDriver}
                      </p>
                    </div>

                    {thesis.riskWarning && (
                      <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-rose-900">
                        <span className="font-bold block mb-0.5 text-[11px] uppercase tracking-wider">
                          Key Invalidation Risk:
                        </span>
                        <p className="leading-relaxed font-semibold">
                          {thesis.riskWarning}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs font-mono text-text-muted">
                    No cached thesis available for {symbol}. Will be generated in the next nightly run.
                  </div>
                )}
              </div>
            </>
          ) : (
            /* ───────────────────────────────────────────────────────────── */
            /* Tab 2: 20 Candlestick Chart Patterns (PDF Auto-Detect)         */
            /* ───────────────────────────────────────────────────────────── */
            <div className="space-y-4 font-mono">
              {/* Detected Patterns Banner */}
              <div className="bg-surface border border-border rounded-xl p-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-border pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-accent" />
                    <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-text">
                      Detected On Chart ({timeframe})
                    </span>
                  </div>
                  <span className="text-xs bg-accent-tint text-accent border border-accent-border px-2 py-0.5 rounded font-bold">
                    {detectedPatterns.length} Found
                  </span>
                </div>

                {detectedPatterns.length === 0 ? (
                  <p className="text-xs text-text-muted py-2">
                    No classic patterns currently active on this timeframe. Select a pattern below from the PDF guide to view its rules and levels.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {detectedPatterns.map((pat) => {
                      const isSelected = selectedPattern?.name === pat.name;
                      return (
                        <div
                          key={pat.name}
                          onClick={() => setSelectedPattern(pat)}
                          className={`p-3 rounded-lg border cursor-pointer transition-all ${
                            isSelected
                              ? "bg-accent-tint/40 border-accent shadow-xs"
                              : "bg-surface-2 border-border hover:border-slate-400"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-extrabold text-text flex items-center gap-1.5">
                              <span>{pat.name}</span>
                              {isSelected && (
                                <span className="text-[10px] text-accent font-bold bg-white px-1.5 py-0.2 rounded border border-accent/30">
                                  Drawn on Chart
                                </span>
                              )}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                                pat.bias === "bullish"
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                  : pat.bias === "bearish"
                                  ? "bg-rose-100 text-rose-800 border border-rose-300"
                                  : "bg-amber-100 text-amber-800 border border-amber-300"
                              }`}
                            >
                              {pat.bias} ({pat.confidence}%)
                            </span>
                          </div>
                          <p className="text-[11px] text-text-secondary mt-1.5 leading-relaxed">
                            {pat.description}
                          </p>
                          {pat.keyLevels && (
                            <div className="flex flex-wrap gap-2 text-[10px] mt-2 pt-2 border-t border-border/60">
                              {pat.keyLevels.resistance && (
                                <span className="text-rose-700 font-bold">
                                  Res: ₹{pat.keyLevels.resistance.toFixed(2)}
                                </span>
                              )}
                              {pat.keyLevels.support && (
                                <span className="text-emerald-700 font-bold">
                                  Sup: ₹{pat.keyLevels.support.toFixed(2)}
                                </span>
                              )}
                              {pat.keyLevels.neckline && (
                                <span className="text-amber-700 font-bold">
                                  Neckline: ₹{pat.keyLevels.neckline.toFixed(2)}
                                </span>
                              )}
                              {pat.keyLevels.target && (
                                <span className="text-accent font-bold">
                                  Target: ₹{pat.keyLevels.target.toFixed(2)}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Complete 20-Pattern PDF Encyclopedia */}
              <div className="bg-surface border border-border rounded-xl p-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-border pb-3 mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-text">
                    PDF 20-Pattern Guide
                  </span>
                  {/* Category Filter */}
                  <div className="flex gap-1 text-[11px]">
                    {(["all", "reversal", "continuation", "neutral"] as const).map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setPatternCategoryFilter(cat)}
                        className={`px-2 py-0.5 rounded capitalize ${
                          patternCategoryFilter === cat
                            ? "bg-slate-900 text-white font-bold"
                            : "bg-surface-2 text-text-secondary hover:text-text"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="max-h-[360px] overflow-y-auto space-y-2 pr-1">
                  {filteredCatalog.map((item) => (
                    <div
                      key={item.name}
                      className="p-2.5 rounded-lg border border-border bg-surface-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-text">{item.name}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-text-muted uppercase">
                            {item.category}
                          </span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                              item.bias === "bullish"
                                ? "bg-emerald-100 text-emerald-800"
                                : item.bias === "bearish"
                                ? "bg-rose-100 text-rose-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {item.bias}
                          </span>
                        </div>
                      </div>
                      <p className="text-[11px] text-text-secondary mt-1 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
