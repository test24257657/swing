"use client";

import React from "react";
import { Info } from "lucide-react";

export function StageAnalysis({ data }) {
  const { totalStocks = 2388, timeframe = "64+ days", stages = [] } = data || {};

  return (
    <div className="pt-4 border-t border-[#E5EAF2]">
      {/* Header */}
      <div className="flex items-center justify-between text-[11px] mb-2">
        <div className="flex items-center gap-1 font-semibold uppercase tracking-wider text-[#64748B]">
          <span>Stage Analysis</span>
          <span title="Stage analysis classifies stocks into Wyckoff 4 market stages: 1-Base, 2-Uptrend, 3-Top, 4-Downtrend">
            <Info size={12} className="text-[#94A3B8] cursor-pointer" />
          </span>
        </div>
        <span className="text-[#94A3B8]">
          of {totalStocks.toLocaleString("en-IN")} stocks ({timeframe})
        </span>
      </div>

      {/* Stacked Progress Bar */}
      <div className="w-full h-2 rounded-full overflow-hidden flex bg-[#F1F5F9] mb-3">
        {stages.map((stg) => (
          <div
            key={stg.id}
            style={{ width: `${stg.pct}%`, backgroundColor: stg.color }}
            className="h-full transition-all duration-500"
            title={`${stg.name}: ${stg.pct}%`}
          />
        ))}
      </div>

      {/* Stage Stats Row */}
      <div className="grid grid-cols-4 gap-1 text-center">
        {stages.map((stg) => {
          const isPos = stg.change1D > 0;
          const isNeg = stg.change1D < 0;
          return (
            <div key={stg.id} className="flex flex-col items-center">
              <div className="flex items-center gap-1 text-[11px] text-[#64748B] font-medium">
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: stg.color }}
                />
                <span>{stg.name}</span>
              </div>
              <div className="text-[13px] font-bold text-[#17233B] tabular-nums mt-0.5">
                {stg.pct.toFixed(1)}%
              </div>
              <div
                className={`text-[10px] font-semibold tabular-nums mt-0.5 ${
                  stg.id === "uptrend"
                    ? isPos
                      ? "text-[#16A878]"
                      : "text-[#F05283]"
                    : stg.id === "downtrend"
                    ? isPos
                      ? "text-[#F05283]"
                      : "text-[#16A878]"
                    : "text-[#64748B]"
                }`}
              >
                {isPos ? "+" : ""}
                {stg.change1D} 1D
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default StageAnalysis;

