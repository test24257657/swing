"use client";

import React, { useState } from "react";
import DashboardHeader from "@/components/market-breadth/DashboardHeader";
import MarketRead from "@/components/market-breadth/MarketRead";
import MarketCondition from "@/components/market-breadth/MarketCondition";
import InstitutionalActivity from "@/components/market-breadth/InstitutionalActivity";
import MarketInternals from "@/components/market-breadth/MarketInternals";
import IndicesSection from "@/components/market-breadth/IndicesSection";
import PageContainer from "@/components/shared/PageContainer";
import {
  mockMarketRead,
  mockParticipationSeries,
  mockParticipationStats,
  mockStageComparisonSeries,
  mockInstitutionalFlows,
  mockHighsLows22,
} from "@/data/mockMarketBreadth";
import { mockIndices } from "@/data/mockIndices";

export default function MarketBreadthDashboardPage() {
  const [activeTab, setActiveTab] = useState("breadth");
  const [selectedUniverse, setSelectedUniverse] = useState("all");
  const [selectedPeriod, setSelectedPeriod] = useState("1M");

  return (
    <PageContainer>
      {/* ── Top Header with Tabs & Universe/Period Controls ─────── */}
      <DashboardHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        selectedUniverse={selectedUniverse}
        onUniverseChange={setSelectedUniverse}
        selectedPeriod={selectedPeriod}
        onPeriodChange={setSelectedPeriod}
      />

      {/* ── Tab 1: Market Breadth Overview (3-Column Layout) ─────── */}
      {activeTab === "breadth" && (
        <div className="space-y-4">
          {/* Main 3-Column Overview Section */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch">
            {/* Column 1: Market Read + Stage Analysis (3.5 cols on desktop) */}
            <div className="lg:col-span-4 xl:col-span-3">
              <MarketRead data={mockMarketRead} />
            </div>

            {/* Column 2: Market Condition (Participation + Stage 2 vs 4) (5.5 cols on desktop) */}
            <div className="lg:col-span-8 xl:col-span-6">
              <MarketCondition
                participationData={mockParticipationSeries}
                participationStats={mockParticipationStats}
                stageComparisonData={mockStageComparisonSeries}
              />
            </div>

            {/* Column 3: Institutional Activity (FII/DII + 20D H/L) (3 cols on desktop) */}
            <div className="lg:col-span-12 xl:col-span-3">
              <InstitutionalActivity
                flows={mockInstitutionalFlows}
                highsLows={mockHighsLows22}
              />
            </div>
          </div>

          {/* Market Internals Grid (6 Analytics Cards) */}
          <MarketInternals />
        </div>
      )}

      {/* ── Tab 2: Market Internals Dedicated View ───────────────── */}
      {activeTab === "internals" && (
        <div className="space-y-4">
          <MarketInternals />
        </div>
      )}

      {/* ── Bottom Section: Indices Row (7 Benchmark Cards) ──────── */}
      <IndicesSection indices={mockIndices} />
    </PageContainer>
  );
}
