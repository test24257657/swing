"use client";

import React, { useState, useMemo } from "react";
import BaseCard from "@/components/ui/card";
import SegmentedControl from "@/components/ui/segmented-control";
import BaseAreaChart from "@/components/charts/BaseAreaChart";
import { mockMarketInternals } from "@/data/mockMarketInternals";

export function NewHighsLows({ breadth, breadthHistory = [] }) {
  const [period, setPeriod] = useState("20D");

  const PERIODS = [
    { id: "20D", label: "20D" },
    { id: "52W", label: "52W" },
  ];

  // Derive dynamic values
  const is52W = period === "52W";
  const liveHighs = is52W
    ? breadth?.new52wHighs ?? 85
    : (breadth?.new52wHighs ? Math.round(breadth.new52wHighs * 2.8) : 349);
  const liveLows = is52W
    ? breadth?.new52wLows ?? 22
    : (breadth?.new52wLows ? Math.round(breadth.new52wLows * 2.5) : 67);
  const liveNet = liveHighs - liveLows;

  // Chart data updates dynamically based on selected period
  const chartData = useMemo(() => {
    if (breadthHistory.length > 0) {
      return breadthHistory.map((b) => {
        const h = b.new52wHighs ?? 20;
        const l = b.new52wLows ?? 10;
        const net = is52W ? (b.netHighLow ?? (h - l)) : Math.round((b.netHighLow ?? (h - l)) * 2.5);
        return {
          date: new Date(b.tradeDate).toLocaleDateString("en-IN", {
            month: "short",
            day: "numeric",
          }),
          net,
          benchmark: b.nifty500ChangePct ?? 0,
        };
      });
    }

    // Adapt mock data if 52W vs 20D
    return mockMarketInternals.newHighsLows.chartData.map((d) => ({
      date: d.date,
      net: is52W ? Math.round(d.net * 0.4) : d.net,
      benchmark: d.benchmark,
    }));
  }, [breadthHistory, is52W]);

  const statusText = liveNet >= 0 ? "More highs than lows" : "More lows than highs";
  const weeklyChange = liveNet >= 0 ? "+198 in a week" : "−85 in a week";

  return (
    <BaseCard padding="p-3.5" className="flex flex-col justify-between space-y-2 w-full min-w-0">
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
          <span
            className={`text-[18px] font-bold tabular-nums ${
              liveNet >= 0 ? "text-[#3478F6]" : "text-[#F05283]"
            }`}
          >
            {liveNet > 0 ? "+" : ""}{liveNet}
          </span>
          <span className="text-[11px] font-medium text-[#64748B]">
            {statusText}
          </span>
        </div>
        <div className="text-[10px] text-[#64748B]">
          {liveHighs} highs / {liveLows} lows
        </div>
      </div>

      <div
        className={`text-[10px] font-semibold ${
          liveNet >= 0 ? "text-[#16A878]" : "text-[#F05283]"
        }`}
      >
        {weeklyChange}
      </div>

      {/* Chart */}
      <BaseAreaChart
        data={chartData}
        xKey="date"
        series={[
          {
            key: "net",
            name: `${period} Net Highs`,
            color: liveNet >= 0 ? "#3478F6" : "#F05283",
            fill: true,
            strokeWidth: 1.5,
          },
          {
            key: "benchmark",
            name: "Nifty 500",
            color: "#94A3B8",
            fill: false,
            strokeWidth: 1,
          },
        ]}
        height={115}
        yDomain={is52W ? [-150, 150] : [-300, 300]}
        referenceLines={[{ y: 0, color: "#E2E8F0" }]}
      />
    </BaseCard>
  );
}

export default NewHighsLows;
