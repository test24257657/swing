import { screenMetadata } from "@/lib/seo";

import { PulseClient } from "./pulse-client";

export const metadata = screenMetadata({
  title: "Market Pulse",
  description:
    "Post-close read on the NSE: market breadth, FII/DII flows, India VIX regime, and the day's most-active and 52-week-high-breakout names.",
  path: "/pulse",
});

export default function PulsePage() {
  return <PulseClient />;
}
