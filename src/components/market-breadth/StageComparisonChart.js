"use client";

import React from "react";
import BaseAreaChart from "@/components/charts/BaseAreaChart";

export function StageComparisonChart({ data = [] }) {
  const latest = data[data.length - 1] || { stage2: 38.7, stage4: 46.1 };

  return (
    <div className="space-y-2 pt-3 border-t border-[#E5EAF2]">
      {/* Title & Legend */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[13px] font-bold text-[#17233B] tracking-tight">
            Stage 2 vs Stage 4
          </div>
          <div className="text-[11px] text-[#64748B]">Share of stocks in each stage</div>
        </div>

        {/* Legend with latest values */}
        <div className="flex items-center gap-3 text-xs font-semibold">
          <span className="flex items-center gap-1.5 text-[#3478F6]">
            <span className="w-2 h-2 rounded-xs bg-[#3478F6]" />
            Stage 2: {latest.stage2?.toFixed(1)}%
          </span>
          <span className="flex items-center gap-1.5 text-[#F05283]">
            <span className="w-2 h-2 rounded-xs bg-[#F05283]" />
            Stage 4: {latest.stage4?.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Chart */}
      <BaseAreaChart
        data={data}
        xKey="date"
        series={[
          {
            key: "stage2",
            name: "Stage 2 (Uptrend)",
            color: "#3478F6",
            fill: true,
            strokeWidth: 1.75,
          },
          {
            key: "stage4",
            name: "Stage 4 (Downtrend)",
            color: "#F05283",
            fill: true,
            strokeWidth: 1.75,
          },
        ]}
        height={130}
        yDomain={[0, 70]}
        yUnit="%"
        referenceLines={[{ y: 35, color: "#E2E8F0", strokeDasharray: "2 2" }]}
      />
    </div>
  );
}

export default StageComparisonChart;
