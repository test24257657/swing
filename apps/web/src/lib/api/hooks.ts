"use client";

import { useQuery } from "@tanstack/react-query";

import { apiGet } from "./client";
import { qk } from "./query-keys";
import type { Envelope, IngestionJobStatus, Sector, Symbol } from "./types";

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
