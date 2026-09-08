/** Mirrors app/schemas/envelope.py — every payload is wrapped in this. */
export interface Meta {
  source: string;
  as_of: string | null;
  stale: boolean;
  job: string | null;
}

export interface Envelope<T> {
  data: T;
  meta: Meta;
}

export interface Sector {
  id: number;
  name: string;
  slug: string;
  nse_index_symbol: string | null;
}

export interface Symbol {
  id: number;
  nse_symbol: string;
  name: string;
  isin: string | null;
  series: string;
  industry: string | null;
  is_active: boolean;
  is_fno: boolean;
  lot_size: number | null;
  mcap_category: string | null;
  listing_date: string | null;
  sector: Sector | null;
}

// Mirrors app/schemas/screener.py
export interface ScreenerRow {
  symbol: string;
  name: string;
  sector: string | null;
  is_fno: boolean;
  ltp: number | null;
  change_pct: number | null;
  composite_score: number | null;
  verdict: string | null;
  inputs_present: number | null;
  rank_overall: number | null;
  momentum_score: number | null;
  delivery_quality_score: number | null;
  relative_strength_score: number | null;
  earnings_trend_score: number | null;
  rsi_14: number | null;
  rs_vs_sector_1m: number | null;
  dist_52w_high_pct: number | null;
  delivery_pct_sma_20: number | null;
  rel_volume: number | null;
  ret_20d: number | null;
  above_sma_20: boolean | null;
  above_sma_50: boolean | null;
  above_sma_200: boolean | null;
  patterns: string[];
}

export interface ScreenerFacets {
  sectors: Record<string, number>;
  verdicts: Record<string, number>;
}

export interface ScreenerResult {
  rows: ScreenerRow[];
  total: number;
  page: number;
  per_page: number;
  as_of: string | null;
  score_validated: boolean;
  facets: ScreenerFacets;
}

export interface SavedScreen {
  id: number;
  name: string;
  filters: Record<string, unknown>;
  updated_at: string;
}

export interface IngestionJobStatus {
  job: string;
  business_date: string;
  status: "running" | "success" | "partial" | "failed";
  started_at: string;
  finished_at: string | null;
  rows_written: number;
  source_stats: Record<string, unknown> | null;
  error: string | null;
}
