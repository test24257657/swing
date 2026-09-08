"use client";

import { create } from "zustand";

/**
 * Screener filter state.
 *
 * NOTE: filters that belong in the URL (patterns, stage, sector, ranges) will move to
 * nuqs in Phase 1 so a screen is shareable and back/forward works. This store holds the
 * transient bits — which refine group is open, whether the rail is collapsed — plus a
 * mirror of the active filters for components that should not each parse the URL.
 */

export type PatternCode = "vcp" | "ipo_base" | "high_52w_breakout" | "near_pivot";
export type BreakoutStage = "all" | "forming" | "confirmed" | "extended";

export interface RangeFilter {
  min: number | null;
  max: number | null;
}

interface FiltersState {
  patterns: PatternCode[];
  stage: BreakoutStage;
  sector: string | null;
  rsi: RangeFilter;
  distFrom52wHigh: RangeFilter;
  volVs20d: RangeFilter;
  deliveryPct: RangeFilter;
  aboveDma: { d20: boolean; d50: boolean; d200: boolean };

  railCollapsed: boolean;
  openGroup: string | null;

  togglePattern: (p: PatternCode) => void;
  setStage: (s: BreakoutStage) => void;
  setSector: (s: string | null) => void;
  setRange: (key: "rsi" | "distFrom52wHigh" | "volVs20d" | "deliveryPct", r: RangeFilter) => void;
  toggleDma: (k: "d20" | "d50" | "d200") => void;
  setOpenGroup: (g: string | null) => void;
  toggleRail: () => void;
  reset: () => void;
  activeCount: () => number;
}

const DEFAULTS = {
  patterns: ["vcp", "high_52w_breakout"] as PatternCode[],
  stage: "confirmed" as BreakoutStage,
  sector: null as string | null,
  rsi: { min: 55, max: 72 },
  distFrom52wHigh: { min: 0, max: 12 },
  volVs20d: { min: 1.4, max: null },
  deliveryPct: { min: 55, max: null },
  aboveDma: { d20: true, d50: true, d200: false },
};

export const useFilters = create<FiltersState>((set, get) => ({
  ...DEFAULTS,
  railCollapsed: false,
  openGroup: null,

  togglePattern: (p) =>
    set((s) => ({
      patterns: s.patterns.includes(p)
        ? s.patterns.filter((x) => x !== p)
        : [...s.patterns, p],
    })),
  setStage: (stage) => set({ stage }),
  setSector: (sector) => set({ sector }),
  setRange: (key, r) => set({ [key]: r } as Partial<FiltersState>),
  toggleDma: (k) => set((s) => ({ aboveDma: { ...s.aboveDma, [k]: !s.aboveDma[k] } })),
  setOpenGroup: (openGroup) => set((s) => ({ openGroup: s.openGroup === openGroup ? null : openGroup })),
  toggleRail: () => set((s) => ({ railCollapsed: !s.railCollapsed })),
  reset: () => set({ ...DEFAULTS }),
  activeCount: () => {
    const s = get();
    let n = s.patterns.length + (s.stage !== "all" ? 1 : 0) + (s.sector ? 1 : 0);
    for (const r of [s.rsi, s.distFrom52wHigh, s.volVs20d, s.deliveryPct]) {
      if (r.min != null || r.max != null) n += 1;
    }
    return n;
  },
}));
