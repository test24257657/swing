"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ScanLine,
  Target,
  ChevronRight,
  Calculator,
  ShieldCheck,
} from "lucide-react";
import { formatINR, formatPct, getScoreBadge } from "@/lib/format";
import { Loader } from "@/components/ui/loader";

export default function ScanPage() {
  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadScans() {
      try {
        const res = await fetch("/api/terminal/data");
        if (res.ok) {
          const json = await res.json();
          setData(json.recentPatterns || []);
        }
      } catch (err) {
        console.error("Scan fetch error:", err);
      } finally {
        setLoading(false);
      }
    }
    loadScans();
  }, []);

  const tabs = [
    { id: "ALL", label: "All Setups" },
    { id: "VCP", label: "Minervini VCP" },
    { id: "52W_BREAKOUT", label: "52W Breakouts" },
    { id: "POCKET_PIVOT", label: "Pocket Pivots" },
    { id: "PULLBACK_21EMA", label: "21 EMA Pullbacks" },
    { id: "IPO_BASE", label: "IPO Bases" },
    { id: "STAGE_2A_BREAKOUT", label: "Stage 2A Early" },
  ];

  const filtered =
    activeTab === "ALL"
      ? data
      : data.filter((s) => s.setupType === activeTab);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto w-full py-12">
        <Loader
          message="Loading Daily Setup Scans..."
          subtext="Filtering VCP patterns, pocket pivots, and 52W breakouts"
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
            <ScanLine className="w-5 h-5 text-accent" />
            <span>Daily Pattern Scanner</span>
          </h1>
          <p className="text-xs text-text-muted font-mono mt-1">
            Algorithmic detection: Minervini VCP • Pocket Pivots • 52WH Breakouts • 21EMA Pullbacks
          </p>
        </div>

        <div className="text-xs font-mono text-text-secondary bg-surface-2 border border-border px-3 py-1.5 rounded-lg shrink-0">
          Filtered Setups: <b className="text-accent font-bold">{filtered.length}</b> Counters
        </div>
      </div>

      {/* Tabs Filter Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-border">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono whitespace-nowrap transition-all ${
                isActive
                  ? "bg-accent text-white font-bold shadow-xs"
                  : "text-text-secondary hover:text-text hover:bg-surface border border-border"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Grid of Setup Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((item: any) => {
          const scoreBadge = getScoreBadge(item.technoFundaScore || 80);

          return (
            <div
              key={item.id}
              className="bg-surface border border-border rounded-xl p-4 hover:border-accent hover:shadow-sm transition-all shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/stock/${item.symbol}`}
                      className="text-base font-bold font-mono text-text hover:text-accent transition-colors tracking-tight"
                    >
                      {item.symbol}
                    </Link>
                    <span className="text-[10px] text-text-muted font-mono">
                      {new Date(item.tradeDate).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-xs bg-accent-tint text-accent border border-accent-border px-2.5 py-1 rounded-md font-mono font-bold">
                      {item.setupType}
                    </span>
                    <span
                      className={`text-xs px-2.5 py-1 rounded-md font-mono font-extrabold border ${scoreBadge.bg} ${scoreBadge.text}`}
                    >
                      {item.technoFundaScore || 80} pts
                    </span>
                  </div>
                </div>

                {/* Levels Box */}
                <div className="grid grid-cols-3 gap-2 bg-surface-2 border border-border p-3 rounded-lg mb-3 text-xs sm:text-sm font-mono">
                  <div>
                    <div className="text-xs text-text-muted uppercase font-bold tracking-wider">Pivot</div>
                    <div className="font-extrabold text-text">
                      {formatINR(item.pivotPrice)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-text-muted uppercase font-bold tracking-wider">Stop</div>
                    <div className="font-extrabold text-rose-700">
                      {formatINR(item.stopLossPrice)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-text-muted uppercase font-bold tracking-wider">Risk</div>
                    <div className="font-extrabold text-text-secondary">
                      {item.riskPct?.toFixed(1)}%
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono mb-3">
                  <div className="flex items-center justify-between bg-surface-2 px-3 py-1.5 rounded-lg border border-border">
                    <span className="text-text-muted font-bold">RS Rating:</span>
                    <span className="font-extrabold text-emerald-700">
                      {item.rsRating || "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between bg-surface-2 px-3 py-1.5 rounded-lg border border-border">
                    <span className="text-text-muted font-bold">RVOL:</span>
                    <span className="font-extrabold text-sky-700">
                      {item.rvol ? `${item.rvol.toFixed(1)}x` : "—"}
                    </span>
                  </div>
                </div>

                {item.catalystSummary && (
                  <p className="text-xs sm:text-sm text-text-secondary mb-3 leading-relaxed">
                    <b className="text-text font-bold">Catalyst:</b> {item.catalystSummary}
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-border flex items-center justify-between">
                <span className="text-xs font-mono text-emerald-800 font-bold flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md">
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                  <span>Ready Trigger</span>
                </span>

                <Link
                  href={`/stock/${item.symbol}`}
                  className="px-3 py-1 rounded-md bg-surface border border-border hover:border-accent text-xs text-text hover:text-accent font-mono font-bold flex items-center gap-1 shadow-2xs"
                >
                  <span>Trade ↗</span>
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
