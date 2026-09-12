"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiDelete, apiGet, apiPatch, apiPost } from "./client";
import type { AlertKind, WatchlistAlert, WatchlistItem } from "./market-types";
import type { Envelope } from "./types";

const KEY = ["watchlist"];

export function useWatchlist() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => apiGet<Envelope<WatchlistItem[]>>("/watchlist"),
    staleTime: 60_000,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: KEY });
}

export function useAddWatchlistItem() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: { symbol: string; entry_price?: number | null }) =>
      apiPost<WatchlistItem>("/watchlist", body),
    onSuccess: invalidate,
  });
}

export function useUpdateWatchlistItem() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, entry_price }: { id: number; entry_price: number | null }) =>
      apiPatch<WatchlistItem>(`/watchlist/${id}`, { entry_price }),
    onSuccess: invalidate,
  });
}

export function useRemoveWatchlistItem() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: number) => apiDelete<void>(`/watchlist/${id}`),
    onSuccess: invalidate,
  });
}

export function useAddAlert() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ itemId, kind, threshold }: { itemId: number; kind: AlertKind; threshold: number }) =>
      apiPost<WatchlistAlert>(`/watchlist/${itemId}/alerts`, { kind, threshold }),
    onSuccess: invalidate,
  });
}

export function useUpdateAlert() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number; threshold?: number; enabled?: boolean }) =>
      apiPatch<WatchlistAlert>(`/watchlist/alerts/${id}`, body),
    onSuccess: invalidate,
  });
}

export function useRemoveAlert() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: number) => apiDelete<void>(`/watchlist/alerts/${id}`),
    onSuccess: invalidate,
  });
}
