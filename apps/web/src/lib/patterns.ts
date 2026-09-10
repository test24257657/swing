import type { BreakoutStage, PatternCode } from "@/lib/api/market-types";

export const PATTERNS: Record<PatternCode, { label: string; tone: "accent" | "info" | "up" | "stale"; tip: string }> = {
  vcp: {
    label: "VCP",
    tone: "accent",
    tip: "Volatility Contraction Pattern — successive pullbacks each shallower than the last, volume drying up into the pivot.",
  },
  ipo_base: {
    label: "IPO Base",
    tone: "info",
    tip: "First base built after listing — sideways range of 4+ weeks with the listing-day high as resistance.",
  },
  high_52w_breakout: {
    label: "52WH",
    tone: "up",
    tip: "Close above the highest close of the trailing 52 weeks, confirmed by above-average volume.",
  },
  near_pivot: {
    label: "Pivot",
    tone: "stale",
    tip: "Within 3% of the pattern pivot — the buy trigger level, not yet crossed.",
  },
};

export const STAGES: { code: BreakoutStage; label: string }[] = [
  { code: "forming", label: "Forming" },
  { code: "confirmed", label: "Confirmed" },
  { code: "extended", label: "Extended" },
];

export const STAGE_NOTE: Record<BreakoutStage, string> = {
  forming: "Pivot not yet crossed, or crossed without a volume thrust — a watchlist candidate.",
  confirmed: "Pivot crossed within 3 sessions on ≥1.4× the 20-day average volume.",
  extended: "More than 5% past the pivot — risk/reward has decayed.",
};
