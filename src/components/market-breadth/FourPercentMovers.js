"use client";

import React, { useState } from "react";
import BaseCard from "@/components/ui/card";
import SegmentedControl from "@/components/ui/segmented-control";
import BaseAreaChart from "@/components/charts/BaseAreaChart";
import { mockMarketInternals } from "@/data/mockMarketInternals";

export function FourPercentMovers({ data = mockMarketInternals.fourPercentMovers }) {
  const [period, setPeriod] = useState("Daily");

  const PERIODS = [
    { id: "Daily", label: "Daily" },
    { id: "5D", label: "5D ratio" },
    { id: "10D", label: "10D ratio" },
  ];

  return (
    <BaseCard padding="p-3.5" className="flex flex-col justify-between space-y-2">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-bold text-[#17233B]">4% movers</div>
          <div className="text-[10px] text-[#64748B]">Up 4%+ minus down 4%+, each day</div>
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
            name: "4% Movers",
            color: "#3478F6",
            fill: true,
            strokeWidth: 1.5,
          },
        ]}
        height={75}
        yDomain={[-80, 80]}
        referenceLines={[{ y: 0, color: "#E2E8F0" }]}
      />
    </BaseCard>
  );
}

export default FourPercentMovers;
