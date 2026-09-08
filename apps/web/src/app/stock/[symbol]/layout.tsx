import { type ReactNode } from "react";
import type { Metadata } from "next";

import { screenMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ symbol: string }>;
}): Promise<Metadata> {
  const { symbol } = await params;
  const s = symbol.toUpperCase();
  return screenMetadata({
    title: `${s} — technicals, delivery & F&O`,
    description: `${s} on the NSE: price chart with moving averages and support/resistance, RSI/ATR/52-week technicals, delivery trend, F&O positioning, quarterly fundamentals and a composite swing score.`,
    path: `/stock/${s}`,
  });
}

export default function StockLayout({ children }: { children: ReactNode }) {
  return children;
}
