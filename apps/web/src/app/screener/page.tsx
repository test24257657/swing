import { screenMetadata } from "@/lib/seo";

import { ScreenerClient } from "./screener-client";

export const metadata = screenMetadata({
  title: "Screener",
  description:
    "Setup-pattern screener for NSE equities — VCP, IPO base, 52-week breakout and near-pivot matches, with live Forming/Confirmed/Extended breakout-stage counts.",
  path: "/screener",
});

export default function ScreenerPage() {
  return <ScreenerClient />;
}
