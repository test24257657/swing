"use client";

import { useEffect, useState } from "react";

import { useMarketStatus } from "@/lib/api/market-hooks";
import type { MarketStatus } from "@/lib/api/market-types";

const VIEW: Record<MarketStatus["status"], { fg: string; bg: string; bd: string; dot: string }> = {
  trading: { fg: "var(--color-up-text)", bg: "rgba(22,163,74,0.10)", bd: "rgba(22,163,74,0.28)", dot: "var(--color-up)" },
  preopen: { fg: "var(--color-stale-text)", bg: "rgba(217,119,6,0.12)", bd: "rgba(217,119,6,0.32)", dot: "var(--color-stale)" },
  closed: { fg: "var(--color-down-text)", bg: "rgba(220,38,38,0.10)", bd: "rgba(220,38,38,0.28)", dot: "var(--color-down)" },
  holiday: { fg: "var(--color-stale-text)", bg: "rgba(217,119,6,0.12)", bd: "rgba(217,119,6,0.32)", dot: "var(--color-stale)" },
};

function hms(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function MarketStatusPill() {
  const { data } = useMarketStatus();
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (data?.seconds_to_next == null) {
      setRemaining(null);
      return;
    }
    setRemaining(data.seconds_to_next);
    const id = setInterval(() => setRemaining((r) => (r == null ? null : Math.max(0, r - 1))), 1000);
    return () => clearInterval(id);
  }, [data?.seconds_to_next, data?.as_of]);

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
    <div className="flex h-[26px] items-center gap-2 rounded-full border px-2.5" style={{ background: v.bg, borderColor: v.bd }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: v.dot }} />
      <span className="text-[11px] font-medium whitespace-nowrap" style={{ color: v.fg }}>
        {data.label}
      </span>
      {remaining != null && remaining > 0 && (
        <>
          <span className="h-3 w-px bg-border-strong" />
          <span className="tnum font-mono text-[11px] text-text-secondary whitespace-nowrap">
            {hms(remaining)}
          </span>
        </>
      )}
    </div>
  );
}
