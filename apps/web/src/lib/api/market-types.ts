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
}

export interface MaPoint {
  time: string;
  value: number;
}

export interface ChartArtifact {
  symbol: string;
  name: string;
  kind: "stock" | "index";
  as_of: string | null;
  bars: ChartBar[];
  ma: Partial<Record<"sma_20" | "sma_50" | "sma_200", MaPoint[]>>;
}
