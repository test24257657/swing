"use client";

import React from "react";
import BaseCard from "@/components/ui/card";
import DivergingBarChart from "@/components/charts/DivergingBarChart";
import { formatCrores } from "@/lib/formatters";
import { mockInstitutionalFlows, mockHighsLows22 } from "@/data/mockMarketBreadth";

export function InstitutionalActivity({
  flows = mockInstitutionalFlows,
  highsLows = mockHighsLows22,
}) {
  const { fii, dii } = flows;

  return (
    <BaseCard className="flex flex-col justify-between h-full space-y-4" padding="p-4">
      {/* ── FII / DII CASH SECTION ─────────────────────────────────── */}
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-[#E5EAF2]">
          <span className="text-xs font-bold text-[#17233B] uppercase tracking-wider">
            FII / DII CASH · LAST 22 SESSIONS
          </span>
          <span className="text-[10px] text-[#94A3B8] font-mono">₹ crore</span>
        </div>

        {/* FII Section */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-[#17233B]">FII</span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#64748B] font-normal">Fri 13 Nov</span>
              <span className="text-[#3478F6] tabular-nums font-bold">
                {formatCrores(fii.dailyNetCr)}
              </span>
            </div>
          </div>

          {/* 22 Sessions Bar Chart */}
          <div className="py-1">
            <DivergingBarChart
              data={fii.sessions}
              xKey="session"
              dataKey="val"
              height={36}
              posColor="#3478F6"
              negColor="#F05283"
              tooltipFormatter={(val) => formatCrores(val)}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#64748B]">
            <span>1-month net</span>
            <span className="font-semibold text-[#3478F6] tabular-nums">
              {formatCrores(fii.monthNetCr)}
            </span>
          </div>
        </div>

        {/* DII Section */}
        <div className="space-y-1 pt-2 border-t border-[#F1F5F9]">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-[#17233B]">DII</span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#64748B] font-normal">Fri 13 Nov</span>
              <span className="text-[#F05283] tabular-nums font-bold">
                {formatCrores(dii.dailyNetCr)}
              </span>
            </div>
          </div>

          {/* 22 Sessions Bar Chart */}
          <div className="py-1">
            <DivergingBarChart
              data={dii.sessions}
              xKey="session"
              dataKey="val"
              height={36}
              posColor="#3478F6"
              negColor="#F05283"
              tooltipFormatter={(val) => formatCrores(val)}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#64748B]">
            <span>1-month net</span>
            <span className="font-semibold text-[#F05283] tabular-nums">
              {formatCrores(dii.monthNetCr)}
            </span>
          </div>
        </div>
      </div>

      {/* ── 20-DAY HIGHS & LOWS SECTION ────────────────────────────── */}
      <div className="space-y-2 pt-3 border-t border-[#E5EAF2]">
        <div className="flex items-center justify-between pb-1">
          <span className="text-[11px] font-bold text-[#17233B] uppercase tracking-wider">
            20-DAY HIGHS · LOWS · LAST 22 SESSIONS
          </span>
          <span className="text-[10px] text-[#94A3B8]">Stocks</span>
        </div>

        {/* Net Highs - Lows Values */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[#17233B]">Net highs − lows</span>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#64748B]">Fri 13 Nov</span>
            <span className="text-xs font-bold text-[#3478F6] tabular-nums">
              +{highsLows.latestNet}
            </span>
          </div>
        </div>

        {/* Bar chart of 22 sessions */}
        <div className="py-1">
          <DivergingBarChart
            data={highsLows.sessions}
            xKey="session"
            dataKey="net"
            height={36}
            posColor="#3478F6"
            negColor="#F05283"
            tooltipFormatter={(val) => `${val > 0 ? "+" : ""}${val} net`}
          />
        </div>

        {/* Counts */}
        <div className="flex items-center justify-between text-[11px] text-[#64748B]">
          <span>Fri 13 Nov</span>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#3478F6]">
              {highsLows.highsCount} highs
            </span>
            <span className="text-[#94A3B8]">/</span>
            <span className="font-semibold text-[#F05283]">
              {highsLows.lowsCount} lows
            </span>
          </div>
        </div>
      </div>
    </BaseCard>
  );
}

export default InstitutionalActivity;

