"use client";

import { useQuery } from "@tanstack/react-query";

import { apiGet } from "./client";
import type { Envelope } from "./types";
import type {
  IndexCompare,
  IndexConstituents,
  IndexDetail,
  IndicesList,
  MarketPulse,
  MarketStatus,
  SectorRotation,
} from "./market-types";

export function useMarketStatus() {
  return useQuery({
    queryKey: ["market", "status"],
    queryFn: () => apiGet<MarketStatus>("/market/status"),
    refetchInterval: 30_000,
  });
}

export function useMarketPulse() {
  return useQuery({
    queryKey: ["market", "pulse"],
    queryFn: () => apiGet<Envelope<MarketPulse>>("/market/pulse"),
  });
}

export function useSectorRotation(tf: string) {
  return useQuery({
    queryKey: ["sectors", "rotation", tf],
    queryFn: () => apiGet<Envelope<SectorRotation>>("/sectors/rotation", { tf }),
  });
}

export function useIndices(category?: string) {
  return useQuery({
    queryKey: ["indices", category ?? "all"],
    queryFn: () => apiGet<Envelope<IndicesList>>("/indices", { category }),
  });
}

export function useIndexDetail(symbol: string | null, tf: string) {
  return useQuery({
    queryKey: ["index", symbol, tf],
    queryFn: () => apiGet<Envelope<IndexDetail>>(`/indices/${encodeURIComponent(symbol!)}`, { tf }),
    enabled: Boolean(symbol),
  });
}

export function useIndexConstituents(symbol: string | null) {
  return useQuery({
    queryKey: ["index", symbol, "constituents"],
    queryFn: () =>
      apiGet<Envelope<IndexConstituents>>(`/indices/${encodeURIComponent(symbol!)}/constituents`),
    enabled: Boolean(symbol),
  });
}

export function useIndexCompare(symbols: string[], tf: string) {
  return useQuery({
    queryKey: ["indices", "compare", symbols, tf],
    queryFn: () =>
      apiGet<Envelope<IndexCompare>>("/indices/compare", { symbols: symbols.join(","), tf }),
    enabled: symbols.length >= 2,
  });
}
