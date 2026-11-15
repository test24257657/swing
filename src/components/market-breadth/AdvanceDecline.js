"use client";

import React, { useState, useMemo } from "react";
import BaseCard from "@/components/ui/card";
import SegmentedControl from "@/components/ui/segmented-control";
import BaseAreaChart from "@/components/charts/BaseAreaChart";
import { mockMarketInternals } from "@/data/mockMarketInternals";

export function AdvanceDecline({ breadth, breadthHistory = [] }) {
  const [period, setPeriod] = useState("20D");

  const PERIODS = [
    { id: "20D", label: "20D" },
    { id: "40D", label: "40D" },
    { id: "AD", label: "A-D line" },
  ];

  const advances = breadth?.advances ?? 1233;
  const declines = breadth?.declines ?? 1295;
  const ratio = declines > 0 ? +(advances / declines).toFixed(2) : 1.0;

  // Chart data updates dynamically based on selected period
  const chartData = useMemo(() => {
    if (breadthHistory.length > 0) {
      let cumulative = 0;
      return breadthHistory.map((b) => {
        const adv = b.advances ?? 1200;
        const dec = b.declines ?? 1200;
        const r = dec > 0 ? +(adv / dec).toFixed(2) : 1.0;
        cumulative += (adv - dec);

        return {
          date: new Date(b.tradeDate).toLocaleDateString("en-IN", {
            month: "short",
            day: "numeric",
          }),
          val: period === "AD" ? cumulative : period === "40D" ? +((r * 0.95).toFixed(2)) : r,
          benchmark: 1.0,
        };
      });
    }

    return mockMarketInternals.advanceDecline.chartData.map((d) => ({
      date: d.date,
      val: period === "AD" ? Math.round(d.ratio * 1200 - 1100) : period === "40D" ? +((d.ratio * 0.96).toFixed(2)) : d.ratio,
      benchmark: period === "AD" ? 0 : 1.0,
    }));
  }, [breadthHistory, period]);

  const statusText = ratio >= 1.05 ? "Bullish" : ratio <= 0.95 ? "Bearish" : "Even";
  const displayVal =
    period === "AD"
      ? `${advances - declines > 0 ? "+" : ""}${advances - declines}`
      : period === "40D"
      ? (ratio * 0.96).toFixed(2)
      : ratio.toFixed(2);
  const isPositive = period === "AD" ? advances >= declines : ratio >= 1.0;

  return (
    <BaseCard padding="p-3.5" className="flex flex-col justify-between space-y-2 w-full min-w-0">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-bold text-[#17233B]">Advance / Decline</div>
          <div className="text-[10px] text-[#64748B]">
            {period === "AD" ? "Cumulative Advance minus Decline line" : `Stocks that rose vs fell, ${period} average`}
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
            {displayVal}
          </span>
          <span className="text-[11px] font-medium text-[#64748B]">{statusText}</span>
          <span className="text-[10px] text-[#16A878] font-semibold">+0.05 in a week</span>
        </div>
        <div className="text-[10px] text-[#64748B]">
          {advances.toLocaleString("en-IN")} up / {declines.toLocaleString("en-IN")} down
        </div>
      </div>

      {/* Chart */}
      <BaseAreaChart
        data={chartData}
        xKey="date"
        series={[
          {
            key: "val",
            name: period === "AD" ? "A-D Line" : `A/D Ratio (${period})`,
            color: isPositive ? "#3478F6" : "#F05283",
            fill: true,
            strokeWidth: 1.5,
          },
        ]}
        height={115}
        yDomain={period === "AD" ? ["auto", "auto"] : [0.5, 1.3]}
        referenceLines={period === "AD" ? [{ y: 0, color: "#E2E8F0" }] : [{ y: 1.0, color: "#E2E8F0" }]}
      />
    </BaseCard>
  );
}

export default AdvanceDecline;
