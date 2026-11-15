"use client";

import React from "react";
import BaseCard from "@/components/ui/card";
import BaseAreaChart from "@/components/charts/BaseAreaChart";
import { mockMarketInternals } from "@/data/mockMarketInternals";

export function BreakoutsBreakdowns({ data = mockMarketInternals.breakoutsBreakdowns }) {
  return (
    <BaseCard padding="p-3.5" className="flex flex-col justify-between space-y-2">
      {/* Header */}
      <div>
        <div className="text-xs font-bold text-[#17233B]">Breakouts − breakdowns</div>
        <div className="text-[10px] text-[#64748B]">
          Breakouts that held minus those that failed, each day
        </div>
      </div>

      {/* Numerical row */}
      <div className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-2">
          <span className="text-[18px] font-bold text-[#3478F6] tabular-nums">
            +{data.net}
          </span>
          <span className="text-[11px] font-medium text-[#64748B]">{data.statusText}</span>
        </div>
        <div className="text-[10px] text-[#64748B]">{data.subtext}</div>
      </div>

      {/* Chart */}
      <BaseAreaChart
        data={data.chartData}
        xKey="date"
        series={[
          {
            key: "net",
            name: "Net Breakouts",
            color: "#3478F6",
            fill: true,
            strokeWidth: 1.5,
          },
        ]}
        height={75}
        yDomain={[-40, 30]}
        referenceLines={[{ y: 0, color: "#E2E8F0" }]}
      />
    </BaseCard>
  );
}

export default BreakoutsBreakdowns;
