import { screenMetadata } from "@/lib/seo";

import { ScanClient } from "./scan-client";

export const metadata = screenMetadata({
  title: "Daily Scan",
  description:
    "Should you be buying today, and what: NSE market regime light, relative-strength leaders, setups ready near their pivot, delivery spikes, pocket pivots and sector leaders.",
  path: "/scan",
});

export default function ScanPage() {
  return <ScanClient />;
}
