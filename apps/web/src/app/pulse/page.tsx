import { screenMetadata } from "@/lib/seo";

import { PulseClient } from "./pulse-client";

export const metadata = screenMetadata({
  title: "Market Pulse",
  description:
    "Your 2-minute NSE routine: market light (can I buy today?), setups ready near their breakout, AI top 5, sector leaders and pocket pivots — plus breadth, FII/DII flows and India VIX.",
  path: "/pulse",
});

export default function PulsePage() {
  return <PulseClient />;
}
