import type { Metadata } from "next";

import { screenMetadata } from "@/lib/seo";

import { ChartClient } from "./chart-client";

type Params = Promise<{ symbol: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { symbol } = await params;
  const name = decodeURIComponent(symbol).replace(/_/g, " ");
  return screenMetadata({
    title: `${name} chart`,
    description: `Price chart for ${name} — candlesticks, volume and 20/50/200-day moving averages.`,
    path: `/chart/${symbol}`,
    noindex: true, // behind auth, one of a rotating set of instruments
  });
}

export default async function ChartPage({ params }: { params: Params }) {
  const { symbol } = await params;
  return <ChartClient slug={symbol} />;
}
