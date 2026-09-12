/** Shared verdict tone → box style, used by every plain-English "what does this mean"
 * callout (Pulse breadth/flow/volatility, the chart page's technical verdict). */
export type Tone = "up" | "down" | "neutral";

export const TONE_BOX: Record<Tone, { bg: string; bd: string; fg: string }> = {
  up: { bg: "rgba(22,163,74,0.07)", bd: "rgba(22,163,74,0.22)", fg: "text-up-text" },
  down: { bg: "rgba(220,38,38,0.07)", bd: "rgba(220,38,38,0.25)", fg: "text-down-text" },
  neutral: { bg: "rgba(37,99,235,0.07)", bd: "rgba(37,99,235,0.22)", fg: "text-[var(--color-info-text)]" },
};
