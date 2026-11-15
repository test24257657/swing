/**
 * Mock data for the 6 Market Internals analytics cards.
 */

export const mockMarketInternals = {
  // Card 1: New Highs - Lows
  newHighsLows: {
    net: 282,
    statusText: "More highs than lows",
    weeklyChange: "+198 in a week",
    highs: 349,
    lows: 67,
    chartData: [
      { date: "Aug", net: -110, benchmark: -2.1 },
      { date: "Aug 15", net: -60, benchmark: -0.8 },
      { date: "Sep", net: -180, benchmark: -3.5 },
      { date: "Sep 15", net: -95, benchmark: -1.8 },
      { date: "Oct", net: -240, benchmark: -4.8 },
      { date: "Oct 15", net: -80, benchmark: -1.2 },
      { date: "Nov", net: 140, benchmark: 2.4 },
      { date: "Nov 13", net: 282, benchmark: 4.1 },
    ],
  },

  // Card 2: Advance / Decline
  advanceDecline: {
    ratio: 0.95,
    statusText: "Even",
    weeklyChange: "+0.05 in a week",
    subtext: "avg 1,233 up / 1,295 down",
    chartData: [
      { date: "Aug", ratio: 0.92, benchmark: 0.95 },
      { date: "Aug 15", ratio: 0.88, benchmark: 0.91 },
      { date: "Sep", ratio: 0.74, benchmark: 0.80 },
      { date: "Sep 15", ratio: 0.82, benchmark: 0.86 },
      { date: "Oct", ratio: 0.65, benchmark: 0.72 },
      { date: "Oct 15", ratio: 0.78, benchmark: 0.83 },
      { date: "Nov", ratio: 0.91, benchmark: 0.94 },
      { date: "Nov 13", ratio: 0.95, benchmark: 0.98 },
    ],
  },

  // Card 3: 4% Movers
  fourPercentMovers: {
    net: 21,
    statusText: "More up 4%+",
    subtext: "129 up / 108 down",
    chartData: [
      { date: "Aug", net: -15 },
      { date: "Aug 15", net: 35 },
      { date: "Sep", net: -45 },
      { date: "Sep 15", net: 12 },
      { date: "Oct", net: -68 },
      { date: "Oct 15", net: -24 },
      { date: "Nov", net: 48 },
      { date: "Nov 13", net: 21 },
    ],
  },

  // Card 4: Large vs Mid vs Small
  largeMidSmall: {
    statusText: "Large caps lead",
    referenceDateText: "Nifty 50 vs Midcap 150 vs Smallcap 250, return since 14 Aug",
    segments: [
      { id: "large", label: "Large", pct: 3.2, color: "#3478F6" },
      { id: "mid", label: "Mid", pct: -3.2, color: "#F97316" },
      { id: "small", label: "Small", pct: -1.9, color: "#16A878" },
    ],
    chartData: [
      { date: "14 Aug", large: 0, mid: 0, small: 0 },
      { date: "01 Sep", large: 1.2, mid: -1.5, small: -0.8 },
      { date: "15 Sep", large: 0.5, mid: -2.8, small: -2.1 },
      { date: "01 Oct", large: -1.2, mid: -5.4, small: -4.2 },
      { date: "15 Oct", large: -2.1, mid: -7.2, small: -5.8 },
      { date: "01 Nov", large: 1.8, mid: -4.1, small: -2.8 },
      { date: "13 Nov", large: 3.2, mid: -3.2, small: -1.9 },
    ],
  },

  // Card 5: Breakouts - Breakdowns
  breakoutsBreakdowns: {
    net: 7,
    statusText: "More held",
    subtext: "41 held / 34 failed today",
    chartData: [
      { date: "Aug", net: 12 },
      { date: "Aug 15", net: -8 },
      { date: "Sep", net: -18 },
      { date: "Sep 15", net: -24 },
      { date: "Oct", net: -35 },
      { date: "Oct 15", net: -12 },
      { date: "Nov", net: 14 },
      { date: "Nov 13", net: 7 },
    ],
  },

  // Card 6: Market Participation History
  participationHistory: {
    pct20: 74.4,
    pct50: 48.2,
    pct200: 55.6,
    chartData: [
      { date: "May", above20: 48, above50: 44, above200: 52 },
      { date: "Jul", above20: 65, above50: 58, above200: 54 },
      { date: "Aug", above20: 54, above50: 51, above200: 55 },
      { date: "Sep", above20: 46, above50: 45, above200: 53 },
      { date: "Oct", above20: 38, above50: 40, above200: 50 },
      { date: "Nov", above20: 74.4, above50: 48.2, above200: 55.6 },
    ],
  },
};
