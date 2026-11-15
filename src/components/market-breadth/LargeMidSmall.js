"use client";

import React from "react";
import BaseCard from "@/components/ui/card";
import ComparisonChart from "@/components/charts/ComparisonChart";
import { mockMarketInternals } from "@/data/mockMarketInternals";

export function LargeMidSmall({ data = mockMarketInternals.largeMidSmall }) {
  return (
    <BaseCard padding="p-3.5" className="flex flex-col justify-between space-y-2 w-full min-w-0">
      {/* Header */}
      <div>
        <div className="text-xs font-bold text-[#17233B]">Large vs Mid vs Small</div>
        <div className="text-[10px] text-[#64748B]">{data.referenceDateText}</div>
      </div>

      {/* Legend & Stats */}
      <div className="flex items-center gap-3 text-[11px] font-semibold flex-wrap">
        <span className="bg-[#EFF6FF] text-[#3478F6] px-1.5 py-0.5 rounded-[4px]">
          {data.statusText}
        </span>
        {data.segments.map((seg) => {
          const isPos = seg.pct >= 0;
          return (
            <span key={seg.id} className="flex items-center gap-1 text-[#64748B]">
              <span
                className="w-2 h-0.5 rounded inline-block"
                style={{ backgroundColor: seg.color }}
              />
              <span className="font-normal">{seg.label}:</span>
              <span
                className="tabular-nums font-bold"
                style={{ color: seg.color }}
              >
                {isPos ? "+" : ""}
                {seg.pct.toFixed(1)}%
              </span>
            </span>
          );
        })}
      </div>

      {/* Chart */}
      <ComparisonChart
        data={data.chartData}
        xKey="date"
        lines={[
          { key: "large", name: "Nifty 50 (Large)", color: "#3478F6", strokeWidth: 1.75 },
          { key: "mid", name: "Midcap 150 (Mid)", color: "#F97316", strokeWidth: 1.5 },
          { key: "small", name: "Smallcap 250 (Small)", color: "#16A878", strokeWidth: 1.5 },
        ]}
        height={115}
        yUnit="%"
      />
    </BaseCard>
  );
}

export default LargeMidSmall;
