"use client";

import React from "react";
import BaseCard from "@/components/ui/card";
import { Info } from "lucide-react";
import MarketParticipationChart from "./MarketParticipationChart";
import StageComparisonChart from "./StageComparisonChart";
import { mockParticipationSeries, mockParticipationStats, mockStageComparisonSeries } from "@/data/mockMarketBreadth";

export function MarketCondition({
  participationData = mockParticipationSeries,
  participationStats = mockParticipationStats,
  stageComparisonData = mockStageComparisonSeries,
}) {
  return (
    <BaseCard className="flex flex-col justify-between h-full space-y-4" padding="p-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#E5EAF2]">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-[#17233B] uppercase tracking-wider">
            Market condition
          </span>
          <span title="Comprehensive gauge of overall stock market breadth and participation">
            <Info size={13} className="text-[#94A3B8] cursor-pointer" />
          </span>
        </div>
      </div>

      {/* Top Half: Market Participation */}
      <MarketParticipationChart
        data={participationData}
        stats={participationStats}
      />

      {/* Bottom Half: Stage 2 vs Stage 4 */}
      <StageComparisonChart data={stageComparisonData} />
    </BaseCard>
  );
}

export default MarketCondition;

