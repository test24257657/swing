"use client";

import { useQuery } from "@tanstack/react-query";

import { apiGet } from "./client";
import type { ChartArtifact, MarketPulse, MarketStatus, ScreenerData } from "./market-types";
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

/** Setup-pattern matches across the whole panel, from the nightly artifact. */
export function useScreener() {
  return useQuery({
    queryKey: ["screener"],
    queryFn: () => apiGet<Envelope<ScreenerData>>("/screener"),
    staleTime: 5 * 60_000,
  });
}

/** OHLCV + moving averages for one instrument shown on Pulse. */
export function useChart(slug: string) {
  return useQuery({
    queryKey: ["chart", slug],
    queryFn: () => apiGet<Envelope<ChartArtifact>>(`/chart/${slug}`),
    staleTime: 5 * 60_000,
    enabled: Boolean(slug),
  });
}
