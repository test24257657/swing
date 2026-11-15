"use client";

import React, { useState, useMemo } from "react";
import BaseCard from "@/components/ui/card";
import SegmentedControl from "@/components/ui/segmented-control";
import ComparisonChart from "@/components/charts/ComparisonChart";
import { mockMarketInternals } from "@/data/mockMarketInternals";

export function LargeMidSmall({ breadth, breadthHistory = [] }) {
  const [period, setPeriod] = useState("3M");

  const PERIODS = [
    { id: "1M", label: "1M" },
    { id: "3M", label: "3M" },
    { id: "YTD", label: "YTD" },
  ];

  // Dynamic returns adjusted for period and live breadth
  const liveNifty50Chg = breadth?.nifty50ChangePct ?? 0.65;

  const segmentStats = useMemo(() => {
    if (period === "1M") {
      const large = +(1.2 + liveNifty50Chg * 0.8).toFixed(1);
      const mid = +(-0.8 + liveNifty50Chg * 0.5).toFixed(1);
      const small = +(0.4 + liveNifty50Chg * 0.3).toFixed(1);
      return [
        { id: "large", label: "Large", pct: large, color: "#3478F6" },
        { id: "mid", label: "Mid", pct: mid, color: "#F97316" },
        { id: "small", label: "Small", pct: small, color: "#16A878" },
      ];
    }
    if (period === "YTD") {
      const large = +(11.4 + liveNifty50Chg).toFixed(1);
      const mid = +(18.2 + liveNifty50Chg * 1.2).toFixed(1);
      const small = +(22.6 + liveNifty50Chg * 1.5).toFixed(1);
      return [
        { id: "large", label: "Large", pct: large, color: "#3478F6" },
        { id: "mid", label: "Mid", pct: mid, color: "#F97316" },
        { id: "small", label: "Small", pct: small, color: "#16A878" },
      ];
    }
    // Default 3M
    const large = +(3.2 + liveNifty50Chg * 0.5).toFixed(1);
    const mid = +(-3.2 + liveNifty50Chg * 0.4).toFixed(1);
    const small = +(-1.9 + liveNifty50Chg * 0.4).toFixed(1);
    return [
      { id: "large", label: "Large", pct: large, color: "#3478F6" },
      { id: "mid", label: "Mid", pct: mid, color: "#F97316" },
      { id: "small", label: "Small", pct: small, color: "#16A878" },
    ];
  }, [period, liveNifty50Chg]);

  // Determine market leadership
  const leaderText = useMemo(() => {
    const sorted = [...segmentStats].sort((a, b) => b.pct - a.pct);
    if (sorted[0].id === "large") return "Large caps lead";
    if (sorted[0].id === "mid") return "Mid caps lead";
    return "Small caps lead";
  }, [segmentStats]);

  const referenceText = useMemo(() => {
    if (period === "1M") return "Nifty 50 vs Midcap 150 vs Smallcap 250, 1-month return";
    if (period === "YTD") return "Nifty 50 vs Midcap 150 vs Smallcap 250, return YTD";
    return "Nifty 50 vs Midcap 150 vs Smallcap 250, return over 3 months";
  }, [period]);

  // Chart data adaptation
  const chartData = useMemo(() => {
    const raw = mockMarketInternals.largeMidSmall.chartData;
    if (period === "1M") {
      return raw.slice(-4).map((d, i, arr) => {
        const baseLarge = arr[0].large;
        const baseMid = arr[0].mid;
        const baseSmall = arr[0].small;
        return {
          date: d.date,
          large: +(d.large - baseLarge).toFixed(1),
          mid: +(d.mid - baseMid).toFixed(1),
          small: +(d.small - baseSmall).toFixed(1),
        };
      });
    }
    if (period === "YTD") {
      return [
        { date: "Jan", large: 0, mid: 0, small: 0 },
        { date: "Mar", large: 3.1, mid: 4.8, small: 5.9 },
        { date: "May", large: 5.4, mid: 9.2, small: 11.4 },
        { date: "Jul", large: 8.8, mid: 14.5, small: 17.2 },
        { date: "Sep", large: 10.1, mid: 16.2, small: 19.8 },
        { date: "Nov", large: segmentStats[0].pct, mid: segmentStats[1].pct, small: segmentStats[2].pct },
      ];
    }
    // 3M
    return raw;
  }, [period, segmentStats]);

  return (
    <BaseCard padding="p-3.5" className="flex flex-col justify-between space-y-2 w-full min-w-0">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-bold text-[#17233B]">Large vs Mid vs Small</div>
          <div className="text-[10px] text-[#64748B]">{referenceText}</div>
        </div>
        <SegmentedControl
          options={PERIODS}
          value={period}
          onChange={setPeriod}
          size="xs"
        />
      </div>

      {/* Legend & Stats */}
      <div className="flex items-center gap-3 text-[11px] font-semibold flex-wrap">
        <span className="bg-[#EFF6FF] text-[#3478F6] px-1.5 py-0.5 rounded-[4px]">
          {leaderText}
        </span>
        {segmentStats.map((seg) => {
          const isPos = seg.pct >= 0;
          return (
            <span key={seg.id} className="flex items-center gap-1 text-[#64748B]">
              <span
                className="w-2 h-0.5 rounded inline-block"
                style={{ backgroundColor: seg.color }}
              />
              <span className="font-normal">{seg.label}:</span>
              <span
                className="tabular-nums font-bold"
                style={{ color: seg.color }}
              >
                {isPos ? "+" : ""}
                {seg.pct.toFixed(1)}%
              </span>
            </span>
          );
        })}
      </div>

      {/* Chart */}
      <ComparisonChart
        data={chartData}
        xKey="date"
        lines={[
          { key: "large", name: "Nifty 50 (Large)", color: "#3478F6", strokeWidth: 1.75 },
          { key: "mid", name: "Midcap 150 (Mid)", color: "#F97316", strokeWidth: 1.5 },
          { key: "small", name: "Smallcap 250 (Small)", color: "#16A878", strokeWidth: 1.5 },
        ]}
        height={115}
        yUnit="%"
      />
    </BaseCard>
  );
}

export default LargeMidSmall;
