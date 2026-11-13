"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  BookmarkCheck,
  Plus,
  Trash2,
  Calculator,
  ArrowUpRight,
} from "lucide-react";
import { formatINR, formatPct } from "@/lib/format";
import RiskCalculator from "@/components/risk-calculator";
import { Loader } from "@/components/ui/loader";

export default function WatchlistPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("ALL");
  const [newSymbol, setNewSymbol] = useState("");
  const [newListType, setNewListType] = useState("WATCHLIST");
  const [newTrigger, setNewTrigger] = useState("");
  const [newStop, setNewStop] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [calcItem, setCalcItem] = useState<any | null>(null);

  useEffect(() => {
    loadWatchlist();
  }, []);

  async function loadWatchlist() {
    try {
      const res = await fetch("/api/watchlist");
      if (res.ok) {
        const json = await res.json();
        setItems(json.items || []);
      }
    } catch (err) {
      console.error("Watchlist load error:", err);
    } finally {
      setLoading(false);
    }
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSymbol) return;

    try {
      await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: newSymbol.toUpperCase(),
          listType: newListType,
          triggerPrice: newTrigger ? parseFloat(newTrigger) : null,
          stopLossPrice: newStop ? parseFloat(newStop) : null,
          notes: newNotes,
        }),
      });

      setNewSymbol("");
      setNewTrigger("");
      setNewStop("");
      setNewNotes("");
      setShowAddForm(false);
      loadWatchlist();
    } catch (err) {
      console.error("Add watchlist error:", err);
    }
  };

  const handleDelete = async (symbol: string) => {
    try {
      await fetch(`/api/watchlist?symbol=${symbol}`, { method: "DELETE" });
      loadWatchlist();
    } catch (err) {
      console.error("Delete watchlist error:", err);
    }
  };

  const filtered =
    activeTab === "ALL"
      ? items
      : items.filter((i) => i.listType === activeTab);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto w-full py-12">
        <Loader
          message="Loading Watchlist..."
          subtext="Fetching personalized alerts & active swing positions"
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
            <BookmarkCheck className="w-5 h-5 text-accent" />
            <span>Watchlist & Active Swing Positions</span>
          </h1>
          <p className="text-xs text-text-muted font-mono mt-1">
            Personal portfolio tracker with price trigger alerts and position sizing
          </p>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white font-semibold text-xs font-mono transition-all shadow-xs shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>{showAddForm ? "Cancel" : "Add Symbol"}</span>
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <form
          onSubmit={handleAdd}
          className="bg-surface border border-border rounded-xl p-4 shadow-sm space-y-4"
        >
          <div className="text-xs font-mono font-bold uppercase tracking-wider text-text">
            Track New Symbol / Position
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <label className="block text-[10px] font-mono uppercase text-text-muted mb-1">
                Symbol
              </label>
              <input
                required
                placeholder="RELIANCE"
                value={newSymbol}
                onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
                className="w-full bg-surface-2 border border-border rounded px-2.5 py-1.5 text-xs text-text font-mono focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono uppercase text-text-muted mb-1">
                Category
              </label>
              <select
                value={newListType}
                onChange={(e) => setNewListType(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded px-2.5 py-1.5 text-xs text-text font-mono focus:outline-none focus:border-accent"
              >
                <option value="WATCHLIST">Watchlist</option>
                <option value="READY_TRIGGER">Ready Trigger</option>
                <option value="ACTIVE_POSITION">Active Position</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-mono uppercase text-text-muted mb-1">
                Trigger / Pivot (₹)
              </label>
              <input
                type="number"
                step="0.05"
                placeholder="1500"
                value={newTrigger}
                onChange={(e) => setNewTrigger(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded px-2.5 py-1.5 text-xs text-text font-mono focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono uppercase text-text-muted mb-1">
                Stop Loss (₹)
              </label>
              <input
                type="number"
                step="0.05"
                placeholder="1425"
                value={newStop}
                onChange={(e) => setNewStop(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded px-2.5 py-1.5 text-xs text-text font-mono focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono uppercase text-text-muted mb-1">
                Notes / Setup
              </label>
              <input
                placeholder="VCP pivot breakout"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded px-2.5 py-1.5 text-xs text-text font-mono focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 rounded text-xs font-mono text-text-secondary hover:text-text border border-border bg-surface"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded text-xs font-mono bg-accent text-white hover:bg-accent-hover font-semibold"
            >
              Save to Tracked
            </button>
          </div>
        </form>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-border">
        {["ALL", "WATCHLIST", "READY_TRIGGER", "ACTIVE_POSITION"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono whitespace-nowrap transition-all ${
              activeTab === tab
                ? "bg-accent text-white font-bold shadow-xs"
                : "text-text-secondary hover:text-text hover:bg-surface border border-border"
            }`}
          >
            {tab.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* Watchlist Table */}
      <div className="bg-surface border border-border rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-text-muted font-mono uppercase text-[10px]">
                <th className="py-3 px-3">Symbol</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Trigger Price</th>
                <th className="py-3 px-3">Stop Loss</th>
                <th className="py-3 px-3">Risk %</th>
                <th className="py-3 px-3">Notes</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((item) => {
                const diff =
                  item.triggerPrice && item.stopLossPrice
                    ? item.triggerPrice - item.stopLossPrice
                    : 0;
                const riskPct =
                  diff > 0 && item.triggerPrice
                    ? ((diff / item.triggerPrice) * 100).toFixed(1)
                    : "—";

                return (
                  <tr key={item.id} className="hover:bg-surface-2 transition-colors">
                    <td className="py-3 px-3.5 font-mono font-extrabold text-text text-sm sm:text-base">
                      <Link href={`/stock/${item.symbol}`} className="hover:text-accent">
                        {item.symbol}
                      </Link>
                    </td>
                    <td className="py-3 px-3.5 font-mono">
                      <span className="px-2.5 py-1 rounded text-xs font-bold bg-surface-2 border border-border text-text-secondary">
                        {item.listType.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 font-mono text-text font-bold text-xs sm:text-sm">
                      {item.triggerPrice ? formatINR(item.triggerPrice) : "—"}
                    </td>
                    <td className="py-3 px-3.5 font-mono text-rose-700 font-bold text-xs sm:text-sm">
                      {item.stopLossPrice ? formatINR(item.stopLossPrice) : "—"}
                    </td>
                    <td className="py-3 px-3.5 font-mono text-text-secondary font-bold text-xs sm:text-sm">
                      {riskPct !== "—" ? `${riskPct}%` : "—"}
                    </td>
                    <td className="py-3 px-3.5 text-text-secondary max-w-xs truncate text-xs sm:text-sm font-medium">
                      {item.notes || "—"}
                    </td>
                    <td className="py-3 px-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setCalcItem(item)}
                          title="Calculate 1% Risk Size"
                          className="p-1.5 rounded-md text-text-secondary hover:text-accent hover:bg-surface-2 transition-colors"
                        >
                          <Calculator className="w-4 h-4" />
                        </button>
                        <Link
                          href={`/stock/${item.symbol}`}
                          className="p-1.5 rounded-md text-text-secondary hover:text-accent hover:bg-surface-2 transition-colors"
                        >
                          <ArrowUpRight className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => handleDelete(item.symbol)}
                          title="Remove from Watchlist"
                          className="p-1.5 rounded-md text-text-secondary hover:text-rose-700 hover:bg-rose-50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="py-8 text-center text-xs font-mono text-text-muted"
                  >
                    No symbols currently in this category. Click &quot;Add Symbol&quot; to track setups.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sizing Modal */}
      {calcItem && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          onClick={() => setCalcItem(null)}
        >
          <div className="max-w-xl w-full bg-surface rounded-xl p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <RiskCalculator
              symbol={calcItem.symbol}
              initialPrice={calcItem.triggerPrice || 1000}
              initialStop={calcItem.stopLossPrice || 950}
            />
            <div className="text-center mt-3">
              <button
                onClick={() => setCalcItem(null)}
                className="text-xs text-text-muted hover:text-text font-mono underline"
              >
                Close Calculator [ESC]
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
