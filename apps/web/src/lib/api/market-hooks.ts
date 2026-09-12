"use client";

import { useQuery } from "@tanstack/react-query";

import { apiGet } from "./client";
import type {
  ChartArtifact,
  FundamentalsData,
  IndicesData,
  MarketPulse,
  MarketStatus,
  NewsData,
  ScreenerData,
  SectorsData,
} from "./market-types";
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

/** Quarterly revenue/net-income, last 4 quarters. Not every symbol has this — a 404 just
 * means yfinance had nothing for it, not an error worth surfacing. */
export function useFundamentals(slug: string) {
  return useQuery({
    queryKey: ["fundamentals", slug],
    queryFn: () => apiGet<Envelope<FundamentalsData>>(`/fundamentals/${slug}`),
    staleTime: 5 * 60_000,
    enabled: Boolean(slug),
    retry: false,
  });
}

/** Sector rotation — 1M/3M ranking, rank deltas, RRG tail, constituents. */
export function useSectors() {
  return useQuery({
    queryKey: ["sectors"],
    queryFn: () => apiGet<Envelope<SectorsData>>("/sectors"),
    staleTime: 5 * 60_000,
  });
}

/** Every broad-market + sector index — value, change, category. */
export function useIndices() {
  return useQuery({
    queryKey: ["indices"],
    queryFn: () => apiGet<Envelope<IndicesData>>("/indices"),
    staleTime: 5 * 60_000,
  });
}

/** Corporate announcements for the interesting symbol universe, AI-classified by impact. */
export function useNews() {
  return useQuery({
    queryKey: ["news"],
    queryFn: () => apiGet<Envelope<NewsData>>("/news"),
    staleTime: 5 * 60_000,
  });
}
