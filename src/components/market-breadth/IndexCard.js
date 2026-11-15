"use client";

import React from "react";
import BaseCard from "@/components/ui/card";
import SparklineChart from "@/components/charts/SparklineChart";
import PercentageChange from "@/components/data-display/PercentageChange";
import { formatINR } from "@/lib/formatters";

export function IndexCard({ item }) {
  const {
    name,
    value,
    changePct,
    distFromHighPct,
    supportResistance,
    subtext,
    sparkline = [],
    isDollar = false,
  } = item;

  const isPos = changePct >= 0;
  const sparkColor = isPos ? "#16A878" : "#F05283";

  return (
    <BaseCard padding="p-3" className="flex flex-col justify-between space-y-2">
      {/* Top: Name & % Change */}
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-[#17233B]">{name}</span>
        <PercentageChange value={changePct} showBg={false} />
      </div>

      {/* Main numerical value */}
      <div className="text-[17px] font-bold text-[#17233B] tabular-nums tracking-tight">
        {isDollar ? `$${value}` : formatINR(value, isDollar || value < 100 ? 2 : 0)}
      </div>

      {/* Mini Sparkline Chart */}
      <div className="h-7 w-full py-0.5">
        <SparklineChart
          data={sparkline}
          dataKey="val"
          color={sparkColor}
          height={24}
        />
      </div>

      {/* Bottom Subtext */}
      <div className="flex items-center justify-between text-[10px] text-[#64748B] pt-1 border-t border-[#F1F5F9]">
        {distFromHighPct !== undefined ? (
          <>
            <span>{distFromHighPct.toFixed(1)}% from high</span>
            {supportResistance && (
              <span className="text-[#3478F6] font-medium">{supportResistance}</span>
            )}
          </>
        ) : (
          <span className="text-[#94A3B8]">{subtext}</span>
        )}
      </div>
    </BaseCard>
  );
}

export default IndexCard;
