"use client";

import React from "react";
import { Activity, ChevronDown } from "lucide-react";
import { STOCK_UNIVERSES, PERIOD_OPTIONS } from "@/lib/constants";
import SegmentedControl from "@/components/ui/segmented-control";

export function DashboardHeader({
  activeTab = "breadth",
  onTabChange,
  selectedUniverse = "all",
  onUniverseChange,
  selectedPeriod = "1M",
  onPeriodChange,
}) {
  const currentUniverse =
    STOCK_UNIVERSES.find((u) => u.id === selectedUniverse) || STOCK_UNIVERSES[0];

  return (
    <div className="bg-white border-b border-[#E5EAF2] px-4 py-3 -mx-3 sm:-mx-4 md:-mx-5 -mt-3 sm:-mt-4 md:-mt-5 mb-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 w-full">
        {/* Left: Product title, date & navigation tabs */}
        <div className="flex items-center gap-5 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-[6px] bg-[#3478F6] flex items-center justify-center text-white shadow-xs">
              <Activity size={16} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-[15px] font-bold text-[#17233B] tracking-tight leading-none">
                Market Breadth
              </h1>
              <span className="text-[11px] text-[#94A3B8] font-medium leading-none">
                Read as of Fri, 13 Nov 2026
              </span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 border-l border-[#E5EAF2] pl-4">
            <button
              type="button"
              onClick={() => onTabChange && onTabChange("breadth")}
              className={`text-xs font-semibold px-3 py-1.5 rounded-[6px] transition-all cursor-pointer ${
                activeTab === "breadth"
                  ? "bg-[#EFF6FF] text-[#3478F6]"
                  : "text-[#64748B] hover:text-[#17233B] hover:bg-[#F8FAFC]"
              }`}
            >
              Market Breadth
            </button>
            <button
              type="button"
              onClick={() => onTabChange && onTabChange("internals")}
              className={`text-xs font-semibold px-3 py-1.5 rounded-[6px] transition-all cursor-pointer ${
                activeTab === "internals"
                  ? "bg-[#EFF6FF] text-[#3478F6]"
                  : "text-[#64748B] hover:text-[#17233B] hover:bg-[#F8FAFC]"
              }`}
            >
              Market Internals
            </button>
          </div>
        </div>

        {/* Right: Stock universe dropdown, stock count, period selector */}
        <div className="flex items-center gap-3 self-end lg:self-auto flex-wrap">
          {/* Stock universe dropdown */}
          <div className="relative inline-block z-10">
            <select
              value={selectedUniverse}
              onChange={(e) => {
                if (onUniverseChange) {
                  onUniverseChange(e.target.value);
                }
              }}
              className="appearance-none bg-[#F8FAFC] border border-[#E5EAF2] rounded-[6px] text-xs font-medium text-[#17233B] pl-2.5 pr-8 py-1 h-7.5 hover:border-[#CBD5E1] focus:outline-none focus:border-[#3478F6] focus:ring-1 focus:ring-[#3478F6] cursor-pointer shadow-2xs"
            >
              {STOCK_UNIVERSES.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label} ({u.count.toLocaleString("en-IN")})
                </option>
              ))}
            </select>
            <ChevronDown
              size={13}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748B] pointer-events-none"
            />
          </div>

          {/* Period selector (1M / 3M / 1Y) */}
          <SegmentedControl
            options={PERIOD_OPTIONS}
            value={selectedPeriod}
            onChange={(val) => {
              if (onPeriodChange) {
                onPeriodChange(val);
              }
            }}
            size="sm"
          />
        </div>
      </div>
    </div>
  );
}

export default DashboardHeader;
