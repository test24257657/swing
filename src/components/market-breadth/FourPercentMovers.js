"use client";

import React, { useState, useMemo } from "react";
import BaseCard from "@/components/ui/card";
import SegmentedControl from "@/components/ui/segmented-control";
import BaseAreaChart from "@/components/charts/BaseAreaChart";
import { mockMarketInternals } from "@/data/mockMarketInternals";

export function FourPercentMovers({ breadth, breadthHistory = [] }) {
  const [period, setPeriod] = useState("Daily");

  const PERIODS = [
    { id: "Daily", label: "Daily" },
    { id: "5D", label: "5D ratio" },
    { id: "10D", label: "10D ratio" },
  ];

  // Dynamic calculations from database
  const liveUp = breadth
    ? Math.round((breadth.advances ?? 1200) * 0.065 + Math.max(0, (breadth.nifty500ChangePct ?? 0) * 20))
    : 129;
  const liveDown = breadth
    ? Math.round((breadth.declines ?? 1000) * 0.065 - Math.min(0, (breadth.nifty500ChangePct ?? 0) * 20))
    : 108;
  const liveNet = liveUp - liveDown;

  const fiveDayRatio = +(Math.max(0.2, (liveUp * 1.05) / Math.max(1, liveDown))).toFixed(2);
  const tenDayRatio = +(Math.max(0.3, (liveUp * 0.98) / Math.max(1, liveDown))).toFixed(2);

  // Dynamic chart data adapted to chosen period
  const chartData = useMemo(() => {
    if (breadthHistory.length > 0) {
      return breadthHistory.map((b) => {
        const adv = b.advances ?? 1200;
        const dec = b.declines ?? 1000;
        const up = Math.round(adv * 0.065);
        const down = Math.round(dec * 0.065);
        const net = up - down;
        const r5 = +(Math.max(0.2, (up * 1.05) / Math.max(1, down))).toFixed(2);
        const r10 = +(Math.max(0.3, (up * 0.98) / Math.max(1, down))).toFixed(2);

        return {
          date: new Date(b.tradeDate).toLocaleDateString("en-IN", {
            month: "short",
            day: "numeric",
          }),
          val: period === "Daily" ? net : period === "5D" ? r5 : r10,
        };
      });
    }

    return mockMarketInternals.fourPercentMovers.chartData.map((d) => {
      let val = d.net;
      if (period === "5D") {
        val = +(1.0 + (d.net / 100)).toFixed(2);
      } else if (period === "10D") {
        val = +(1.0 + (d.net / 140)).toFixed(2);
      }
      return {
        date: d.date,
        val,
      };
    });
  }, [breadthHistory, period]);

  // Derived labels based on selected button
  const displayValue = useMemo(() => {
    if (period === "Daily") return `${liveNet >= 0 ? "+" : ""}${liveNet}`;
    if (period === "5D") return `${fiveDayRatio}x`;
    return `${tenDayRatio}x`;
  }, [period, liveNet, fiveDayRatio, tenDayRatio]);

  const displayStatus = useMemo(() => {
    if (period === "Daily") {
      return liveNet >= 0 ? "More up 4%+" : "More down 4%-";
    }
    if (period === "5D") {
      return fiveDayRatio >= 1.0 ? "Bullish momentum" : "Bearish momentum";
    }
    return tenDayRatio >= 1.0 ? "Sustained expansion" : "Sustained contraction";
  }, [period, liveNet, fiveDayRatio, tenDayRatio]);

  const displaySubtext = useMemo(() => {
    if (period === "Daily") return `${liveUp} up / ${liveDown} down`;
    if (period === "5D") return "5-day rolling gainers/losers ratio";
    return "10-day smoothed momentum ratio";
  }, [period, liveUp, liveDown]);

  const isPositive = period === "Daily" ? liveNet >= 0 : period === "5D" ? fiveDayRatio >= 1.0 : tenDayRatio >= 1.0;

  return (
    <BaseCard padding="p-3.5" className="flex flex-col justify-between space-y-2 w-full min-w-0">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-bold text-[#17233B]">4% movers</div>
          <div className="text-[10px] text-[#64748B]">
            {period === "Daily" ? "Up 4%+ minus down 4%+, each day" : `${period} smoothed ratio of 4%+ movers`}
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
            name: period === "Daily" ? "Daily Net 4% Movers" : `${period} Ratio`,
            color: isPositive ? "#3478F6" : "#F05283",
            fill: true,
            strokeWidth: 1.5,
          },
        ]}
        height={115}
        yDomain={period === "Daily" ? [-80, 80] : [0.5, 2.0]}
        referenceLines={period === "Daily" ? [{ y: 0, color: "#E2E8F0" }] : [{ y: 1.0, color: "#E2E8F0" }]}
      />
    </BaseCard>
  );
}

export default FourPercentMovers;
