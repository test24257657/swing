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
  period_end: string;
  revenue_cr: number | null;
  revenue_qoq_pct: number | null;
  net_income_cr: number | null;
  net_income_qoq_pct: number | null;
  eps: number | null;
}

export interface FilingVerifyCheck {
  label: string;
  yfinance: number | null;
  nse_filing: number | null;
  diff_pct: number | null;
  divergent: boolean;
}

export interface FilingVerification {
  quarter_label: string;
  filed_at: string;
  filing_url: string;
  checks: FilingVerifyCheck[];
  divergence_count: number;
}

export interface FundamentalsData {
  symbol: string;
  quarters: FundamentalsQuarter[];
  verification: FilingVerification | null;
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

export interface SectorConstituent {
  symbol: string;
  name: string;
  ltp: number;
  change_pct: number | null;
}

export interface RrgPoint {
  x: number;
  y: number;
}

export interface SectorRow {
  name: string;
  slug: string;
  rank: number | null;
  rank_delta: number | null;
  return_1m: number | null;
  return_3m: number | null;
  rs_tail: RrgPoint[];
  stock_count: number;
  advancers: number;
  constituents: SectorConstituent[];
}

export interface SectorsData {
  as_of: string;
  benchmark: string;
  sectors: SectorRow[];
}

export interface IndexRow {
  symbol: string;
  slug: string;
  category: "broad" | "sectoral";
  value: number;
  change: number | null;
  change_pct: number | null;
}

export interface IndicesData {
  as_of: string | null;
  indices: IndexRow[];
}

export type NewsImpact = "very_positive" | "positive" | "neutral" | "negative" | "very_negative";

export interface NewsItem {
  symbol: string;
  name: string;
  date: string;
  time: string;
  category: string;
  headline: string;
  filing_url: string | null;
  impact: NewsImpact;
  summary: string;
}

export interface NewsData {
  as_of: string;
  items: NewsItem[];
  counts: Record<NewsImpact, number>;
}

export interface DealRow {
  date: string;
  symbol: string;
  client: string;
  side: "BUY" | "SELL";
  kind: "Bulk" | "Block";
  qty: number;
  price: number;
  value: number;
  repeat: boolean;
  repeat_count: number;
}

export interface DealSummary {
  deals_today: number;
  bulk_count: number;
  block_count: number;
  total_value: number;
  repeat_count: number;
}

export interface ParticipantOiPart {
  who: "FII" | "DII" | "Pro" | "Client";
  pct: number;
  side: "net long" | "net short";
}

export interface ParticipantOiSection {
  name: string;
  parts: ParticipantOiPart[];
  note: string;
}

export interface ParticipantOi {
  as_of: string;
  sections: ParticipantOiSection[];
  fii_index_futures_ratio: { date: string; ratio: number }[];
}

export interface InstitutionalData {
  as_of: string;
  deal_summary: DealSummary;
  deals: DealRow[];
  participant_oi: ParticipantOi | null;
}

export interface FnoBuildup {
  label: "long_buildup" | "short_buildup" | "short_covering" | "long_unwinding" | "neutral";
  note: string;
  expiry: string;
  price_chg_pct: number;
  oi_chg_pct: number;
  open_interest: number;
  close: number;
}

export interface OptionChainRow {
  strike: number;
  call_oi: number;
  call_oi_chg: number;
  put_oi: number;
  put_oi_chg: number;
}

export interface OptionChain {
  expiry: string;
  underlying_value: number | null;
  rows: OptionChainRow[];
  pcr: number | null;
  total_call_oi: number;
  total_put_oi: number;
  max_call_oi_strike: number;
  max_put_oi_strike: number;
}

export interface FnoData {
  symbol: string;
  buildup: FnoBuildup | null;
  option_chain: OptionChain | null;
}

export interface DepthLevel {
  price: number;
  quantity: number;
}

export interface DepthData {
  bid: DepthLevel[];
  ask: DepthLevel[];
  total_buy_qty: number | null;
  total_sell_qty: number | null;
  vwap: number | null;
}
