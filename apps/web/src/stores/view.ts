"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/** View-mode state that is remembered per user across sessions (per the design note on
 * the screener view toggle: "Remembered per user across sessions"). */

export type ScreenerView = "list" | "chart";
export type IndicesView = "list" | "chart";
export type WatchlistView = "table" | "cards";

interface ViewState {
  screenerView: ScreenerView;
  indicesView: IndicesView;
  watchlistView: WatchlistView;
  perPage: number;

  setScreenerView: (v: ScreenerView) => void;
  setIndicesView: (v: IndicesView) => void;
  setWatchlistView: (v: WatchlistView) => void;
  setPerPage: (n: number) => void;
}

export const useView = create<ViewState>()(
  persist(
    (set) => ({
      screenerView: "list",
      indicesView: "list",
      watchlistView: "table",
      perPage: 10,
      setScreenerView: (screenerView) => set({ screenerView }),
      setIndicesView: (indicesView) => set({ indicesView }),
      setWatchlistView: (watchlistView) => set({ watchlistView }),
      setPerPage: (perPage) => set({ perPage }),
    }),
    { name: "swing.view" },
  ),
);
