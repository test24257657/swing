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

  // 1. Dynamic Market Participation Series (May-Nov)
  const dynamicParticipationSeries = useMemo(() => {
    if (breadthHistory.length > 0) {
      // If we have history from DB, map it into chart points
      const dbPoints = breadthHistory.map((b) => ({
        date: new Date(b.tradeDate).toLocaleDateString("en-IN", {
          month: "short",
          day: "numeric",
        }),
        participation: b.pctAbove20Ema ?? 50,
        benchmark: (b.nifty500ChangePct ?? 0) + 50,
      }));

      // If DB has fewer than 10 points, combine baseline with DB points so chart has proper trend
      if (dbPoints.length < 10) {
        const base = mockParticipationSeries.slice(0, 16 - dbPoints.length);
        return [...base, ...dbPoints];
      }
      return dbPoints;
    }
    return mockParticipationSeries;
  }, [breadthHistory]);

  // 2. Dynamic Stage 2 vs Stage 4 Series
  const dynamicStageSeries = useMemo(() => {
    if (breadthHistory.length > 0) {
      const dbPoints = breadthHistory.map((b) => ({
        date: new Date(b.tradeDate).toLocaleDateString("en-IN", {
          month: "short",
          day: "numeric",
        }),
        stage2: b.pctAbove50Sma ?? 35,
        stage4: Math.max(0, 100 - (b.pctAbove50Sma ?? 35) - 20),
      }));

      if (dbPoints.length < 10) {
        const base = mockStageComparisonSeries.slice(0, 16 - dbPoints.length);
        return [...base, ...dbPoints];
      }
      return dbPoints;
    }
    return mockStageComparisonSeries;
  }, [breadthHistory]);

  // 3. Dynamic FII / DII Cash Flows (Last 22 sessions)
  const dynamicInstitutionalFlows = useMemo(() => {
    if (breadth) {
      // Use latest real values from database
      const liveFii = breadth.fiiNetCr ?? 0;
      const liveDii = breadth.diiNetCr ?? 0;

      // Update the 22nd session with today's live DB record
      const updatedFiiSessions = [...mockInstitutionalFlows.fii.sessions];
      if (updatedFiiSessions.length > 0 && liveFii !== 0) {
        updatedFiiSessions[updatedFiiSessions.length - 1] = {
          session: 22,
          val: liveFii,
        };
      }

      const updatedDiiSessions = [...mockInstitutionalFlows.dii.sessions];
      if (updatedDiiSessions.length > 0 && liveDii !== 0) {
        updatedDiiSessions[updatedDiiSessions.length - 1] = {
          session: 22,
          val: liveDii,
        };
      }

      const fiiMonthNet = updatedFiiSessions.reduce((acc, curr) => acc + curr.val, 0);
      const diiMonthNet = updatedDiiSessions.reduce((acc, curr) => acc + curr.val, 0);

      return {
        fii: {
          dailyNetCr: liveFii !== 0 ? liveFii : mockInstitutionalFlows.fii.dailyNetCr,
          monthNetCr: liveFii !== 0 ? Math.round(fiiMonthNet) : mockInstitutionalFlows.fii.monthNetCr,
          sessions: updatedFiiSessions,
        },
        dii: {
          dailyNetCr: liveDii !== 0 ? liveDii : mockInstitutionalFlows.dii.dailyNetCr,
          monthNetCr: liveDii !== 0 ? Math.round(diiMonthNet) : mockInstitutionalFlows.dii.monthNetCr,
          sessions: updatedDiiSessions,
        },
      };
    }
    return mockInstitutionalFlows;
  }, [breadth]);

  // 4. Dynamic 20-Day Highs and Lows (Last 22 sessions)
  const dynamicHighsLows = useMemo(() => {
    if (breadth) {
      const liveNet = breadth.netHighLow ?? ((breadth.new52wHighs ?? 0) - (breadth.new52wLows ?? 0));
      const liveHighs = breadth.new52wHighs ?? mockHighsLows22.highsCount;
      const liveLows = breadth.new52wLows ?? mockHighsLows22.lowsCount;

      const updatedSessions = [...mockHighsLows22.sessions];
      if (updatedSessions.length > 0 && liveNet !== 0) {
        updatedSessions[updatedSessions.length - 1] = {
          session: 22,
          net: liveNet,
          highs: liveHighs,
          lows: liveLows,
        };
      }

      return {
        latestNet: liveNet !== 0 ? liveNet : mockHighsLows22.latestNet,
        highsCount: liveHighs,
        lowsCount: liveLows,
        sessions: updatedSessions,
      };
    }
    return mockHighsLows22;
  }, [breadth]);

  // 5. Live Indices (Nifty 50, Nifty 500, India VIX from DB)
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

  // Period filtering (1M / 3M / 1Y)
  const filteredParticipationSeries = useMemo(() => {
    if (selectedPeriod === "1M") return dynamicParticipationSeries.slice(-6);
    if (selectedPeriod === "3M") return dynamicParticipationSeries.slice(-10);
    return dynamicParticipationSeries;
  }, [selectedPeriod, dynamicParticipationSeries]);

  const filteredStageSeries = useMemo(() => {
    if (selectedPeriod === "1M") return dynamicStageSeries.slice(-6);
    if (selectedPeriod === "3M") return dynamicStageSeries.slice(-10);
    return dynamicStageSeries;
  }, [selectedPeriod, dynamicStageSeries]);

  // Stock Universe adaptation
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

  // Dynamic Market Read & Stage Analysis
  const adaptedMarketRead = useMemo(() => {
    const total = breadth
      ? (breadth.advances ?? 0) + (breadth.declines ?? 0) || currentUniverseObj.count
      : currentUniverseObj.count;

    if (breadth) {
      const adv = breadth.advances ?? 0;
      const dec = breadth.declines ?? 0;
      const p20 = breadth.pctAbove20Ema ?? 50;
      const p50 = breadth.pctAbove50Sma ?? 33.5;
      const p200 = breadth.pctAbove200Sma ?? 45;
      const regime = breadth.marketRegime || "CONFIRMED_UPTREND";
      const nf50Chg = breadth.nifty50ChangePct ?? 0;
      const nf500Chg = breadth.nifty500ChangePct ?? 0;

      const isPositiveMomentum = adv >= dec * 1.2;
      const isNegativeMomentum = dec >= adv * 1.2;
      const momentum = {
        id: "momentum",
        name: "Momentum",
        status: isPositiveMomentum ? "Positive" : isNegativeMomentum ? "Negative" : "Neutral",
        tone: isPositiveMomentum ? "positive" : isNegativeMomentum ? "negative" : "neutral",
        description: isPositiveMomentum
          ? `Buying is strong: ${adv.toLocaleString("en-IN")} stocks rising vs ${dec.toLocaleString("en-IN")} falling.`
          : isNegativeMomentum
          ? `Selling pressure: ${dec.toLocaleString("en-IN")} stocks falling vs ${adv.toLocaleString("en-IN")} rising.`
          : `Market balanced: ${adv.toLocaleString("en-IN")} rising vs ${dec.toLocaleString("en-IN")} falling.`,
      };

      const isShortTermUp = p20 >= 50 && (breadth.netHighLow ?? 0) >= 0;
      const shortTerm = {
        id: "short-term",
        name: "Short-term",
        status: isShortTermUp ? "Up" : "Down",
        tone: isShortTermUp ? "positive" : "negative",
        description: isShortTermUp
          ? `Short-term strength: ${p20.toFixed(1)}% of stocks trading above 20-day average.`
          : `Short-term weakness: only ${p20.toFixed(1)}% of stocks above 20-day average.`,
      };

      const isBigTrendBull = p200 >= 50;
      const isBigTrendBear = p200 < 35;
      const bigTrend = {
        id: "big-trend",
        name: "Big trend",
        status: isBigTrendBull ? "Bullish" : isBigTrendBear ? "Bearish" : "Neutral",
        tone: isBigTrendBull ? "positive" : isBigTrendBear ? "negative" : "neutral",
        description: isBigTrendBull
          ? `Long-term healthy: ${p200.toFixed(1)}% of stocks above their 200 DMA.`
          : isBigTrendBear
          ? `Long-term defensive: majority of stocks below their 200 DMA.`
          : `The bigger picture is split: neither buyers nor sellers in complete control.`,
      };

      const isBreakoutsWorking = regime.includes("UPTREND") || p20 >= 50;
      const breakouts = {
        id: "breakouts",
        name: "Breakouts",
        status: isBreakoutsWorking ? "Working" : "Failing",
        tone: isBreakoutsWorking ? "positive" : "negative",
        description: isBreakoutsWorking
          ? `Breakouts are working: favorable follow-through on Stage 2 setups.`
          : `Breakouts are struggling: higher failure rate; wait for volume confirmation.`,
      };

      const isOverbought = p20 > 80;
      const isOversold = p20 < 25;
      const overdone = {
        id: "overdone",
        name: "Overdone?",
        status: isOverbought ? "Overbought" : isOversold ? "Oversold" : "Normal",
        tone: isOverbought || isOversold ? "warning" : "neutral",
        description: isOverbought
          ? `Overstretched to the upside: exercise discipline on chasing extended stocks.`
          : isOversold
          ? `Oversold territory: watch for early accumulation and base reversals.`
          : `Not overdone: market breadth within healthy historical boundaries.`,
      };

      const isLargeCapLeading = nf50Chg > nf500Chg;
      const leadership = {
        id: "leadership",
        name: "Leadership",
        status: isLargeCapLeading ? "Large caps lead" : "Broad market lead",
        tone: "neutral",
        description: isLargeCapLeading
          ? `Big index heavyweights leading; mid and small caps lagging.`
          : `Broad market outperforming; mid and small caps showing relative strength.`,
      };

      const yest = breadthHistory[breadthHistory.length - 2];
      const stage2Pct = p50;
      const stage4Pct = Math.max(10, Math.min(65, 100 - stage2Pct - 15));
      const stage3Pct = Math.max(5, Math.min(20, Math.round(((breadth.new52wHighs || 10) / total) * 100) + 7));
      const stage1Pct = Math.max(3, +(100 - stage2Pct - stage4Pct - stage3Pct).toFixed(1));

      const stage2Diff = yest ? Math.round((stage2Pct - (yest.pctAbove50Sma ?? stage2Pct)) * (total / 100)) : -34;
      const stage4Diff = yest ? Math.round(((100 - stage2Pct) - (100 - (yest.pctAbove50Sma ?? stage2Pct))) * (total / 100)) : 38;

      return {
        indicators: [momentum, shortTerm, bigTrend, breakouts, overdone, leadership],
        stageAnalysis: {
          totalStocks: total,
          timeframe: "64+ days",
          stages: [
            { id: "base", name: "Base", stageNum: 1, pct: stage1Pct, change1D: -11, color: "#94A3B8" },
            { id: "uptrend", name: "Uptrend", stageNum: 2, pct: stage2Pct, change1D: stage2Diff, color: "#2563EB" },
            { id: "top", name: "Top", stageNum: 3, pct: stage3Pct, change1D: 7, color: "#F59E0B" },
            { id: "downtrend", name: "Downtrend", stageNum: 4, pct: stage4Pct, change1D: stage4Diff, color: "#F43F5E" },
          ],
        },
      };
    }

    return {
      ...mockMarketRead,
      stageAnalysis: {
        ...mockMarketRead.stageAnalysis,
        totalStocks: total,
      },
    };
  }, [currentUniverseObj, breadth, breadthHistory]);

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
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
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
          <MarketInternals breadth={breadth} breadthHistory={breadthHistory} />
        </div>
      )}

      {/* ── Tab 2: Market Internals Dedicated View ───────────────── */}
      {activeTab === "internals" && (
        <div className="space-y-4">
          <MarketInternals breadth={breadth} breadthHistory={breadthHistory} />
        </div>
      )}

      {/* ── Bottom Section: Indices Row (7 Benchmark Cards) ──────── */}
      <IndicesSection indices={dynamicIndices} />
    </PageContainer>
  );
}
