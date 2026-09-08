"use client";

import { create } from "zustand";

/**
 * Transient screener-rail UI state only. The actual filter values (patterns, stage,
 * sector, ranges, sort, page) live in the URL via nuqs — see
 * `lib/url/screener-params.ts` — so a screen is shareable and back/forward works.
 * This store holds the bits that should NOT be in the URL: whether the rail is
 * collapsed, and which "Refine" accordion is open.
 */
interface FiltersUIState {
  railCollapsed: boolean;
  openGroup: string | null;
  toggleRail: () => void;
  setOpenGroup: (g: string | null) => void;
}

export const useFilters = create<FiltersUIState>((set) => ({
  railCollapsed: false,
  openGroup: "universe",
  toggleRail: () => set((s) => ({ railCollapsed: !s.railCollapsed })),
  setOpenGroup: (g) => set((s) => ({ openGroup: s.openGroup === g ? null : g })),
}));
