"use client";

import React from "react";
import { Info } from "lucide-react";
import NewHighsLows from "./NewHighsLows";
import AdvanceDecline from "./AdvanceDecline";
import FourPercentMovers from "./FourPercentMovers";
import LargeMidSmall from "./LargeMidSmall";
import BreakoutsBreakdowns from "./BreakoutsBreakdowns";
import ParticipationHistory from "./ParticipationHistory";

export function MarketInternals({ breadth, breadthHistory = [] }) {
  return (
    <div className="space-y-3">
      {/* Section Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#E5EAF2]">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[#17233B] uppercase tracking-wider">
            Market internals
          </span>
          <span title="Granular underlying market health indicators">
            <Info size={13} className="text-[#94A3B8] cursor-pointer" />
          </span>
          <span className="text-[11px] text-[#64748B] ml-2 hidden sm:inline">
            — Nifty 500 (grey line)
          </span>
        </div>
      </div>

      {/* 6 Analytics Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <NewHighsLows breadth={breadth} breadthHistory={breadthHistory} />
        <AdvanceDecline breadth={breadth} breadthHistory={breadthHistory} />
        <FourPercentMovers breadth={breadth} breadthHistory={breadthHistory} />
        <LargeMidSmall breadth={breadth} breadthHistory={breadthHistory} />
        <BreakoutsBreakdowns breadth={breadth} breadthHistory={breadthHistory} />
        <ParticipationHistory breadth={breadth} breadthHistory={breadthHistory} />
      </div>
    </div>
  );
}

export default MarketInternals;
