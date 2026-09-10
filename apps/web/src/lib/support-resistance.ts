import type { ChartBar } from "@/lib/api/market-types";

export interface SrLevel {
  price: number;
  type: "support" | "resistance";
  touches: number;
}

interface Options {
  /** a bar is a swing point if its high/low is the extreme within +/- this many bars */
  window: number;
  /** swing points within this % of each other merge into one level */
  mergePct: number;
  /** levels kept per side, ranked by touch count */
  maxLevels: number;
}

const DEFAULTS: Options = { window: 3, mergePct: 1.5, maxLevels: 3 };

/** Horizontal support/resistance from swing highs/lows, clustered by proximity. Pure
 * function over whatever bars are on screen — recomputes per timeframe (D/W/M). */
export function supportResistance(bars: ChartBar[], opts: Partial<Options> = {}): SrLevel[] {
  const { window, mergePct, maxLevels } = { ...DEFAULTS, ...opts };
  if (bars.length < window * 2 + 1) return [];
  const lastClose = bars[bars.length - 1].close;
  if (lastClose == null) return [];

  const swingHighs: number[] = [];
  const swingLows: number[] = [];
  for (let i = window; i < bars.length - window; i++) {
    const h = bars[i].high;
    const l = bars[i].low;
    if (h == null || l == null) continue;
    const segment = bars.slice(i - window, i + window + 1);
    const segHigh = Math.max(...segment.map((b) => b.high ?? -Infinity));
    const segLow = Math.min(...segment.map((b) => b.low ?? Infinity));
    if (h === segHigh) swingHighs.push(h);
    if (l === segLow) swingLows.push(l);
  }

  function cluster(prices: number[]): { price: number; touches: number }[] {
    const sorted = [...prices].sort((a, b) => a - b);
    const groups: number[][] = [];
    for (const p of sorted) {
      const g = groups.at(-1);
      const avg = g ? g.reduce((s, v) => s + v, 0) / g.length : null;
      if (g && avg !== null && Math.abs(p / avg - 1) * 100 <= mergePct) g.push(p);
      else groups.push([p]);
    }
    return groups.map((g) => ({
      price: g.reduce((s, v) => s + v, 0) / g.length,
      touches: g.length,
    }));
  }

  const resistance = cluster(swingHighs.filter((p) => p > lastClose))
    .sort((a, b) => b.touches - a.touches || a.price - b.price)
    .slice(0, maxLevels)
    .map((l): SrLevel => ({ ...l, type: "resistance" }));

  const support = cluster(swingLows.filter((p) => p < lastClose))
    .sort((a, b) => b.touches - a.touches || b.price - a.price)
    .slice(0, maxLevels)
    .map((l): SrLevel => ({ ...l, type: "support" }));

  return [...resistance, ...support];
}
