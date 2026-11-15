"use client";

import React, { useState, useMemo } from "react";
import BaseCard from "@/components/ui/card";
import SegmentedControl from "@/components/ui/segmented-control";
import ComparisonChart from "@/components/charts/ComparisonChart";
import { mockMarketInternals } from "@/data/mockMarketInternals";

export function ParticipationHistory({ breadth, breadthHistory = [] }) {
  const [period, setPeriod] = useState("All");

  const PERIODS = [
    { id: "All", label: "All" },
    { id: "20D", label: "20 EMA" },
    { id: "50D", label: "50 SMA" },
    { id: "200D", label: "200 SMA" },
  ];

  // Dynamic values from database
  const pct20 = breadth?.pctAbove20Ema ?? 74.4;
  const pct50 = breadth?.pctAbove50Sma ?? 48.2;
  const pct200 = breadth?.pctAbove200Sma ?? 55.6;

  // Chart data with dynamic DB history merged with mock baseline
  const chartData = useMemo(() => {
    if (breadthHistory.length > 0) {
      const dbPoints = breadthHistory.map((b) => ({
        date: new Date(b.tradeDate).toLocaleDateString("en-IN", {
          month: "short",
          day: "numeric",
        }),
        above20: b.pctAbove20Ema ?? 70,
        above50: b.pctAbove50Sma ?? 48,
        above200: b.pctAbove200Sma ?? 55,
      }));

      if (dbPoints.length < 6) {
        const base = mockMarketInternals.participationHistory.chartData.slice(
          0,
          6 - dbPoints.length
        );
        return [...base, ...dbPoints];
      }
      return dbPoints;
    }

    // Default mock series with today's live values replacing the last point
    const base = [...mockMarketInternals.participationHistory.chartData];
    if (breadth && base.length > 0) {
      base[base.length - 1] = {
        ...base[base.length - 1],
        above20: pct20,
        above50: pct50,
        above200: pct200,
      };
    }
    return base;
  }, [breadth, breadthHistory, pct20, pct50, pct200]);

  // Dynamic lines configuration based on active button
  const lines = useMemo(() => {
    if (period === "20D") {
      return [
        { key: "above20", name: ">20 EMA", color: "#3478F6", strokeWidth: 2.2 },
        { key: "above50", name: ">50 SMA", color: "#E2E8F0", strokeWidth: 1 },
        { key: "above200", name: ">200 SMA", color: "#CBD5E1", strokeWidth: 1 },
      ];
    }
    if (period === "50D") {
      return [
        { key: "above20", name: ">20 EMA", color: "#CBD5E1", strokeWidth: 1 },
        { key: "above50", name: ">50 SMA", color: "#F97316", strokeWidth: 2.2 },
        { key: "above200", name: ">200 SMA", color: "#E2E8F0", strokeWidth: 1 },
      ];
    }
    if (period === "200D") {
      return [
        { key: "above20", name: ">20 EMA", color: "#E2E8F0", strokeWidth: 1 },
        { key: "above50", name: ">50 SMA", color: "#CBD5E1", strokeWidth: 1 },
        { key: "above200", name: ">200 SMA", color: "#16A878", strokeWidth: 2.2 },
      ];
    }
    // "All"
    return [
      { key: "above20", name: ">20 EMA", color: "#3478F6", strokeWidth: 1.75 },
      { key: "above50", name: ">50 SMA", color: "#F97316", strokeWidth: 1.5 },
      { key: "above200", name: ">200 SMA", color: "#16A878", strokeWidth: 1.25 },
    ];
  }, [period]);

  return (
    <BaseCard padding="p-3.5" className="flex flex-col justify-between space-y-2 w-full min-w-0">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-bold text-[#17233B]">Participation history</div>
          <div className="text-[10px] text-[#64748B]">
            {period === "All"
              ? "% stocks above 20 EMA, 50 SMA, 200 SMA"
              : `Focus on % stocks above ${period === "20D" ? "20 EMA" : period === "50D" ? "50 SMA" : "200 SMA"}`}
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
      <div className="flex items-center gap-2.5 text-[11px] font-semibold flex-wrap">
        <span
          className={`flex items-center gap-1 transition-opacity ${
            period === "All" || period === "20D" ? "opacity-100 text-[#3478F6] font-bold" : "opacity-40 text-[#64748B]"
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#3478F6]" />
          20 EMA: {pct20}%
        </span>
        <span
          className={`flex items-center gap-1 transition-opacity ${
            period === "All" || period === "50D" ? "opacity-100 text-[#F97316] font-bold" : "opacity-40 text-[#64748B]"
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#F97316]" />
          50 SMA: {pct50}%
        </span>
        <span
          className={`flex items-center gap-1 transition-opacity ${
            period === "All" || period === "200D" ? "opacity-100 text-[#16A878] font-bold" : "opacity-40 text-[#64748B]"
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#16A878]" />
          200 SMA: {pct200}%
        </span>
      </div>

      {/* Chart */}
      <ComparisonChart
        data={chartData}
        xKey="date"
        lines={lines}
        height={115}
        yUnit="%"
      />
    </BaseCard>
  );
}

export default ParticipationHistory;
