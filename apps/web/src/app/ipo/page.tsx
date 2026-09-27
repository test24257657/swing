import { screenMetadata } from "@/lib/seo";

import { IpoClient } from "./ipo-client";

export const metadata = screenMetadata({
  title: "IPOs",
  description:
    "Every NSE IPO listed in the last year with its post-listing chart: issue price, listing-day pop, gain since IPO and since listing, and first-base breakouts.",
  path: "/ipo",
});

export default function IpoPage() {
  return <IpoClient />;
}
