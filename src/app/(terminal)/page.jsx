"use client";

import React, { useState, useMemo } from "react";
import DashboardHeader from "@/components/market-breadth/DashboardHeader";
import MarketRead from "@/components/market-breadth/MarketRead";
import MarketCondition from "@/components/market-breadth/MarketCondition";
import InstitutionalActivity from "@/components/market-breadth/InstitutionalActivity";
import MarketInternals from "@/components/market-breadth/MarketInternals";
import IndicesSection from "@/components/market-breadth/IndicesSection";
import PageContainer from "@/components/shared/PageContainer";
import { STOCK_UNIVERSES } from "@/lib/constants";
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

  // Filter & adapt data based on selected period (1M, 3M, 1Y)
  const filteredParticipationSeries = useMemo(() => {
    if (selectedPeriod === "1M") {
      return mockParticipationSeries.slice(-6);
    }
    if (selectedPeriod === "3M") {
      return mockParticipationSeries.slice(-10);
    }
    return mockParticipationSeries; // 1Y: all
  }, [selectedPeriod]);

  const filteredStageSeries = useMemo(() => {
    if (selectedPeriod === "1M") {
      return mockStageComparisonSeries.slice(-6);
    }
    if (selectedPeriod === "3M") {
      return mockStageComparisonSeries.slice(-10);
    }
    return mockStageComparisonSeries;
  }, [selectedPeriod]);

  // Adapt participation stats & stage counts based on universe
  const currentUniverseObj = useMemo(() => {
    return (
      STOCK_UNIVERSES.find((u) => u.id === selectedUniverse) ||
      STOCK_UNIVERSES[0]
    );
  }, [selectedUniverse]);

  const adaptedParticipationStats = useMemo(() => {
    const universeOffsets = {
      all: 0,
      liquid: -1.2,
      nifty500: 2.4,
      nifty200: 6.8,
      nifty100: 10.1,
    };
    const offset = universeOffsets[selectedUniverse] || 0;
    const currentPct = Math.min(100, Math.max(0, mockParticipationStats.currentPct + offset));
    return {
      ...mockParticipationStats,
      currentPct,
      timeframeText: `Share of ${currentUniverseObj.label.toLowerCase()} above their 20-day average`,
    };
  }, [selectedUniverse, currentUniverseObj]);

  const adaptedMarketRead = useMemo(() => {
    return {
      ...mockMarketRead,
      stageAnalysis: {
        ...mockMarketRead.stageAnalysis,
        totalStocks: currentUniverseObj.count,
      },
    };
  }, [currentUniverseObj]);

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
            {/* Column 1: Market Read + Stage Analysis */}
            <div className="lg:col-span-4 xl:col-span-3">
              <MarketRead data={adaptedMarketRead} />
            </div>

            {/* Column 2: Market Condition (Participation + Stage 2 vs 4) */}
            <div className="lg:col-span-8 xl:col-span-6">
              <MarketCondition
                participationData={filteredParticipationSeries}
                participationStats={adaptedParticipationStats}
                stageComparisonData={filteredStageSeries}
              />
            </div>

            {/* Column 3: Institutional Activity (FII/DII + 20D H/L) */}
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
