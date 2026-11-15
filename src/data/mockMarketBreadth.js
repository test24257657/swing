/**
 * Mock data for the Market Breadth section (Columns 1, 2, 3).
 * Realistic EOD data modeled on institutional market internals analytics.
 */

export const mockMarketRead = {
  indicators: [
    {
      id: "momentum",
      name: "Momentum",
      status: "Positive",
      tone: "positive", // positive | neutral | negative
      description:
        "Buying is strong: about 3 stocks are jumping 4% for every one that drops 4%.",
    },
    {
      id: "short-term",
      name: "Short-term",
      status: "Up",
      tone: "positive",
      description:
        "The last few weeks have been strong: most stocks are rising, and new highs far outnumber new lows.",
    },
    {
      id: "big-trend",
      name: "Big trend",
      status: "Neutral",
      tone: "neutral",
      description:
        "The bigger picture is split: neither buyers nor sellers are in control over the long run.",
    },
    {
      id: "breakouts",
      name: "Breakouts",
      status: "Working",
      tone: "positive",
      description:
        "Breakouts are working: about 5 in 10 new buys are holding up.",
    },
    {
      id: "overdone",
      name: "Overdone?",
      status: "Normal",
      tone: "neutral",
      description: "Not overdone: small caps are within their usual range.",
    },
    {
      id: "leadership",
      name: "Leadership",
      status: "Large caps lead",
      tone: "neutral",
      description:
        "Big stocks are leading; mid and small caps are lagging behind.",
    },
  ],
  stageAnalysis: {
    totalStocks: 2388,
    timeframe: "64+ days",
    stages: [
      {
        id: "base",
        name: "Base",
        stageNum: 1,
        pct: 4.0,
        change1D: -11,
        color: "#94A3B8", // slate-400
      },
      {
        id: "uptrend",
        name: "Uptrend",
        stageNum: 2,
        pct: 33.5,
        change1D: -34,
        color: "#2563EB", // blue-600
      },
      {
        id: "top",
        name: "Top",
        stageNum: 3,
        pct: 9.8,
        change1D: 7,
        color: "#F59E0B", // amber-500
      },
      {
        id: "downtrend",
        name: "Downtrend",
        stageNum: 4,
        pct: 52.7,
        change1D: 38,
        color: "#F43F5E", // rose-500
      },
    ],
  },
};

// Market participation historical series (May to Nov)
export const mockParticipationSeries = [
  { date: "15 May", participation: 48.2, benchmark: 52.0 },
  { date: "29 May", participation: 52.6, benchmark: 54.1 },
  { date: "12 Jun", participation: 56.4, benchmark: 58.2 },
  { date: "26 Jun", participation: 62.1, benchmark: 60.5 },
  { date: "10 Jul", participation: 68.3, benchmark: 64.2 },
  { date: "24 Jul", participation: 65.1, benchmark: 66.8 },
  { date: "07 Aug", participation: 58.4, benchmark: 62.4 },
  { date: "21 Aug", participation: 54.2, benchmark: 59.1 },
  { date: "04 Sep", participation: 49.8, benchmark: 55.4 },
  { date: "18 Sep", participation: 46.1, benchmark: 52.3 },
  { date: "02 Oct", participation: 42.5, benchmark: 48.0 },
  { date: "16 Oct", participation: 38.2, benchmark: 45.2 },
  { date: "23 Oct", participation: 32.1, benchmark: 41.0 },
  { date: "30 Oct", participation: 46.8, benchmark: 49.5 },
  { date: "06 Nov", participation: 65.4, benchmark: 60.2 },
  { date: "13 Nov", participation: 74.4, benchmark: 68.5 },
];

export const mockParticipationStats = {
  currentPct: 74.4,
  status: "Broad",
  weeklyChangePts: 20.6,
  timeframeText: "Share of stocks above their 20-day average, as of Fri 13 Nov",
};

