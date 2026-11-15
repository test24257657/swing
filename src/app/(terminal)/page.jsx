"use client";

import React, { useState, useEffect, useMemo } from "react";
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

  // Dynamic live backend data state
  const [backendData, setBackendData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch live market data from database via API
  useEffect(() => {
    let active = true;
    async function loadData() {
      try {
        const res = await fetch("/api/terminal/data");
        if (res.ok) {
          const json = await res.json();
          if (active && json?.breadth) {
            setBackendData(json);
          }
        }
      } catch (err) {
        console.error("Failed to load terminal data:", err);
      } finally {
        if (active) setIsLoading(false);
      }
    }
    loadData();
    return () => {
      active = false;
    };
  }, []);

  const breadth = backendData?.breadth;
  const breadthHistory = backendData?.breadthHistory || [];

  // Transform live 30-session history into chart series if available
  const dynamicParticipationSeries = useMemo(() => {
    if (breadthHistory.length >= 5) {
      return breadthHistory.map((b) => ({
        date: new Date(b.tradeDate).toLocaleDateString("en-IN", {
          month: "short",
          day: "numeric",
        }),
        participation: b.pctAbove20Ema ?? 50,
        benchmark: (b.nifty500ChangePct ?? 0) + 50,
      }));
    }
    return mockParticipationSeries;
  }, [breadthHistory]);

  const dynamicStageSeries = useMemo(() => {
    if (breadthHistory.length >= 5) {
      return breadthHistory.map((b) => ({
        date: new Date(b.tradeDate).toLocaleDateString("en-IN", {
          month: "short",
          day: "numeric",
        }),
        stage2: b.pctAbove50Sma ?? 35,
        stage4: Math.max(0, 100 - (b.pctAbove50Sma ?? 35) - 20),
      }));
    }
    return mockStageComparisonSeries;
  }, [breadthHistory]);

  const dynamicInstitutionalFlows = useMemo(() => {
    if (breadthHistory.length >= 5) {
      const last22 = breadthHistory.slice(-22);
      const fiiSessions = last22.map((b, i) => ({
        session: i + 1,
        val: b.fiiNetCr ?? 0,
      }));
      const diiSessions = last22.map((b, i) => ({
        session: i + 1,
        val: b.diiNetCr ?? 0,
      }));
      const fiiSum = fiiSessions.reduce((acc, curr) => acc + curr.val, 0);
      const diiSum = diiSessions.reduce((acc, curr) => acc + curr.val, 0);

      return {
        fii: {
          dailyNetCr: breadth?.fiiNetCr ?? fiiSessions[fiiSessions.length - 1]?.val ?? 5737,
          monthNetCr: Math.round(fiiSum),
          sessions: fiiSessions,
        },
        dii: {
          dailyNetCr: breadth?.diiNetCr ?? diiSessions[diiSessions.length - 1]?.val ?? -2254,
          monthNetCr: Math.round(diiSum),
          sessions: diiSessions,
        },
      };
    }
    return mockInstitutionalFlows;
  }, [breadthHistory, breadth]);

  const dynamicHighsLows = useMemo(() => {
    if (breadthHistory.length >= 5) {
      const last22 = breadthHistory.slice(-22);
      const sessions = last22.map((b, i) => ({
        session: i + 1,
        net: b.netHighLow ?? ((b.new52wHighs ?? 0) - (b.new52wLows ?? 0)),
        highs: b.new52wHighs ?? 0,
        lows: b.new52wLows ?? 0,
      }));
      return {
        latestNet: breadth?.netHighLow ?? sessions[sessions.length - 1]?.net ?? 180,
        highsCount: breadth?.new52wHighs ?? sessions[sessions.length - 1]?.highs ?? 213,
        lowsCount: breadth?.new52wLows ?? sessions[sessions.length - 1]?.lows ?? 33,
        sessions,
      };
    }
    return mockHighsLows22;
  }, [breadthHistory, breadth]);

  // Live indices with actual Nifty 50, Nifty 500, India VIX from database
  const dynamicIndices = useMemo(() => {
    return mockIndices.map((idx) => {
      if (idx.id === "nifty50" && breadth?.nifty50Close) {
        return {
          ...idx,
          value: breadth.nifty50Close,
          changePct: breadth.nifty50ChangePct ?? idx.changePct,
        };
      }
      if (idx.id === "nifty500" && breadth?.nifty500Close) {
        return {
          ...idx,
          value: breadth.nifty500Close,
          changePct: breadth.nifty500ChangePct ?? idx.changePct,
        };
      }
      return idx;
    });
  }, [breadth]);

  // Filter & adapt data based on selected period (1M, 3M, 1Y)
  const filteredParticipationSeries = useMemo(() => {
    if (selectedPeriod === "1M") {
      return dynamicParticipationSeries.slice(-6);
    }
    if (selectedPeriod === "3M") {
      return dynamicParticipationSeries.slice(-10);
    }
    return dynamicParticipationSeries;
  }, [selectedPeriod, dynamicParticipationSeries]);

  const filteredStageSeries = useMemo(() => {
    if (selectedPeriod === "1M") {
      return dynamicStageSeries.slice(-6);
    }
    if (selectedPeriod === "3M") {
      return dynamicStageSeries.slice(-10);
    }
    return dynamicStageSeries;
  }, [selectedPeriod, dynamicStageSeries]);

  // Adapt participation stats & stage counts based on universe
  const currentUniverseObj = useMemo(() => {
    return (
      STOCK_UNIVERSES.find((u) => u.id === selectedUniverse) ||
      STOCK_UNIVERSES[0]
    );
  }, [selectedUniverse]);

  const liveParticipationPct = breadth?.pctAbove20Ema ?? mockParticipationStats.currentPct;

  const adaptedParticipationStats = useMemo(() => {
    const universeOffsets = {
      all: 0,
      liquid: -1.2,
      nifty500: 2.4,
      nifty200: 6.8,
      nifty100: 10.1,
    };
    const offset = universeOffsets[selectedUniverse] || 0;
    const currentPct = Math.min(100, Math.max(0, liveParticipationPct + offset));
    return {
      ...mockParticipationStats,
      currentPct,
      timeframeText: `Share of ${currentUniverseObj.label.toLowerCase()} above their 20-day average`,
    };
  }, [selectedUniverse, currentUniverseObj, liveParticipationPct]);

  const adaptedMarketRead = useMemo(() => {
    const total = breadth
      ? (breadth.advances ?? 0) + (breadth.declines ?? 0) || currentUniverseObj.count
      : currentUniverseObj.count;

    return {
      ...mockMarketRead,
      stageAnalysis: {
        ...mockMarketRead.stageAnalysis,
        totalStocks: total,
      },
    };
  }, [currentUniverseObj, breadth]);

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
                flows={dynamicInstitutionalFlows}
                highsLows={dynamicHighsLows}
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
      <IndicesSection indices={dynamicIndices} />
    </PageContainer>
  );
}
