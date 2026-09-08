"use client";

import { useMarketStatus } from "@/lib/api/market-hooks";
import type { MarketStatus } from "@/lib/api/market-types";

const VIEW: Record<MarketStatus["status"], { fg: string; bg: string; bd: string; dot: string }> = {
  trading: { fg: "var(--color-up-text)", bg: "rgba(22,163,74,0.10)", bd: "rgba(22,163,74,0.28)", dot: "var(--color-up)" },
  preopen: { fg: "var(--color-stale-text)", bg: "rgba(217,119,6,0.12)", bd: "rgba(217,119,6,0.32)", dot: "var(--color-stale)" },
  closed: { fg: "var(--color-down-text)", bg: "rgba(220,38,38,0.10)", bd: "rgba(220,38,38,0.28)", dot: "var(--color-down)" },
  holiday: { fg: "var(--color-stale-text)", bg: "rgba(217,119,6,0.12)", bd: "rgba(217,119,6,0.32)", dot: "var(--color-stale)" },
};

export function MarketStatusPill() {
  const { data } = useMarketStatus();

  if (!data) {
    return (
      <div className="flex h-[26px] items-center gap-2 rounded-full border border-border bg-surface-2 px-2.5">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-text-faint)]" />
        <span className="text-[11px] text-text-muted">status…</span>
      </div>
    );
  }

  const v = VIEW[data.status];

  return (
    <div
      className="flex h-[26px] items-center gap-2 rounded-full border px-2.5"
      style={{ background: v.bg, borderColor: v.bd }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: v.dot }} />
      <span className="text-[11px] font-medium whitespace-nowrap" style={{ color: v.fg }}>
        {data.label}
      </span>
    </div>
  );
}
