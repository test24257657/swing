"use client";

import { LogOut } from "lucide-react";
import { useEffect, useState } from "react";

import { useMarketPulse } from "@/lib/api/market-hooks";
import { getEmail, logout } from "@/lib/auth";
import { istStamp } from "@/lib/format";

import { MarketStatusPill } from "./market-status-pill";
import { SearchOverlay } from "./search-overlay";

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
    <header className="sticky top-0 z-30 flex h-[var(--shell-topbar-h)] items-center gap-2 border-b border-[var(--color-border)] bg-[rgba(255,255,255,0.94)] px-3 backdrop-blur-sm sm:gap-4 sm:px-6">
      <SearchOverlay />

      <MarketStatusPill />

      <span
        className={`hidden truncate font-mono text-[11px] sm:block ${stale ? "text-stale-text" : "text-[var(--color-text-muted)]"}`}
      >
        {asOf ? `data as of ${istStamp(asOf)}` : "no artifacts yet"}
      </span>

      <div className="ml-auto flex items-center gap-2">
        {email && (
          <span className="hidden max-w-[180px] truncate text-[11px] text-text-muted sm:inline" title={email}>
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
          className="flex h-10 w-10 items-center justify-center rounded-md text-text-muted hover:bg-surface-2 hover:text-down-text"
        >
          <LogOut size={14} />
        </button>
      </div>
    </header>
  );
}
