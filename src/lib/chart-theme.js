/**
 * Centralized Recharts Visual Configuration
 * Single source of truth for all charts across the platform.
 */

import { TOKENS } from "./design-tokens";

export const CHART_THEME = {
  colors: {
    primary: TOKENS.colors.primary,
    primaryFill: "rgba(52, 120, 246, 0.12)",
    primaryGradient: {
      from: "rgba(52, 120, 246, 0.25)",
      to: "rgba(52, 120, 246, 0.01)",
    },
    benchmark: TOKENS.colors.benchmark,
    benchmarkFill: "rgba(148, 163, 184, 0.12)",

    bullish: TOKENS.colors.bullish,
    bullishFill: "rgba(22, 168, 120, 0.15)",

    bearish: TOKENS.colors.bearish,
    bearishFill: "rgba(240, 82, 131, 0.15)",

    largeCap: TOKENS.colors.largeCap,
    midCap: TOKENS.colors.midCap,
    smallCap: TOKENS.colors.smallCap,
  },

  grid: {
    stroke: "#F1F5F9",
    strokeDasharray: "3 3",
    vertical: false,
    horizontal: true,
  },

  axis: {
    tick: {
      fill: "#94A3B8",
      fontSize: 10,
      fontFamily: "'Inter', sans-serif",
    },
    line: false,
    tickLine: false,
  },

  referenceLine: {
    stroke: "#E2E8F0",
    strokeDasharray: "2 2",
    strokeWidth: 1,
  },

  line: {
    strokeWidth: 1.75,
    dot: false,
    activeDot: { r: 4, strokeWidth: 1.5, stroke: "#FFFFFF" },
  },

  bar: {
    radius: [2, 2, 0, 0],
    maxBarSize: 24,
  },

  tooltip: {
    wrapperStyle: { outline: "none", zIndex: 100 },
    contentStyle: {
      backgroundColor: "#FFFFFF",
      border: "1px solid #E5EAF2",
      borderRadius: "6px",
      padding: "8px 12px",
      boxShadow: "0 4px 6px -1px rgba(15, 23, 42, 0.08)",
      fontSize: "12px",
      fontFamily: "'Inter', sans-serif",
      color: "#17233B",
    },
  },
};

export default CHART_THEME;
