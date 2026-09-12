"use client";

import { type ReactNode } from "react";

import { cn } from "@/lib/cn";
import { safeGridCols } from "@/lib/grid";

/**
 * Grid-based data table. The design's tables are CSS grids (not <table>) so column
 * widths can be expressed as `fr` units and rows can carry hover action strips.
 * `template` is any grid-template-columns value.
 *
 * TanStack Virtual gets layered on top in Phase 1 for the full screener result set;
 * this component stays the row/header primitive.
 */

interface TableProps {
  template: string;
  header: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function Table({ template, header, children, footer, className }: TableProps) {
  return (
    <div className={cn("overflow-hidden rounded-lg border border-[var(--color-border)] bg-surface", className)}>
      <div
        className="sticky top-[var(--shell-topbar-h)] z-20 grid gap-2 border-b border-[var(--color-border)] bg-surface-2 px-3 py-2.5 text-[11px] text-[var(--color-text-secondary)]"
        style={{ gridTemplateColumns: safeGridCols(template) }}
      >
        {header}
      </div>
      <div>{children}</div>
      {footer && (
        <div className="flex items-center justify-between border-t border-[var(--color-border)] px-3 py-2.5 font-mono text-[11px] text-[var(--color-text-faint)]">
          {footer}
        </div>
      )}
    </div>
  );
}

interface RowProps {
  template: string;
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}

export function Row({ template, children, onClick, className }: RowProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "tnum grid items-center gap-2 border-b border-[var(--color-border)] px-3 py-2 last:border-0 hover:bg-surface-2",
        onClick && "cursor-pointer",
        className,
      )}
      style={{ gridTemplateColumns: safeGridCols(template) }}
    >
      {children}
    </div>
  );
}
