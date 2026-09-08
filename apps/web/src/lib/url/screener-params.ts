"use client";

import {
  parseAsArrayOf,
  parseAsBoolean,
  parseAsFloat,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from "nuqs";

/**
 * Screener filters live in the URL so a screen is shareable and back/forward works.
 * Transient UI (which accordion is open, the collapsed rail) stays in the Zustand
 * `useFilters` store.
 */

export const PATTERNS = ["vcp", "ipo_base", "high_52w_breakout", "near_pivot"] as const;
export type PatternCode = (typeof PATTERNS)[number];

export const STAGES = ["all", "forming", "confirmed", "extended"] as const;
export type Stage = (typeof STAGES)[number];

export const SORTS = [
  "composite",
  "rsi",
  "rs",
  "delivery",
  "rel_volume",
  "ret_20d",
  "dist_52wh",
] as const;
export type Sort = (typeof SORTS)[number];

export const screenerParsers = {
  patterns: parseAsArrayOf(parseAsStringLiteral(PATTERNS)).withDefault([]),
  stage: parseAsStringLiteral(STAGES).withDefault("all"),
  sector: parseAsString,
  fno_only: parseAsBoolean.withDefault(false),

  rsi_min: parseAsFloat,
  rsi_max: parseAsFloat,
  dist_52wh_min: parseAsFloat,
  dist_52wh_max: parseAsFloat,
  rel_volume_min: parseAsFloat,
  delivery_min: parseAsFloat,
  min_score: parseAsFloat,

  above_sma_20: parseAsBoolean.withDefault(false),
  above_sma_50: parseAsBoolean.withDefault(false),
  above_sma_200: parseAsBoolean.withDefault(false),

  sort: parseAsStringLiteral(SORTS).withDefault("composite"),
  order: parseAsStringLiteral(["asc", "desc"] as const).withDefault("desc"),
  page: parseAsInteger.withDefault(1),
  per_page: parseAsInteger.withDefault(25),
};

export function useScreenerParams() {
  return useQueryStates(screenerParsers, { history: "replace", clearOnDefault: true });
}

export type ScreenerState = ReturnType<typeof useScreenerParams>[0];
export type ScreenerPatch = Parameters<ReturnType<typeof useScreenerParams>[1]>[0];

/** Everything back to default — for "Reset" and "apply a saved screen". */
export const RESET_PARAMS: Partial<ScreenerState> = {
  patterns: [],
  stage: "all",
  sector: null,
  fno_only: false,
  rsi_min: null,
  rsi_max: null,
  dist_52wh_min: null,
  dist_52wh_max: null,
  rel_volume_min: null,
  delivery_min: null,
  min_score: null,
  above_sma_20: false,
  above_sma_50: false,
  above_sma_200: false,
  sort: "composite",
  order: "desc",
  page: 1,
};

/** Turn URL state into the query object the API expects (drop nulls/defaults). */
export function toApiParams(s: ScreenerState): Record<string, string | number | boolean | string[] | undefined> {
  const out: Record<string, string | number | boolean | string[] | undefined> = {
    sort: s.sort,
    order: s.order,
    page: s.page,
    per_page: s.per_page,
  };
  if (s.patterns.length) out.patterns = [...s.patterns];
  if (s.stage !== "all") out.stage = s.stage;
  if (s.sector) out.sector = s.sector;
  if (s.fno_only) out.fno_only = true;
  for (const k of ["rsi_min", "rsi_max", "dist_52wh_min", "dist_52wh_max", "rel_volume_min", "delivery_min", "min_score"] as const) {
    if (s[k] != null) out[k] = s[k] as number;
  }
  for (const k of ["above_sma_20", "above_sma_50", "above_sma_200"] as const) {
    if (s[k]) out[k] = true;
  }
  return out;
}

/** Count the active (non-default) filters — for the sidebar badge. */
export function activeFilterCount(s: ScreenerState): number {
  let n = s.patterns.length + (s.stage !== "all" ? 1 : 0) + (s.sector ? 1 : 0) + (s.fno_only ? 1 : 0);
  if (s.rsi_min != null || s.rsi_max != null) n += 1;
  if (s.dist_52wh_min != null || s.dist_52wh_max != null) n += 1;
  if (s.rel_volume_min != null) n += 1;
  if (s.delivery_min != null) n += 1;
  if (s.min_score != null) n += 1;
  if (s.above_sma_20 || s.above_sma_50 || s.above_sma_200) n += 1;
  return n;
}
