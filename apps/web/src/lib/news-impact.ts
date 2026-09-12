import type { NewsImpact } from "@/lib/api/market-types";

/** Shared 5-level impact styling for the News screen and stock-scoped announcement
 * cards — kept in one place so the two surfaces never drift apart visually. */
export const IMPACT_META: Record<NewsImpact, { label: string; icon: string; fg: string; bar: string; bg: string; bd: string }> = {
  very_positive: { label: "Strong positive", icon: "🚀", fg: "#15803D", bar: "#16A34A", bg: "rgba(22,163,74,0.10)", bd: "rgba(22,163,74,0.28)" },
  positive: { label: "Positive", icon: "✅", fg: "#1D4ED8", bar: "#2563EB", bg: "rgba(37,99,235,0.10)", bd: "rgba(37,99,235,0.25)" },
  neutral: { label: "Neutral", icon: "⚪", fg: "#52525B", bar: "#8B8B93", bg: "var(--color-surface-2)", bd: "var(--color-border)" },
  negative: { label: "Negative", icon: "⚠️", fg: "#B45309", bar: "#D97706", bg: "rgba(217,119,6,0.10)", bd: "rgba(217,119,6,0.28)" },
  very_negative: { label: "Strong negative", icon: "❌", fg: "#B91C1C", bar: "#DC2626", bg: "rgba(220,38,38,0.10)", bd: "rgba(220,38,38,0.28)" },
};

export const IMPACT_ORDER: NewsImpact[] = ["very_positive", "positive", "neutral", "negative", "very_negative"];
