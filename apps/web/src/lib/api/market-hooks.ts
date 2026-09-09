"use client";

import { useQuery } from "@tanstack/react-query";

import { apiGet } from "./client";
import type { MarketPulse, MarketStatus } from "./market-types";
import type { Envelope } from "./types";

/** The whole Market Pulse screen, served from the nightly artifact. */
export function useMarketPulse() {
  return useQuery({
    queryKey: ["pulse"],
    queryFn: () => apiGet<Envelope<MarketPulse>>("/pulse"),
    staleTime: 5 * 60_000,
  });
}

export function useMarketStatus() {
  return useQuery({
    queryKey: ["market", "status"],
    queryFn: () => apiGet<MarketStatus>("/market/status"),
    refetchInterval: 60_000,
  });
}
