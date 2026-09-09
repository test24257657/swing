"use client";

import { LogOut, Search } from "lucide-react";
import { useEffect, useState } from "react";

import { useMarketPulse } from "@/lib/api/market-hooks";
import { getEmail, logout } from "@/lib/auth";
import { istStamp } from "@/lib/format";

import { MarketStatusPill } from "./market-status-pill";

/** 56px sticky top bar: ⌘K search, market-status pill, data-freshness stamp, account. */
export function TopBar() {
  // freshness comes from the artifact meta — the same envelope every panel shows
  const { data } = useMarketPulse();
  const asOf = data?.meta.as_of ?? null;
  const stale = data?.meta.stale ?? false;

  // localStorage is client-only — read after mount to keep SSR and hydration identical
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => setEmail(getEmail()), []);
  const initials = email ? email.slice(0, 2).toUpperCase() : "··";

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

      <span
        className={`font-mono text-[11px] whitespace-nowrap ${stale ? "text-stale-text" : "text-[var(--color-text-muted)]"}`}
      >
        {asOf ? `data as of ${istStamp(asOf)}` : "no artifacts yet"}
      </span>

      <div className="ml-auto flex items-center gap-2">
        {email && (
          <span className="max-w-[180px] truncate text-[11px] text-text-muted" title={email}>
            {email}
          </span>
        )}
        <span
          className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--color-border)] bg-surface-2 text-[11px] font-semibold text-[var(--color-text-secondary)]"
          aria-hidden
        >
          {initials}
        </span>
        <button
          onClick={logout}
          title="Sign out"
          aria-label="Sign out"
          className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted hover:bg-surface-2 hover:text-down-text"
        >
          <LogOut size={14} />
        </button>
      </div>
    </header>
  );
}
