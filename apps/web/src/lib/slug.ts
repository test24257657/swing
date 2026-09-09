/** Symbol → URL slug. Must match `jobs/charts.py::slug` and the API's chart lookup.
 *  "NIFTY 50" → "NIFTY_50" · "NIFTY OIL & GAS" → "NIFTY_OIL_GAS" · "TATAMOTORS" → "TATAMOTORS" */
export function toSlug(symbol: string): string {
  return symbol
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
