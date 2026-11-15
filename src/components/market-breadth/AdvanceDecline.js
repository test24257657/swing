"use client";

import React, { useState } from "react";
import BaseCard from "@/components/ui/card";
import SegmentedControl from "@/components/ui/segmented-control";
import BaseAreaChart from "@/components/charts/BaseAreaChart";
import { mockMarketInternals } from "@/data/mockMarketInternals";

export function AdvanceDecline({ data = mockMarketInternals.advanceDecline }) {
  const [period, setPeriod] = useState("20D");

  const PERIODS = [
    { id: "20D", label: "20D" },
    { id: "40D", label: "40D" },
    { id: "AD", label: "A-D line" },
  ];

  return (
    <BaseCard padding="p-3.5" className="flex flex-col justify-between space-y-2">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-bold text-[#17233B]">Advance / Decline</div>
          <div className="text-[10px] text-[#64748B]">Stocks that rose vs fell, {period} average</div>
        </div>
        <SegmentedControl
          options={PERIODS}
          value={period}
          onChange={setPeriod}
          size="xs"
        />
      </div>

      {/* Numerical row */}
      <div className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-2">
          <span className="text-[18px] font-bold text-[#17233B] tabular-nums">
            {data.ratio.toFixed(2)}
          </span>
          <span className="text-[11px] font-medium text-[#64748B]">{data.statusText}</span>
          <span className="text-[10px] text-[#16A878] font-semibold">{data.weeklyChange}</span>
        </div>
        <div className="text-[10px] text-[#64748B]">{data.subtext}</div>
      </div>

      {/* Chart */}
      <BaseAreaChart
        data={data.chartData}
        xKey="date"
        series={[
          {
            key: "ratio",
            name: "A/D Ratio",
            color: "#F05283",
            fill: true,
            strokeWidth: 1.5,
          },
          {
            key: "benchmark",
            name: "Benchmark",
            color: "#94A3B8",
            fill: false,
            strokeWidth: 1,
          },
        ]}
        height={75}
        yDomain={[0.5, 1.2]}
        referenceLines={[{ y: 1.0, color: "#E2E8F0" }]}
      />
    </BaseCard>
  );
}

export default AdvanceDecline;

