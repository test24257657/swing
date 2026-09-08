"use client";

import { Search } from "lucide-react";

import { useIngestionStatus } from "@/lib/api/hooks";
import { istStamp } from "@/lib/format";

import { MarketStatusPill } from "./market-status-pill";

/** 56px sticky top bar: ⌘K search, market-status pill, data-freshness stamp, avatar. */
export function TopBar() {
  const { data } = useIngestionStatus();
  const bhav = data?.jobs.find((j) => j.job === "ingest_bhavcopy");
  const asOf = bhav?.finished_at ?? null;

  return (
    <header className="sticky top-0 z-30 flex h-[var(--shell-topbar-h)] items-center gap-4 border-b border-[var(--color-border)] bg-[rgba(255,255,255,0.94)] px-6 backdrop-blur-sm">
      <button className="flex h-[34px] w-[340px] items-center gap-2.5 rounded-md border border-[var(--color-border)] bg-surface px-3 text-[13px] text-[var(--color-text-muted)] hover:border-[var(--color-accent)]">
        <Search size={13} />
        <span>Search symbol, sector or screen…</span>
        <span className="ml-auto flex gap-1">
          <kbd className="rounded-sm border border-[var(--color-border)] bg-surface-2 px-1.5 font-mono text-[11px] text-[var(--color-text-secondary)]">
            ⌘
          </kbd>
          <kbd className="rounded-sm border border-[var(--color-border)] bg-surface-2 px-1.5 font-mono text-[11px] text-[var(--color-text-secondary)]">
            K
          </kbd>
        </span>
      </button>

      <MarketStatusPill />

      <span className="font-mono text-[11px] text-[var(--color-text-muted)] whitespace-nowrap">
        {asOf ? `data as of ${istStamp(asOf)}` : "no ingestion yet"}
      </span>

      <div className="ml-auto flex h-7 w-7 items-center justify-center rounded-full border border-[var(--color-border)] bg-surface-2 text-[11px] font-semibold text-[var(--color-text-secondary)]">
        RK
      </div>
    </header>
  );
}
