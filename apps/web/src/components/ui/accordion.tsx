"use client";

import { type ReactNode } from "react";

import { cn } from "@/lib/cn";

interface Props {
  title: ReactNode;
  summary?: ReactNode;
  count?: number;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

/** Collapsible refine group — matches the screener filter-rail accordions. */
export function Accordion({ title, summary, count, open, onToggle, children }: Props) {
  return (
    <div className="border-b border-[var(--color-border)]">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-surface"
      >
        <span className="w-2 text-[11px] text-[var(--color-text-faint)]">{open ? "▾" : "▸"}</span>
        <span
          className={cn(
            "text-[13px] font-medium",
            open ? "text-text" : "text-[var(--color-text-secondary)]",
          )}
        >
          {title}
        </span>
        {count != null && count > 0 && (
          <span className="tnum rounded-full bg-[var(--color-accent-tint-2)] px-1.5 py-px text-[11px] font-medium text-accent">
            {count}
          </span>
        )}
        {!open && summary && (
          <span className="ml-auto max-w-[120px] truncate text-[11px] text-[var(--color-text-faint)]">
            {summary}
          </span>
        )}
      </button>
      {open && <div className="flex flex-col gap-3 px-4 pb-4">{children}</div>}
    </div>
  );
}
