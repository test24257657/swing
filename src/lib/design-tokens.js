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
    bullish: "#16A878",
    bullishBg: "#E8F8F3",
    bullishBorder: "#B5ECD9",

    bearish: "#F05283",
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
    fontFamily: {
      sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      mono: "'JetBrains Mono', ui-monospace, Menlo, Monaco, Consolas, monospace",
    },

    // Strict typography scale with line-height & letter-spacing
    scale: {
      "2xs": { fontSize: "10px", lineHeight: "14px", letterSpacing: "0em" },
      xs: { fontSize: "11px", lineHeight: "16px", letterSpacing: "0.02em" },
      sm: { fontSize: "12px", lineHeight: "16px", letterSpacing: "-0.01em" },
      base: { fontSize: "13px", lineHeight: "18px", letterSpacing: "-0.01em" },
      md: { fontSize: "14px", lineHeight: "20px", letterSpacing: "-0.015em" },
      lg: { fontSize: "16px", lineHeight: "22px", letterSpacing: "-0.02em" },
      xl: { fontSize: "18px", lineHeight: "24px", letterSpacing: "-0.02em" },
      "2xl": { fontSize: "22px", lineHeight: "28px", letterSpacing: "-0.025em" },
      "3xl": { fontSize: "26px", lineHeight: "32px", letterSpacing: "-0.03em" },
    },

    // Weights
    weight: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },

    // Semantic text roles
    roles: {
      pageTitle: {
        fontFamily: "sans",
        fontSize: "15px",
        fontWeight: 700,
        lineHeight: "18px",
        letterSpacing: "-0.02em",
        color: "#17233B",
      },
      sectionTitle: {
        fontFamily: "sans",
        fontSize: "12px",
        fontWeight: 700,
        lineHeight: "16px",
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        color: "#17233B",
      },
      cardHeading: {
        fontFamily: "sans",
        fontSize: "13px",
        fontWeight: 700,
        lineHeight: "18px",
        letterSpacing: "-0.01em",
        color: "#17233B",
      },
      metricDisplay: {
        fontFamily: "sans",
        fontSize: "22px",
        fontWeight: 700,
        lineHeight: "26px",
        letterSpacing: "-0.025em",
        tabularNums: true,
        color: "#17233B",
      },
      body: {
        fontFamily: "sans",
        fontSize: "12px",
        fontWeight: 400,
        lineHeight: "16px",
        color: "#64748B",
      },
      labelCaps: {
        fontFamily: "sans",
        fontSize: "11px",
        fontWeight: 600,
        lineHeight: "14px",
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        color: "#64748B",
      },
      footnote: {
        fontFamily: "sans",
        fontSize: "10px",
        fontWeight: 500,
        lineHeight: "14px",
        color: "#94A3B8",
      },
      tableNumeral: {
        fontFamily: "sans",
        fontSize: "12px",
        fontWeight: 600,
        tabularNums: true,
        color: "#17233B",
      },
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
  },
};

export default TOKENS;
