"use client";

import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { useSymbols } from "@/lib/api/market-hooks";
import { cn } from "@/lib/cn";
import { pct, price } from "@/lib/format";
import { toSlug } from "@/lib/slug";

import { NAV } from "./nav";

const MAX_RESULTS = 8;

/** Global search — ⌘K/Ctrl+K or the search button opens it from anywhere in the
 * shell. Symbols are fetched once (useSymbols, GET /symbols) and matched
 * client-side; screens match against the same nav list the sidebar uses, so
 * "search symbol, sector or screen" is a real promise, not just placeholder text. */
export function SearchOverlay() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const symbolsQ = useSymbols();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      // focus after the overlay actually mounts
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const screenMatches = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.trim().toLowerCase();
    return NAV.filter((n) => n.label.toLowerCase().includes(q)).slice(0, 3);
  }, [query]);

  const symbolMatches = useMemo(() => {
    const rows = symbolsQ.data?.data ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const starts = rows.filter((r) => r.symbol.toLowerCase().startsWith(q));
    const contains = rows.filter(
      (r) => !r.symbol.toLowerCase().startsWith(q) && (r.symbol.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)),
    );
    return [...starts, ...contains].slice(0, MAX_RESULTS);
  }, [query, symbolsQ.data]);

  const items = useMemo(
    () => [
      ...screenMatches.map((s) => ({ kind: "screen" as const, href: s.href, label: s.label })),
      ...symbolMatches.map((s) => ({ kind: "symbol" as const, href: `/chart/${toSlug(s.symbol)}`, symbol: s })),
    ],
    [screenMatches, symbolMatches],
  );

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  if (!open) {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          className="hidden h-[34px] items-center gap-2.5 rounded-md border border-[var(--color-border)] bg-surface px-3 text-[13px] text-[var(--color-text-muted)] hover:border-[var(--color-accent)] md:flex md:w-[220px] lg:w-[340px]"
        >
          <Search size={13} />
          <span className="truncate">Search symbol, sector or screen…</span>
          <span className="ml-auto hidden gap-1 lg:flex">
            <kbd className="rounded-sm border border-[var(--color-border)] bg-surface-2 px-1.5 font-mono text-[11px] text-[var(--color-text-secondary)]">
              ⌘
            </kbd>
            <kbd className="rounded-sm border border-[var(--color-border)] bg-surface-2 px-1.5 font-mono text-[11px] text-[var(--color-text-secondary)]">
              K
            </kbd>
          </span>
        </button>
        <button
          onClick={() => setOpen(true)}
          aria-label="Search"
          className="flex h-10 w-10 flex-none items-center justify-center rounded-md border border-[var(--color-border)] bg-surface text-[var(--color-text-muted)] md:hidden"
        >
          <Search size={14} />
        </button>
      </>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center p-4 pt-[10vh]" onClick={() => setOpen(false)}>
      <div
        className="w-full max-w-lg overflow-hidden rounded-lg border border-border bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
          <Search size={15} className="text-text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIndex((i) => Math.min(i + 1, items.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIndex((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter" && items[activeIndex]) {
                go(items[activeIndex].href);
              }
            }}
            placeholder="Search symbol, sector or screen…"
            className="w-full bg-transparent text-[14px] outline-none placeholder:text-text-muted"
          />
          <button onClick={() => setOpen(false)} aria-label="Close" className="text-text-muted hover:text-text">
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto py-1.5">
          {query.trim() === "" ? (
            <p className="px-4 py-8 text-center text-[12px] text-text-muted">Type a symbol, company name, or screen…</p>
          ) : items.length === 0 ? (
            <p className="px-4 py-8 text-center text-[12px] text-text-muted">No matches for &quot;{query}&quot;</p>
          ) : (
            items.map((item, i) => (
              <button
                key={item.href + i}
                onClick={() => go(item.href)}
                onMouseEnter={() => setActiveIndex(i)}
                className={cn(
                  "flex w-full items-center gap-2.5 px-4 py-2 text-left",
                  i === activeIndex ? "bg-surface-2" : "hover:bg-surface-2",
                )}
              >
                {item.kind === "screen" ? (
                  <>
                    <span className="rounded bg-[var(--color-accent-tint)] px-1.5 py-0.5 text-[10px] font-medium text-accent">
                      screen
                    </span>
                    <span className="text-[13px] font-medium">{item.label}</span>
                  </>
                ) : (
                  <>
                    <span className="min-w-0 flex-1">
                      <span className="text-[13px] font-medium">{item.symbol.symbol}</span>
                      <span className="ml-2 truncate text-[11px] text-text-muted">{item.symbol.name}</span>
                    </span>
                    <span className="tnum text-[12px] text-text-secondary">{price(item.symbol.ltp)}</span>
                    <span
                      className={cn(
                        "tnum w-14 text-right text-[11px]",
                        item.symbol.change_pct == null
                          ? "text-text-muted"
                          : item.symbol.change_pct >= 0
                            ? "text-up-text"
                            : "text-down-text",
                      )}
                    >
                      {item.symbol.change_pct == null ? "—" : pct(item.symbol.change_pct)}
                    </span>
                  </>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
