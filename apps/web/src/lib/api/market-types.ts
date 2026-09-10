/** Market Pulse — mirrors the `out/pulse.json` artifact produced by `jobs/`. */

export interface MarketStatus {
  status: "trading" | "preopen" | "closed" | "holiday";
  label: string;
  as_of: string;
  next_session: string;
}

export interface IndexTile {
  symbol: string;
  value: number;
  change: number | null;
  change_pct: number | null;
  spark: number[];
  as_of: string;
}

export interface Breadth {
  date: string;
  advances: number;
  declines: number;
  unchanged: number;
  traded: number;
  ad_ratio: number | null;
  pct_above_50dma: number | null;
  pct_above_200dma: number | null;
  new_52w_highs: number | null;
  new_52w_lows: number | null;
}

export interface FlowPoint {
  date: string;
  fii_net: number | null;
  dii_net: number | null;
}

export interface Flows {
  series: FlowPoint[];
  fii_10_session_net: number | null;
  dii_10_session_net: number | null;
}

export interface Vix {
  value: number;
  change: number | null;
  change_pct: number | null;
  percentile_250d: number | null;
  band: "low" | "moderate" | "elevated" | "high";
  verdict: string;
  advice: string;
}

export interface ActiveRow {
  symbol: string;
  name: string;
  ltp: number;
  change_pct: number | null;
  turnover_cr: number;
}

export interface BreakoutRow {
  symbol: string;
  name: string;
  ltp: number;
  change_pct: number | null;
  vol_ratio: number;
}

export interface MarketPulse {
  as_of: string;
  tiles: IndexTile[];
  breadth: Breadth | null;
  flows: Flows;
  vix: Vix | null;
  most_active: ActiveRow[];
  breakouts_52w: BreakoutRow[];
}

export interface ChartBar {
  time: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number;
  delivery_pct: number | null;
}

export interface MaPoint {
  time: string;
  value: number;
}

export interface Technicals {
  rsi_14: number | null;
  atr_pct: number | null;
  rel_volume_20d: number | null;
  dist_20dma_pct: number | null;
  dist_50dma_pct: number | null;
  dist_200dma_pct: number | null;
}

export interface ChartArtifact {
  symbol: string;
  name: string;
  kind: "stock" | "index";
  as_of: string | null;
  bars: ChartBar[];
  ma: Partial<Record<"sma_20" | "sma_50" | "sma_200", MaPoint[]>>;
  technicals: Technicals | null;
}

export interface FundamentalsQuarter {
  label: string;
  revenue_cr: number | null;
  revenue_qoq_pct: number | null;
  net_income_cr: number | null;
  net_income_qoq_pct: number | null;
}

export interface FundamentalsData {
  symbol: string;
  quarters: FundamentalsQuarter[];
}

export type PatternCode = "vcp" | "ipo_base" | "high_52w_breakout" | "near_pivot";
export type BreakoutStage = "forming" | "confirmed" | "extended";

export interface PatternMatch {
  code: PatternCode;
  stage: BreakoutStage;
  confidence: number;
  pivot_price: number | null;
  stop_suggestion: number | null;
  target_suggestion: number | null;
  base_start_date: string | null;
  breakout_date: string | null;
}

export interface ScreenerRow {
  symbol: string;
  name: string;
  ltp: number;
  change_pct: number | null;
  volume: number;
  patterns: PatternMatch[];
}

export type AlertKind = "price_above" | "price_below";

export interface WatchlistAlert {
  id: number;
  kind: AlertKind;
  threshold: number;
  enabled: boolean;
  triggered_at: string | null;
  triggered_price: number | null;
}

export interface WatchlistItem {
  id: number;
  symbol: string;
  name: string;
  entry_price: number | null;
  added_at: string;
  alerts: WatchlistAlert[];
  ltp: number | null;
  change_pct: number | null;
}

export interface ScreenerData {
  as_of: string;
  facets: {
    patterns: Partial<Record<PatternCode, number>>;
    stages: Partial<Record<BreakoutStage, number>>;
  };
  rows: ScreenerRow[];
}
