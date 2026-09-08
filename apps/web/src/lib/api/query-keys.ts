/** Central query-key registry so invalidation stays consistent across the app. */
export const qk = {
  health: ["health"] as const,
  ingestion: ["meta", "ingestion"] as const,
  sectors: ["sectors"] as const,
  symbols: (params: Record<string, unknown> = {}) => ["symbols", params] as const,
  symbol: (nseSymbol: string) => ["symbol", nseSymbol] as const,
  screener: (params: Record<string, unknown> = {}) => ["screener", params] as const,
  savedScreens: ["screener", "saved"] as const,
};
