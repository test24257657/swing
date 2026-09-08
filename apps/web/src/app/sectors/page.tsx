import { Suspense } from "react";

import { Skeleton } from "@/components/ui";
import { screenMetadata } from "@/lib/seo";

import { SectorsClient } from "./sectors-client";

export const metadata = screenMetadata({
  title: "Sector Rotation",
  description:
    "Which NSE sectors capital is rotating into and out of — a heatmap, a momentum ranking with rank-change arrows, and a relative rotation graph vs NIFTY 500.",
  path: "/sectors",
});

export default function SectorsPage() {
  return (
    <Suspense fallback={<div className="px-6 pt-6"><Skeleton className="h-96 w-full" /></div>}>
      <SectorsClient />
    </Suspense>
  );
}
