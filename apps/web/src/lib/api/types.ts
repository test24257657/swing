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
