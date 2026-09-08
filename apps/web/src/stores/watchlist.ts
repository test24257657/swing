"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Client-side watchlist store — Phase 0 keeps it local so the screener → watchlist flow
 * works before the API's watchlist endpoints exist (Phase 5). It will become a thin cache
 * over server state then; the shape is deliberately close to `watchlist_items`.
 */

export interface WatchlistItem {
  nseSymbol: string;
  name: string;
  addedAt: string;
  entry: number | null;
  target: number | null;
  stop: number | null;
  thesis: string;
}

interface WatchlistState {
  items: Record<string, WatchlistItem>;
  expanded: string | null;

  add: (item: Omit<WatchlistItem, "addedAt"> & { addedAt?: string }) => void;
  remove: (nseSymbol: string) => void;
  has: (nseSymbol: string) => boolean;
  update: (nseSymbol: string, patch: Partial<WatchlistItem>) => void;
  toggleExpanded: (nseSymbol: string) => void;
  list: () => WatchlistItem[];
}

export const useWatchlist = create<WatchlistState>()(
  persist(
    (set, get) => ({
      items: {},
      expanded: null,

      add: (item) =>
        set((s) => ({
          items: {
            ...s.items,
            [item.nseSymbol]: {
              target: null,
              stop: null,
              entry: null,
              thesis: "",
              ...item,
              addedAt: item.addedAt ?? new Date().toISOString(),
            },
          },
        })),
      remove: (nseSymbol) =>
        set((s) => {
          const next = { ...s.items };
          delete next[nseSymbol];
          return { items: next };
        }),
      has: (nseSymbol) => nseSymbol in get().items,
      update: (nseSymbol, patch) =>
        set((s) =>
          s.items[nseSymbol]
            ? { items: { ...s.items, [nseSymbol]: { ...s.items[nseSymbol], ...patch } } }
            : s,
        ),
      toggleExpanded: (nseSymbol) =>
        set((s) => ({ expanded: s.expanded === nseSymbol ? null : nseSymbol })),
      list: () =>
        Object.values(get().items).sort((a, b) => b.addedAt.localeCompare(a.addedAt)),
    }),
    { name: "swing.watchlist" },
  ),
);
