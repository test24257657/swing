"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  SlidersHorizontal,
  Search,
  ArrowUpDown,
} from "lucide-react";
import { formatINR, formatPct, getScoreBadge, getStageBadge } from "@/lib/format";
import SparklineSvg from "@/components/sparkline-svg";
import { Loader } from "@/components/ui/loader";

export default function ScreenerPage() {
  const [stocks, setStocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activePreset, setActivePreset] = useState("STAGE2_LEADERS");
  const [sortField, setSortField] = useState("technoFundaScore");
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    async function fetchScreenerData() {
      try {
        const res = await fetch("/api/terminal/data");
        if (res.ok) {
          const json = await res.json();
          setStocks(json.topScoredStocks || []);
        }
      } catch (err) {
        console.error("Screener fetch error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchScreenerData();
  }, []);

  const presets = [
    { id: "ALL", label: "All Scanned Stocks" },
    { id: "STAGE2_LEADERS", label: "Minervini Stage 2 Leaders" },
    { id: "HIGH_RS_QUALITY", label: "RS > 85 + High ROCE" },
    { id: "VOLUME_SURGE", label: "RVOL ≥ 1.5x + Delivery Spike" },
    { id: "TIGHT_BASE", label: "Tight Contraction (ADR > 3%)" },
  ];

  // Filtering
  const filtered = stocks.filter((s) => {
    if (
      searchTerm &&
      !s.symbol.includes(searchTerm.toUpperCase()) &&
      !s.symbolRel?.companyName?.toUpperCase().includes(searchTerm.toUpperCase())
    ) {
      return false;
    }

    if (activePreset === "STAGE2_LEADERS") {
      return s.weinsteinStage === "2A" || s.weinsteinStage === "2B";
    }
    if (activePreset === "HIGH_RS_QUALITY") {
      return s.rsRating >= 85 && (s.symbolRel?.fundamental?.roce ?? 20) >= 15;
    }
    if (activePreset === "VOLUME_SURGE") {
      return (s.rvol20d || 0) >= 1.5 && (s.deliverySpike || 1) >= 1.2;
    }
    if (activePreset === "TIGHT_BASE") {
      return (s.adrPct20d || 0) >= 3.0;
    }
    return true;
  });

  // Sorting
  const sorted = [...filtered].sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];
    if (typeof aVal === "string") {
      return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    aVal = Number(aVal || 0);
    bVal = Number(bVal || 0);
    return sortAsc ? aVal - bVal : bVal - aVal;
  });

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto w-full py-12">
        <Loader
          message="Loading Techno-Funda Screener..."
          subtext="Scanning universe across RS rankings, stages and volume surges"
          size="lg"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4 bg-surface p-4 sm:p-5 rounded-xl shadow-xs">
        <div>
          <h1 className="text-base sm:text-lg font-bold uppercase tracking-wider text-text font-mono flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-accent" />
            <span>Multi-Factor Techno-Funda Screener</span>
          </h1>
          <p className="text-xs text-text-muted font-mono mt-1">
            Filter & rank counters across 3 pillars: Relative Strength • Setup Tightness • Fundamentals
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              placeholder="Search ticker or company..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-surface-2 border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-text placeholder-text-muted focus:outline-none focus:border-accent font-mono w-48 sm:w-60 shadow-2xs"
            />
            <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-2.5" />
          </div>
        </div>
      </div>

      {/* Preset Filter Rail */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-border">
        {presets.map((p) => (
          <button
            key={p.id}
            onClick={() => setActivePreset(p.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono whitespace-nowrap transition-all ${
              activePreset === p.id
                ? "bg-accent text-white font-bold shadow-xs"
                : "text-text-secondary hover:text-text hover:bg-surface border border-border"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Screener Table */}
      <div className="bg-surface border border-border rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-text-muted font-mono uppercase text-[10px]">
                <th
                  onClick={() => handleSort("symbol")}
                  className="py-3 px-3 cursor-pointer hover:text-text"
                >
                  <div className="flex items-center gap-1">
                    <span>Symbol</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("close")}
                  className="py-3 px-3 cursor-pointer hover:text-text"
                >
                  <div className="flex items-center gap-1">
                    <span>Price</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("changePct")}
                  className="py-3 px-3 cursor-pointer hover:text-text"
                >
                  <div className="flex items-center gap-1">
                    <span>Change %</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("weinsteinStage")}
                  className="py-3 px-3 cursor-pointer hover:text-text"
                >
                  <div className="flex items-center gap-1">
                    <span>Stage</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("rsRating")}
                  className="py-3 px-3 cursor-pointer hover:text-text"
                >
                  <div className="flex items-center gap-1">
                    <span>RS (1-99)</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("adrPct20d")}
                  className="py-3 px-3 cursor-pointer hover:text-text"
                >
                  <div className="flex items-center gap-1">
                    <span>ADR%</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("rvol20d")}
                  className="py-3 px-3 cursor-pointer hover:text-text"
                >
                  <div className="flex items-center gap-1">
                    <span>RVOL</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("deliveryPct")}
                  className="py-3 px-3 cursor-pointer hover:text-text"
                >
                  <div className="flex items-center gap-1">
                    <span>Delivery %</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("technoFundaScore")}
                  className="py-3 px-3 cursor-pointer hover:text-text"
                >
                  <div className="flex items-center gap-1">
                    <span>Score</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-3">60D Trend</th>
                <th className="py-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sorted.map((s: any) => {
                const scoreBadge = getScoreBadge(s.technoFundaScore);
                const stageBadge = getStageBadge(s.weinsteinStage);
                const sparkData = Array.isArray(s.sparkline60d) ? s.sparkline60d : [];

                return (
                  <tr key={s.symbol} className="hover:bg-surface-2 transition-colors">
                    <td className="py-3 px-3.5 font-mono font-bold text-text">
                      <Link href={`/stock/${s.symbol}`} className="hover:text-accent text-sm sm:text-base font-extrabold">
                        {s.symbol}
                      </Link>
                      <div className="text-xs text-text-muted font-medium truncate max-w-[160px]">
                        {s.symbolRel?.companyName || s.symbol}
                      </div>
                    </td>
                    <td className="py-3 px-3.5 font-mono text-text font-bold text-sm sm:text-base">
                      {formatINR(s.close)}
                    </td>
                    <td
                      className={`py-3 px-3.5 font-mono font-bold text-xs sm:text-sm ${
                        s.changePct >= 0 ? "text-emerald-700" : "text-rose-700"
                      }`}
                    >
                      {formatPct(s.changePct)}
                    </td>
                    <td className="py-3 px-3.5 font-mono">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-bold border ${stageBadge.bg} ${stageBadge.text}`}
                      >
                        Stage {s.weinsteinStage}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 font-mono font-extrabold text-sm sm:text-base">
                      <span className={s.rsRating >= 85 ? "text-emerald-700" : "text-sky-700"}>
                        {s.rsRating}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 font-mono text-text-secondary font-medium">
                      {s.adrPct20d?.toFixed(1)}%
                    </td>
                    <td className="py-3 px-3.5 font-mono text-text-secondary font-medium">
                      {s.rvol20d?.toFixed(1)}x
                    </td>
                    <td className="py-3 px-3.5 font-mono text-text-secondary font-medium">
                      {s.deliveryPct?.toFixed(1)}%
                    </td>
                    <td className="py-3 px-3.5 font-mono">
                      <span
                        className={`px-2.5 py-1 rounded font-extrabold text-xs sm:text-sm border ${scoreBadge.bg} ${scoreBadge.text}`}
                      >
                        {s.technoFundaScore}
                      </span>
                    </td>
                    <td className="py-3 px-3.5">
                      <SparklineSvg data={sparkData} width={80} height={20} />
                    </td>
                    <td className="py-3 px-3.5 text-right">
                      <Link
                        href={`/stock/${s.symbol}`}
                        className="px-3 py-1.5 rounded-lg bg-surface border border-border hover:border-accent text-text hover:text-accent transition-colors text-xs font-mono font-bold shadow-2xs"
                      >
                        Trade ↗
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
