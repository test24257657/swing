/**
 * TradingView Scanner API helper
 * Queries live prices & metrics for Indian equities in 1 single bulk POST request.
 */

export interface TVQuote {
  symbol: string;
  close: number;
  change: number;
  changePct: number;
  volume: number;
  high: number;
  low: number;
}

export async function fetchTVQuotes(symbols: string[]): Promise<Map<string, TVQuote>> {
  const result = new Map<string, TVQuote>();
  if (!symbols.length) return result;

  const tvTickers = symbols.map((s) => `NSE:${s}`);

  try {
    const payload = {
      symbols: {
        tickers: tvTickers,
      },
      columns: [
        "close",
        "change",
        "change_abs",
        "volume",
        "high",
        "low",
      ],
    };

    const res = await fetch("https://scanner.tradingview.com/india/scan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
      body: JSON.stringify(payload),
      next: { revalidate: 30 }, // cache 30s
    });

    if (!res.ok) {
      return result;
    }

    const data = await res.json();
    if (data?.data && Array.isArray(data.data)) {
      for (const row of data.data) {
        const fullTicker: string = row.s || "";
        const sym = fullTicker.replace("NSE:", "").replace("BSE:", "");
        const [close, changePct, changeAbs, volume, high, low] = row.d || [];
        result.set(sym, {
          symbol: sym,
          close: Number(close || 0),
          change: Number(changeAbs || 0),
          changePct: Number(changePct || 0),
          volume: Number(volume || 0),
          high: Number(high || 0),
          low: Number(low || 0),
        });
      }
    }
  } catch (err) {
    console.warn("TV Scanner error:", err);
  }

  return result;
}
