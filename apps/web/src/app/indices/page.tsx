import { Suspense } from "react";

import { Skeleton } from "@/components/ui";
import { screenMetadata } from "@/lib/seo";

import { IndicesClient } from "./indices-client";

export const metadata = screenMetadata({
  title: "Indices",
  description:
    "NSE indices — broad, sectoral, thematic and strategy — with OHLC, 1W/1M/3M returns, distance from 52-week high, a constituents breakdown and a comparison overlay.",
  path: "/indices",
});

export default function IndicesPage() {
  return (
    <Suspense fallback={<div className="px-6 pt-6"><Skeleton className="h-96 w-full" /></div>}>
      <IndicesClient />
    </Suspense>
  );
}
