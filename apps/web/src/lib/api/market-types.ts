/** Phase 6 — market-context response shapes (mirror app/services/*). */

export interface MarketStatus {
  status: "trading" | "preopen" | "closed" | "holiday";
  label: string;
  note: string;
  as_of: string;
  next_session: string;
  seconds_to_next: number | null;
}

export interface IndexTile {
  symbol: string;
  name: string;
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
  new_52w_highs: number;
  new_52w_lows: number;
}

export interface FlowPoint {
  date: string;
  fii_net: number | null;
  dii_net: number | null;
}

export interface Vix {
  value: number;
  change: number | null;
  change_pct: number | null;
  percentile_250d: number | null;
  verdict: string;
  advice: string;
}

export interface MarketPulse {
  tiles: IndexTile[];
  breadth: Breadth | null;
  flows: { series: FlowPoint[]; fii_10_session_net: number | null; dii_10_session_net: number | null };
  vix: Vix | null;
}

export interface HeatmapCell {
  slug: string;
  name: string;
  return_tf: number | null;
  constituents: number;
  advancers: number | null;
}
export interface RankedSector {
  rank: number;
  slug: string;
  name: string;
  return_tf: number | null;
  return_3m: number | null;
  rank_change: number | null;
}
export interface RrgPoint {
  slug: string;
  name: string;
  x: number;
  y: number;
  tail: [number, number][];
}
export interface SectorRotation {
  tf: string;
  as_of: string | null;
  sectors: HeatmapCell[];
  ranked: RankedSector[];
  rrg: RrgPoint[];
}

export interface IndexRow {
  symbol: string;
  name: string;
  category: string;
  value: number;
  change: number | null;
  change_pct: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  prev_close: number | null;
  ret_1w: number | null;
  ret_1m: number | null;
  ret_3m: number | null;
  dist_52w_high_pct: number | null;
  spark: number[];
}
export interface IndicesList {
  as_of: string | null;
  count: number;
  indices: IndexRow[];
}

export interface IndexBarPoint {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
}
export interface IndexDetail {
  symbol: string;
  name: string;
  category: string;
  head: {
    close: number;
    change: number | null;
    change_pct: number | null;
    open: number | null;
    high: number | null;
    low: number | null;
    prev_close: number | null;
    date: string;
  } | null;
  bars: IndexBarPoint[];
}

export interface Constituent {
  symbol: string;
  name: string;
  ltp: number | null;
  change_pct: number | null;
  weight: number;
  points: number | null;
}
export interface IndexConstituents {
  symbol: string;
  name: string;
  as_of?: string | null;
  constituents: Constituent[];
  weights_estimated?: boolean;
  note?: string;
}

export interface CompareSeries {
  symbol: string;
  name: string;
  normalized: number[];
  return_pct: number;
}
export interface IndexCompare {
  tf: string;
  dates: string[];
  series: CompareSeries[];
}

export interface ChartBar {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
export interface MaPoint {
  time: string;
  value: number;
}
export interface SrLevel {
  price: number;
  kind: "support" | "resistance";
  touches: number;
  strength: number;
}
export interface ChartPattern {
  code: string;
  stage: string;
  confidence: number;
  pivot: number | null;
  stop: number | null;
  target: number | null;
  breakout_date: string | null;
  base_start_date: string | null;
  meta: Record<string, unknown>;
}
export interface SymbolChart {
  symbol: string;
  name: string;
  tf: string;
  bars: ChartBar[];
  mas: { sma_20: MaPoint[]; sma_50: MaPoint[]; sma_200: MaPoint[] };
  sr: SrLevel[];
  patterns: ChartPattern[];
  as_of?: string;
}
