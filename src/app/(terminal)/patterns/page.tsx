"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Shapes,
  Eye,
  BookOpen,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  Compass,
  CheckCircle2,
  Filter,
  Search,
  ExternalLink,
} from "lucide-react";
import { ALL_PATTERNS_CATALOGUE, type PatternCategory, type PatternBias } from "@/lib/chart-patterns";
import { Loader } from "@/components/ui/loader";
import { formatINR, formatPct } from "@/lib/format";

interface StockPatternMatch {
  symbol: string;
  patternName: string;
  category: string;
  bias: string;
  confidence: number;
  status: string;
  currentClose: number;
  changePct: number;
  volume: number;
  pivotPrice: number | null;
  neckline: number | null;
  targetPrice: number | null;
  stopLossPrice: number | null;
}

export default function PatternsPage() {
  const [categoryFilter, setCategoryFilter] = useState<"all" | PatternCategory>("all");
  const [selectedPatternName, setSelectedPatternName] = useState<string>("Double Bottom");
  const [stockSearch, setStockSearch] = useState<string>("");
  
  const [summaryCounts, setSummaryCounts] = useState<Record<string, number>>({});
  const [stocksForPattern, setStocksForPattern] = useState<StockPatternMatch[]>([]);
  const [loadingStocks, setLoadingStocks] = useState<boolean>(true);

  // Fetch summary counts on mount
  useEffect(() => {
    async function loadSummary() {
      try {
        const res = await fetch("/api/patterns");
        if (res.ok) {
          const json = await res.json();
          setSummaryCounts(json.summary || {});
        }
      } catch (err) {
        console.error("Failed to load pattern summary:", err);
      }
    }
    loadSummary();
  }, []);

  // Fetch matched stocks whenever selectedPatternName changes
  useEffect(() => {
    let cancelled = false;
    setLoadingStocks(true);
    setStocksForPattern([]);

    async function loadStocks() {
      try {
        const res = await fetch(`/api/patterns?pattern=${encodeURIComponent(selectedPatternName)}`);
        if (res.ok) {
          const json = await res.json();
          if (!cancelled) {
            setStocksForPattern(json.stocks || []);
          }
        }
      } catch (err) {
        console.error("Failed to load pattern stocks:", err);
      } finally {
        if (!cancelled) setLoadingStocks(false);
      }
    }
    loadStocks();
    return () => {
      cancelled = true;
    };
  }, [selectedPatternName]);

  const filteredCatalog = ALL_PATTERNS_CATALOGUE.filter((p) => {
    if (categoryFilter !== "all" && p.category !== categoryFilter) return false;
    return true;
  });

  const activePatternDetail = ALL_PATTERNS_CATALOGUE.find(
    (p) => p.name.toLowerCase() === selectedPatternName.toLowerCase()
  ) || ALL_PATTERNS_CATALOGUE[0];

  const filteredStocks = stocksForPattern.filter((s) =>
    stockSearch ? s.symbol.toUpperCase().includes(stockSearch.toUpperCase().trim()) : true
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full pb-10">
      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. Header Banner                                              */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-accent-tint text-accent rounded-lg">
                <Shapes className="w-5 h-5" />
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold font-mono text-text tracking-tight">
                Bullish Chart Patterns · Buy-Side Setups
              </h1>
            </div>
            <p className="text-xs sm:text-sm font-mono text-text-secondary">
              Real-time pattern scanner across 1,200+ NSE stocks. Focuses exclusively on high-probability Buy-Side formations with visual zigzag path lines.
            </p>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs font-bold flex-wrap">
            <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>4 Reversal</span>
            </span>
            <span className="bg-blue-100 text-blue-800 border border-blue-300 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5" />
              <span>4 Continuation</span>
            </span>
            <span className="bg-amber-100 text-amber-800 border border-amber-300 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
              <Shapes className="w-3.5 h-3.5" />
              <span>1 Breakout</span>
            </span>
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. Main 2-Column Layout                                       */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Buy Patterns Selector (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Filters Bar */}
          <div className="bg-surface border border-border rounded-xl p-3 shadow-xs space-y-2 text-xs font-mono">
            {/* Category Filter */}
            <div className="flex items-center justify-between gap-1 flex-wrap">
              <span className="text-text-muted font-bold text-[11px]">Setup Type:</span>
              <div className="flex gap-1">
                {(["all", "reversal", "continuation", "neutral"] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-2 py-0.5 rounded uppercase font-bold text-[10px] transition-all ${
                      categoryFilter === cat
                        ? "bg-accent text-white shadow-2xs"
                        : "bg-surface-2 text-text-secondary hover:text-text"
                    }`}
                  >
                    {cat === "all" ? "All Setups" : cat === "neutral" ? "Breakout" : cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Cards List */}
          <div className="space-y-2 max-h-[720px] overflow-y-auto pr-1">
            {filteredCatalog.map((pat) => {
              const isSelected = selectedPatternName.toLowerCase() === pat.name.toLowerCase();
              const stockCount = summaryCounts[pat.name] ?? 0;

              return (
                <div
                  key={pat.name}
                  onClick={() => setSelectedPatternName(pat.name)}
                  className={`p-3.5 rounded-xl border font-mono cursor-pointer transition-all ${
                    isSelected
                      ? "bg-accent-tint/40 border-accent shadow-xs ring-1 ring-accent"
                      : "bg-surface border-border hover:border-slate-400 hover:shadow-2xs"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h3 className="font-extrabold text-sm text-text leading-tight flex items-center gap-1.5">
                      <span>{pat.name}</span>
                    </h3>
                    
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-extrabold font-mono bg-surface-2 border border-border px-2 py-0.5 rounded text-accent">
                        {stockCount} stocks
                      </span>
                      <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded uppercase shrink-0 bg-emerald-100 text-emerald-800 border border-emerald-300">
                        BUY
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-text-secondary line-clamp-1 leading-relaxed">
                    {pat.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Stocks Following Selected Pattern (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Active Pattern Summary Banner */}
          <div className="bg-surface border border-border rounded-xl p-4 shadow-xs font-mono">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-3">
              <div>
                <span className="text-[11px] font-bold text-accent uppercase tracking-wider block">
                  Active Scanner
                </span>
                <h2 className="text-xl font-extrabold text-text flex items-center gap-2">
                  <span>{activePatternDetail.name}</span>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded uppercase ${
                      activePatternDetail.bias === "bullish"
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                        : activePatternDetail.bias === "bearish"
                        ? "bg-rose-100 text-rose-800 border border-rose-300"
                        : "bg-amber-100 text-amber-800 border border-amber-300"
                    }`}
                  >
                    {activePatternDetail.bias}
                  </span>
                </h2>
              </div>

              <div className="text-right">
                <span className="text-xs text-text-muted font-semibold block">Universe Hits</span>
                <span className="text-2xl font-extrabold text-accent">
                  {stocksForPattern.length}
                </span>
              </div>
            </div>

            <p className="text-xs text-text-secondary leading-relaxed mb-3">
              {activePatternDetail.description}
            </p>

            {/* Search Input within Matched Stocks */}
            <div className="relative">
              <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={`Search among ${stocksForPattern.length} ${activePatternDetail.name} stocks...`}
                value={stockSearch}
                onChange={(e) => setStockSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-surface-2 border border-border rounded-lg text-xs font-mono text-text placeholder:text-text-muted focus:outline-hidden focus:border-accent"
              />
            </div>
          </div>

          {/* Stocks Table */}
          <div className="bg-surface border border-border rounded-xl shadow-xs overflow-hidden font-mono">
            {loadingStocks ? (
              <div className="py-16">
                <Loader
                  message={`Scanning for ${activePatternDetail.name}...`}
                  subtext="Checking 1,200+ NSE symbols"
                  size="md"
                />
              </div>
            ) : filteredStocks.length === 0 ? (
              <div className="py-16 text-center text-xs text-text-muted">
                No stocks currently matching "{activePatternDetail.name}" in the filtered universe.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[640px]">
                <table className="w-full text-xs text-left">
                  <thead className="bg-surface-2 border-b border-border text-[11px] font-bold text-text-muted uppercase sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3">Symbol</th>
                      <th className="px-3 py-3 text-right">LTP</th>
                      <th className="px-3 py-3 text-right">Change</th>
                      <th className="px-3 py-3 text-right">Pivot / Res</th>
                      <th className="px-3 py-3 text-right">Target</th>
                      <th className="px-3 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredStocks.map((stock) => (
                      <tr
                        key={stock.symbol}
                        className="hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-4 py-3 font-extrabold text-text">
                          <Link
                            href={`/stock/${stock.symbol}`}
                            className="hover:text-accent flex items-center gap-1"
                          >
                            <span>{stock.symbol}</span>
                            <ArrowUpRight className="w-3 h-3 text-accent shrink-0" />
                          </Link>
                        </td>

                        <td className="px-3 py-3 text-right font-bold text-text">
                          ₹{stock.currentClose.toFixed(2)}
                        </td>

                        <td
                          className={`px-3 py-3 text-right font-bold ${
                            stock.changePct >= 0 ? "text-emerald-700" : "text-rose-700"
                          }`}
                        >
                          {stock.changePct >= 0 ? "+" : ""}
                          {stock.changePct.toFixed(2)}%
                        </td>

                        <td className="px-3 py-3 text-right font-semibold text-text-secondary">
                          {stock.pivotPrice ? `₹${stock.pivotPrice.toFixed(2)}` : "—"}
                        </td>

                        <td className="px-3 py-3 text-right font-bold text-accent">
                          {stock.targetPrice ? `₹${stock.targetPrice.toFixed(2)}` : "—"}
                        </td>

                        <td className="px-3 py-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              stock.status === "TRIGGERED" || stock.status === "BREAKOUT"
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                : stock.status === "BREAKDOWN"
                                ? "bg-rose-100 text-rose-800 border border-rose-300"
                                : "bg-blue-100 text-blue-800 border border-blue-300"
                            }`}
                          >
                            {stock.status}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/stock/${stock.symbol}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-accent text-white hover:bg-accent-hover font-bold text-[11px] shadow-2xs transition-colors"
                          >
                            <span>Chart</span>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
