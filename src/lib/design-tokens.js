/**
 * Centralized Design System Tokens
 * Single source of truth for colors, typography, spacing, radius, and shadows.
 */

export const TOKENS = {
  colors: {
    // Brand & Primary
    primary: "#3478F6",
    primaryHover: "#2563EB",
    primarySubtle: "#EFF6FF",
    primaryBorder: "#BFDBFE",

    // Background surfaces
    bgMain: "#FFFFFF",
    bgSecondary: "#F8FAFC",
    bgCard: "#FFFFFF",
    bgHover: "#F1F5F9",
    bgSelected: "#EFF6FF",

    // Text & Typography
    textPrimary: "#17233B",
    textSecondary: "#64748B",
    textMuted: "#94A3B8",
    textDisabled: "#CBD5E1",
    textInverse: "#FFFFFF",

    // Market status (Indian Equities Financial Conventions)
    bullish: "#16A878", // Clean institutional green
    bullishBg: "#E8F8F3",
    bullishBorder: "#B5ECD9",

    bearish: "#F05283", // High-visibility financial pink/red (Marketsmith style)
    bearishBg: "#FEF0F4",
    bearishBorder: "#FCCEDB",

    neutral: "#94A3B8",
    neutralBg: "#F1F5F9",
    neutralBorder: "#E2E8F0",

    warning: "#E9A23B",
    warningBg: "#FEF7EC",
    warningBorder: "#FBDFA9",

    info: "#3478F6",
    infoBg: "#EFF6FF",
    infoBorder: "#BFDBFE",

    // Borders
    border: "#E5EAF2",
    borderSubtle: "#F1F5F9",
    borderStrong: "#CBD5E1",
    borderFocus: "#3478F6",

    // Market Cap & Index Specific
    largeCap: "#3478F6",
    midCap: "#F97316",
    smallCap: "#16A878",
    benchmark: "#94A3B8",
  },

  typography: {
    fontFamilySans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontFamilyMono: "'JetBrains Mono', ui-monospace, Menlo, Monaco, Consolas, monospace",

    // Font Sizes
    fontSize: {
      xs: "11px",
      sm: "12px",
      base: "13px",
      md: "14px",
      lg: "16px",
      xl: "18px",
      "2xl": "22px",
      "3xl": "26px",
    },

    // Font Weights
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  },

  spacing: {
    1: "4px",
    2: "8px",
    3: "12px",
    4: "16px",
    5: "20px",
    6: "24px",
    8: "32px",
    10: "40px",
    12: "48px",
  },

  radius: {
    xs: "2px",
    sm: "4px",
    md: "6px",
    lg: "8px",
    xl: "12px",
    full: "9999px",
  },

  shadows: {
    none: "none",
    subtle: "0 1px 2px 0 rgba(15, 23, 42, 0.04)",
    sm: "0 1px 3px 0 rgba(15, 23, 42, 0.06), 0 1px 2px 0 rgba(15, 23, 42, 0.04)",
    md: "0 4px 6px -1px rgba(15, 23, 42, 0.07), 0 2px 4px -1px rgba(15, 23, 42, 0.04)",
    dropdown: "0 10px 15px -3px rgba(15, 23, 42, 0.1), 0 4px 6px -2px rgba(15, 23, 42, 0.05)",
  },
};

export default TOKENS;