// Stage 2 vs Stage 4 comparison series (May to Nov)
export const mockStageComparisonSeries = [
  { date: "15 May", stage2: 32.4, stage4: 42.1 },
  { date: "29 May", stage2: 36.8, stage4: 39.5 },
  { date: "12 Jun", stage2: 41.2, stage4: 36.0 },
  { date: "26 Jun", stage2: 45.5, stage4: 32.4 },
  { date: "10 Jul", stage2: 44.1, stage4: 33.8 },
  { date: "24 Jul", stage2: 42.0, stage4: 36.2 },
  { date: "07 Aug", stage2: 39.5, stage4: 38.9 },
  { date: "21 Aug", stage2: 37.1, stage4: 41.2 },
  { date: "04 Sep", stage2: 34.0, stage4: 46.5 },
  { date: "18 Sep", stage2: 32.8, stage4: 51.2 },
  { date: "02 Oct", stage2: 29.5, stage4: 55.6 },
  { date: "16 Oct", stage2: 26.2, stage4: 58.4 },
  { date: "23 Oct", stage2: 22.4, stage4: 62.0 },
  { date: "30 Oct", stage2: 28.5, stage4: 54.2 },
  { date: "06 Nov", stage2: 34.1, stage4: 49.0 },
  { date: "13 Nov", stage2: 38.7, stage4: 46.1 },
];

// FII / DII Cash Activity (Last 22 sessions)
export const mockInstitutionalFlows = {
  fii: {
    dailyNetCr: 5737,
    monthNetCr: 76933,
    sessions: [
      { session: 1, val: -1240 },
      { session: 2, val: -980 },
      { session: 3, val: -1520 },
      { session: 4, val: -640 },
      { session: 5, val: 420 },
      { session: 6, val: -890 },
      { session: 7, val: -1120 },
      { session: 8, val: -450 },
      { session: 9, val: 860 },
      { session: 10, val: 1240 },
      { session: 11, val: 1980 },
      { session: 12, val: 2450 },
      { session: 13, val: -320 },
      { session: 14, val: 1890 },
      { session: 15, val: 2650 },
      { session: 16, val: 3120 },
      { session: 17, val: 1840 },
      { session: 18, val: 4210 },
      { session: 19, val: 3980 },
      { session: 20, val: 2850 },
      { session: 21, val: 4670 },
      { session: 22, val: 5737 },
    ],
  },
  dii: {
    dailyNetCr: -2254,
    monthNetCr: -32708,
    sessions: [
      { session: 1, val: 1420 },
      { session: 2, val: 1280 },
      { session: 3, val: 1890 },
      { session: 4, val: 940 },
      { session: 5, val: -210 },
      { session: 6, val: 1150 },
      { session: 7, val: 1420 },
      { session: 8, val: 860 },
      { session: 9, val: -420 },
      { session: 10, val: -890 },
      { session: 11, val: -1240 },
      { session: 12, val: -1820 },
      { session: 13, val: 650 },
      { session: 14, val: -1120 },
      { session: 15, val: -1680 },
      { session: 16, val: -2140 },
      { session: 17, val: -1420 },
      { session: 18, val: -2890 },
      { session: 19, val: -2640 },
      { session: 20, val: -1980 },
      { session: 21, val: -2410 },
      { session: 22, val: -2254 },
    ],
  },
};

// 20-Day Highs and Lows (Last 22 sessions)
export const mockHighsLows22 = {
  latestNet: 180,
  highsCount: 213,
  lowsCount: 33,
  sessions: [
    { session: 1, net: -140, highs: 25, lows: 165 },
    { session: 2, net: -120, highs: 32, lows: 152 },
    { session: 3, net: -160, highs: 18, lows: 178 },
    { session: 4, net: -95, highs: 42, lows: 137 },
    { session: 5, net: -80, highs: 55, lows: 135 },
    { session: 6, net: -110, highs: 38, lows: 148 },
    { session: 7, net: -145, highs: 22, lows: 167 },
    { session: 8, net: -65, highs: 60, lows: 125 },
    { session: 9, net: -30, highs: 78, lows: 108 },
    { session: 10, net: 10, highs: 98, lows: 88 },
    { session: 11, net: 45, highs: 122, lows: 77 },
    { session: 12, net: 68, highs: 138, lows: 70 },
    { session: 13, net: -15, highs: 82, lows: 97 },
    { session: 14, net: 55, highs: 128, lows: 73 },
    { session: 15, net: 92, highs: 152, lows: 60 },
    { session: 16, net: 115, highs: 168, lows: 53 },
    { session: 17, net: 85, highs: 144, lows: 59 },
    { session: 18, net: 140, highs: 186, lows: 46 },
    { session: 19, net: 155, highs: 195, lows: 40 },
    { session: 20, net: 125, highs: 172, lows: 47 },
    { session: 21, net: 165, highs: 202, lows: 37 },
    { session: 22, net: 180, highs: 213, lows: 33 },
  ],
};

