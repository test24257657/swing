/**
 * Application & design tokens for the Market Breadth Dashboard.
 */

export const THEME_COLORS = {
  bgPage: "#F8FAFC",
  bgCard: "#FFFFFF",
  textPrimary: "#0F172A", // Dark navy / slate-900
  textSecondary: "#64748B", // Slate-500
  textMuted: "#94A3B8", // Slate-400
  border: "#E2E8F0", // Slate-200
  borderLight: "#F1F5F9",

  // Chart specific
  primaryBlue: "#2563EB", // Primary line / accent
  primaryBlueFill: "#DBEAFE", // Area gradient
  pinkRed: "#F43F5E", // Bearish / Stage 4 / Lows / Negative
  pinkRedFill: "#FFE4E6",
  greenBullish: "#10B981", // Bullish / Positives
  greenFill: "#D1FAE5",
  benchmarkGrey: "#94A3B8", // Nifty 500 line
  amberWarning: "#F59E0B",
  orangeMid: "#F97316", // Midcap
};

export const STOCK_UNIVERSES = [
  { id: "all", label: "All stocks", count: 2561 },
  { id: "liquid", label: "Liquid stocks", count: 1508 },
  { id: "nifty500", label: "Nifty 500", count: 501 },
  { id: "nifty200", label: "Nifty 200", count: 201 },
  { id: "nifty100", label: "Nifty 100", count: 101 },
];

export const PERIOD_OPTIONS = [
  { id: "1M", label: "1M" },
  { id: "3M", label: "3M" },
  { id: "1Y", label: "1Y" },
];

