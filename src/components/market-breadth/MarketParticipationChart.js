"use client";

import React, { useState } from "react";
import SegmentedControl from "@/components/ui/segmented-control";
import BaseAreaChart from "@/components/charts/BaseAreaChart";
import StatusBadge from "@/components/ui/badge";

export function MarketParticipationChart({ data = [], stats = {} }) {
  const [period, setPeriod] = useState("20D");

  const {
    currentPct = 74.4,
    status = "Broad",
    weeklyChangePts = 20.6,
  } = stats;

  const PERIODS = [
    { id: "20D", label: "20D" },
    { id: "50D", label: "50D" },
    { id: "200D", label: "200D" },
  ];

  return (
    <div className="space-y-3">
      {/* Top Header & Controls */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[13px] font-bold text-[#17233B] tracking-tight">
            Market participation
          </div>
          <div className="text-[11px] text-[#64748B]">
            Share of stocks above their {period} average, as of Fri 13 Nov
          </div>
        </div>

        <SegmentedControl
          options={PERIODS}
          value={period}
          onChange={setPeriod}
          size="xs"
        />
      </div>

      {/* Numerical Stats Row */}
      <div className="flex items-center gap-3">
        <span className="text-[24px] font-bold text-[#17233B] tabular-nums tracking-tight">
          {currentPct.toFixed(1)}%
        </span>
        <StatusBadge status="info">{status}</StatusBadge>
        <span className="text-[11px] font-semibold text-[#16A878] tabular-nums">
          +{weeklyChangePts.toFixed(1)} pts in a week
        </span>

        {/* Legend */}
        <div className="ml-auto hidden sm:flex items-center gap-3 text-[10px] text-[#64748B]">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-0.5 bg-[#3478F6] inline-block rounded" />
            Participation
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-0.5 bg-[#94A3B8] inline-block rounded" />
            Nifty 500
          </span>
        </div>
      </div>

      {/* Chart */}
      <BaseAreaChart
        data={data}
        xKey="date"
        series={[
          {
            key: "participation",
            name: "Participation",
            color: "#3478F6",
            fill: true,
            strokeWidth: 2,
          },
          {
            key: "benchmark",
            name: "Nifty 500",
            color: "#94A3B8",
            fill: false,
            strokeWidth: 1.5,
          },
        ]}
        height={130}
        yDomain={[0, 100]}
        yUnit="%"
        referenceLines={[
          { y: 20, color: "#E2E8F0", strokeDasharray: "2 2" },
          { y: 50, color: "#E2E8F0", strokeDasharray: "2 2" },
          { y: 80, color: "#E2E8F0", strokeDasharray: "2 2" },
        ]}
      />
    </div>
  );
}

export default MarketParticipationChart;

