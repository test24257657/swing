"use client";

import React, { useState } from "react";
import BaseCard from "@/components/ui/card";
import SegmentedControl from "@/components/ui/segmented-control";
import ComparisonChart from "@/components/charts/ComparisonChart";
import { mockMarketInternals } from "@/data/mockMarketInternals";

export function ParticipationHistory({ data = mockMarketInternals.participationHistory }) {
  const [period, setPeriod] = useState("20D");

  const PERIODS = [
    { id: "20D", label: "20D" },
    { id: "50D", label: "50D" },
    { id: "200D", label: "200D" },
  ];

  return (
    <BaseCard padding="p-3.5" className="flex flex-col justify-between space-y-2">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-bold text-[#17233B]">Participation history</div>
          <div className="text-[10px] text-[#64748B]">
            % stocks above 20 EMA, 50 SMA, 200 SMA
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
      <div className="flex items-center gap-3 text-[11px] font-semibold">
        <span className="flex items-center gap-1 text-[#3478F6]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#3478F6]" />
          20 EMA: {data.pct20}%
        </span>
        <span className="flex items-center gap-1 text-[#F97316]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#F97316]" />
          50 SMA: {data.pct50}%
        </span>
        <span className="flex items-center gap-1 text-[#94A3B8]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#94A3B8]" />
          200 SMA: {data.pct200}%
        </span>
      </div>

      {/* Chart */}
      <ComparisonChart
        data={data.chartData}
        xKey="date"
        lines={[
          { key: "above20", name: ">20 EMA", color: "#3478F6", strokeWidth: 1.75 },
          { key: "above50", name: ">50 SMA", color: "#F97316", strokeWidth: 1.5 },
          { key: "above200", name: ">200 SMA", color: "#94A3B8", strokeWidth: 1.25 },
        ]}
        height={75}
        yUnit="%"
      />
    </BaseCard>
  );
}

export default ParticipationHistory;
