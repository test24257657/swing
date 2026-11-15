"use client";

import React from "react";
import BaseCard from "@/components/ui/card";
import StageAnalysis from "./StageAnalysis";

export function MarketRead({ data }) {
  const { indicators = [], stageAnalysis } = data || {};

  const getToneDot = (tone) => {
    switch (tone) {
      case "positive":
        return "bg-[#16A878]";
      case "negative":
        return "bg-[#F05283]";
      case "warning":
        return "bg-[#E9A23B]";
      default:
        return "bg-[#94A3B8]";
    }
  };

  const getToneText = (tone) => {
    switch (tone) {
      case "positive":
        return "text-[#16A878]";
      case "negative":
        return "text-[#F05283]";
      case "warning":
        return "text-[#E9A23B]";
      default:
        return "text-[#64748B]";
    }
  };

  return (
    <BaseCard className="flex flex-col justify-between h-full space-y-4" padding="p-4">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#E5EAF2]">
          <span className="text-xs font-bold text-[#17233B] uppercase tracking-wider">
            Market Read
          </span>
        </div>

        {/* Indicators List — All indicators shown without collapsed state */}
        <div className="space-y-3">
          {indicators.map((item) => (
            <div key={item.id} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 font-medium text-[#17233B]">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${getToneDot(item.tone)}`} />
                  <span>{item.name}</span>
                </div>
                <span className={`font-semibold text-xs ${getToneText(item.tone)}`}>
                  {item.status}
                </span>
              </div>
              <p className="text-[11px] text-[#64748B] pl-4 leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Stage Analysis Section */}
      {stageAnalysis && <StageAnalysis data={stageAnalysis} />}
    </BaseCard>
  );
}

export default MarketRead;
