import type { Metadata } from "next";

import { screenMetadata } from "@/lib/seo";

import { ChartClient } from "./chart-client";

export function generateMetadata({ params }: { params: { symbol: string } }): Metadata {
  const name = decodeURIComponent(params.symbol).replace(/_/g, " ");
  return screenMetadata({
    title: `${name} chart`,
    description: `Price chart for ${name} — candlesticks, volume and 20/50/200-day moving averages.`,
    path: `/chart/${params.symbol}`,
    noindex: true, // behind auth, one of a rotating set of instruments
  });
}

export default function ChartPage({ params }: { params: { symbol: string } }) {
  return <ChartClient slug={params.symbol} />;
}
