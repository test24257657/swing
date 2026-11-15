"use client";

import React, { useState } from "react";
import BaseCard from "@/components/ui/card";
import SegmentedControl from "@/components/ui/segmented-control";
import BaseAreaChart from "@/components/charts/BaseAreaChart";
import { mockMarketInternals } from "@/data/mockMarketInternals";

export function NewHighsLows({ data = mockMarketInternals.newHighsLows }) {
  const [period, setPeriod] = useState("20D");

  const PERIODS = [
    { id: "20D", label: "20D" },
    { id: "52W", label: "52W" },
  ];

  return (
    <BaseCard padding="p-3.5" className="flex flex-col justify-between space-y-2">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-bold text-[#17233B]">New highs − lows</div>
          <div className="text-[10px] text-[#64748B]">
            Stocks at a {period} high minus those at a {period} low
          </div>
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
          <span className="text-[18px] font-bold text-[#3478F6] tabular-nums">
            +{data.net}
          </span>
          <span className="text-[11px] font-medium text-[#64748B]">
            {data.statusText}
          </span>
        </div>
        <div className="text-[10px] text-[#64748B]">
          {data.highs} highs / {data.lows} lows
        </div>
      </div>

      <div className="text-[10px] text-[#16A878] font-semibold">
        {data.weeklyChange}
      </div>

      {/* Chart */}
      <BaseAreaChart
        data={data.chartData}
        xKey="date"
        series={[
          {
            key: "net",
            name: "Net Highs",
            color: "#3478F6",
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
        yDomain={[-300, 300]}
        referenceLines={[{ y: 0, color: "#E2E8F0" }]}
      />
    </BaseCard>
  );
}

export default NewHighsLows;

