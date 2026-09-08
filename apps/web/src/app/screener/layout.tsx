import { type ReactNode } from "react";

import { screenMetadata } from "@/lib/seo";

export const metadata = screenMetadata({
  title: "Screener",
  description:
    "Screen NSE equities for swing setups — filter by chart pattern, breakout stage, RSI, moving averages, distance from 52-week high, delivery percentage and relative strength, ranked by a composite score.",
  path: "/screener",
});

export default function ScreenerLayout({ children }: { children: ReactNode }) {
  return children;
}
