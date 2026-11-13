import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Run parallel queries across hot state
    const [
      breadth,
      breadthHistory,
      topPicksRecord,
      morningBriefRecord,
      topScoredStocks,
      recentPatterns,
      recentDeals,
    ] = await Promise.all([
      // 1. Latest Market Breadth & Sector RRG
      prisma.marketBreadthAndSector.findFirst({
        orderBy: { tradeDate: "desc" },
      }),

      // 1b. Rolling 30 sessions of breadth for trendlines & sparklines
      prisma.marketBreadthAndSector.findMany({
        take: 30,
        orderBy: { tradeDate: "desc" },
        select: {
          tradeDate: true,
          nifty50Close: true,
          nifty50ChangePct: true,
          nifty500Close: true,
          nifty500ChangePct: true,
          indiaVix: true,
          advances: true,
          declines: true,
          pctAbove20Ema: true,
          pctAbove50Sma: true,
          pctAbove200Sma: true,
          new52wHighs: true,
          new52wLows: true,
          netHighLow: true,
          fiiNetCr: true,
          diiNetCr: true,
          marketRegime: true,
        },
      }),

      // 2. Nightly Top 5 Picks AI Cache
      prisma.aiIntelligence.findFirst({
        where: { category: "TOP_PICKS" },
        orderBy: { createdAt: "desc" },
      }),

      // 3. Morning Brief AI Cache
      prisma.aiIntelligence.findFirst({
        where: { category: "MORNING_BRIEF" },
        orderBy: { createdAt: "desc" },
      }),

      // 4. Top 500 Stocks by Techno-Funda Score (full screener dataset)
      prisma.latestTechnical.findMany({
        take: 500,
        orderBy: { technoFundaScore: "desc" },
        include: {
          symbolRel: {
            select: {
              companyName: true,
              sector: true,
              exchange: true,
              series: true,
              isFno: true,
              fundamental: {
                select: {
                  roce: true,
                  epsGrowthQoQ: true,
                  salesGrowthQoQ: true,
                  debtToEquity: true,
                  fiiChangeQoQ: true,
                  fundamentalScore: true,
                },
              },
            },
          },
        },
      }),

      // 5. Recent Pattern Signals
      prisma.patternSignal.findMany({
        take: 40,
        orderBy: { tradeDate: "desc" },
      }),

      // 6. Institutional deals (last 200 records for repeat accumulation & pagination)
      prisma.institutionalActivity.findMany({
        take: 200,
        orderBy: { tradeDate: "desc" },
      }),
    ]);

    return NextResponse.json({
      breadth,
      breadthHistory: breadthHistory.reverse(), // Ascending chronological order
      topPicks: topPicksRecord?.payload || null,
      morningBrief: morningBriefRecord?.payload || null,
      topScoredStocks,
      recentPatterns,
      recentDeals,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
