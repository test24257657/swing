import { Suspense } from "react";

import { Skeleton } from "@/components/ui";

import { ScreenerClient } from "./screener-client";

export default function ScreenerPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-stretch">
          <div className="w-[280px] flex-none border-r border-border bg-bg" />
          <div className="min-w-0 flex-1 px-6 pb-14 pt-6">
            <Skeleton className="mb-4 h-8 w-48" />
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-9" />
              ))}
            </div>
          </div>
        </div>
      }
    >
      <ScreenerClient />
    </Suspense>
  );
}
