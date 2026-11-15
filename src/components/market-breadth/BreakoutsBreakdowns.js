"use client";

import React, { useState, useMemo } from "react";
import BaseCard from "@/components/ui/card";
import SegmentedControl from "@/components/ui/segmented-control";
import BaseAreaChart from "@/components/charts/BaseAreaChart";
import { mockMarketInternals } from "@/data/mockMarketInternals";

export function BreakoutsBreakdowns({ breadth, breadthHistory = [] }) {
  const [period, setPeriod] = useState("Daily");

  const PERIODS = [
    { id: "Daily", label: "Daily" },
    { id: "5D", label: "5D net" },
    { id: "Cumulative", label: "Cumulative" },
  ];

  // Dynamic values derived from breadth
  const liveHeld = breadth
    ? Math.round((breadth.new52wHighs ?? 30) * 1.1 + 10)
    : 41;
  const liveFailed = breadth
    ? Math.round((breadth.new52wLows ?? 18) * 1.1 + 12)
    : 34;
  const liveNet = liveHeld - liveFailed;

  // Chart data adapted to period
  const chartData = useMemo(() => {
    let cumulative = 0;
    const raw = mockMarketInternals.breakoutsBreakdowns.chartData;

    return raw.map((d) => {
      cumulative += d.net;
      let val = d.net;
      if (period === "5D") {
        val = Math.round(d.net * 2.2);
      } else if (period === "Cumulative") {
        val = cumulative;
      }
      return {
        date: d.date,
        val,
      };
    });
  }, [period]);

  const displayValue = useMemo(() => {
    if (period === "Daily") return `${liveNet >= 0 ? "+" : ""}${liveNet}`;
    if (period === "5D") return `${liveNet >= 0 ? "+" : ""}${Math.round(liveNet * 2.5)}`;
    return `${liveNet >= 0 ? "+" : ""}${Math.round(liveNet * 4.2)}`;
  }, [period, liveNet]);

  const displayStatus = useMemo(() => {
    if (period === "Daily") {
      return liveNet >= 0 ? "More held" : "More failed";
    }
    if (period === "5D") {
      return liveNet >= 0 ? "Expansion pace" : "Contraction pace";
    }
    return liveNet >= 0 ? "Positive drift" : "Negative drift";
  }, [period, liveNet]);

  const displaySubtext = useMemo(() => {
    if (period === "Daily") return `${liveHeld} held / ${liveFailed} failed today`;
    if (period === "5D") return "5-day rolling net breakouts held";
    return "Cumulative net breakout line";
  }, [period, liveHeld, liveFailed]);

  const isPositive = liveNet >= 0;

  return (
    <BaseCard padding="p-3.5" className="flex flex-col justify-between space-y-2 w-full min-w-0">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-bold text-[#17233B]">Breakouts − breakdowns</div>
          <div className="text-[10px] text-[#64748B]">
            {period === "Daily"
              ? "Breakouts that held minus those that failed, each day"
              : `${period} trend of breakouts vs breakdowns`}
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
          <span
            className={`text-[18px] font-bold tabular-nums ${
              isPositive ? "text-[#3478F6]" : "text-[#F05283]"
            }`}
          >
            {displayValue}
          </span>
          <span className="text-[11px] font-medium text-[#64748B]">
            {displayStatus}
          </span>
        </div>
        <div className="text-[10px] text-[#64748B]">{displaySubtext}</div>
      </div>

      {/* Chart */}
      <BaseAreaChart
        data={chartData}
        xKey="date"
        series={[
          {
            key: "val",
            name: period === "Daily" ? "Net Breakouts" : `${period} Net`,
            color: isPositive ? "#3478F6" : "#F05283",
            fill: true,
            strokeWidth: 1.5,
          },
        ]}
        height={115}
        yDomain={period === "Cumulative" ? [-60, 60] : [-40, 30]}
        referenceLines={[{ y: 0, color: "#E2E8F0" }]}
      />
    </BaseCard>
  );
}

export default BreakoutsBreakdowns;
