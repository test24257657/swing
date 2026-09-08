"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiGet } from "./client";
import { qk } from "./query-keys";
import type {
  Envelope,
  IngestionJobStatus,
  SavedScreen,
  ScreenerResult,
  Sector,
  Symbol,
} from "./types";

/**
 * Loading / error convention for the whole app:
 *   - `isPending`  → render <Skeleton> matching the panel's shape
 *   - `isError`    → render an inline error card with a retry button
 *   - `data`       → the Envelope; read `data.meta.stale` for the amber treatment
 * Screen components never call `apiGet` directly — they use a hook from here.
 */

export function useHealth() {
  return useQuery({
    queryKey: qk.health,
    queryFn: () => apiGet<{ status: string; postgres: boolean; redis: boolean }>("/health"),
    refetchInterval: 30_000,
  });
}

export function useIngestionStatus() {
  return useQuery({
    queryKey: qk.ingestion,
    queryFn: () => apiGet<{ jobs: IngestionJobStatus[] }>("/meta/ingestion"),
    refetchInterval: 60_000,
  });
}

export function useSectors() {
  return useQuery({
    queryKey: qk.sectors,
    queryFn: () => apiGet<Envelope<Sector[]>>("/sectors"),
    staleTime: 60 * 60_000,
  });
}

export interface SymbolQuery {
  q?: string;
  sector?: string;
  fno_only?: boolean;
  limit?: number;
  offset?: number;
  [key: string]: string | number | boolean | undefined;
}

export function useSymbols(params: SymbolQuery = {}) {
  return useQuery({
    queryKey: qk.symbols(params),
    queryFn: () => apiGet<Envelope<Symbol[]>>("/symbols", params),
  });
}

export function useSymbol(nseSymbol: string) {
  return useQuery({
    queryKey: qk.symbol(nseSymbol),
    queryFn: () => apiGet<Envelope<Symbol>>(`/symbols/${nseSymbol}`),
    enabled: Boolean(nseSymbol),
  });
}

export type ScreenerParams = Record<
  string,
  string | number | boolean | string[] | undefined
>;

export function useScreener(params: ScreenerParams) {
  return useQuery({
    queryKey: qk.screener(params),
    queryFn: () => {
      // flatten array params (patterns, mcap_category) for the query string
      const flat: Record<string, string | number | boolean | undefined> = {};
      for (const [k, v] of Object.entries(params)) {
        flat[k] = Array.isArray(v) ? v.join(",") : v;
      }
      return apiGet<Envelope<ScreenerResult>>("/screener", flat);
    },
    placeholderData: (prev) => prev, // keep the table visible while refiltering
  });
}

export function useSavedScreens() {
  return useQuery({
    queryKey: qk.savedScreens,
    queryFn: () => apiGet<{ screens: SavedScreen[] }>("/screener/saved"),
  });
}

export function useSaveScreen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; filters: Record<string, unknown> }) =>
      fetch(`${process.env.NEXT_PUBLIC_API_BASE ?? "/api"}/screener/saved`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => {
        if (!r.ok) throw new Error("Could not save screen");
        return r.json();
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.savedScreens }),
  });
}

export function useDeleteScreen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetch(`${process.env.NEXT_PUBLIC_API_BASE ?? "/api"}/screener/saved/${id}`, {
        method: "DELETE",
      }).then((r) => {
        if (!r.ok && r.status !== 204) throw new Error("Could not delete screen");
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.savedScreens }),
  });
}
