import { screenMetadata } from "@/lib/seo";

import { IndicesClient } from "./indices-client";

export const metadata = screenMetadata({
  title: "Indices",
  description:
    "Every broad-market and sector NSE index in one place — list and chart views, constituents, and a comparison mode to overlay several indices at once.",
  path: "/indices",
});

export default function IndicesPage() {
  return <IndicesClient />;
}
