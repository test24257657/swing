"use client";

import { type ReactNode, useId, useState } from "react";

import { cn } from "@/lib/cn";

interface Props {
  content: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Lightweight hover/focus tooltip. The design leans on these heavily to define every
 * metric ("Wilder 14-period RSI on daily closes", etc.) — the trigger gets a dotted
 * underline and a help cursor.
 */
export function Tooltip({ content, children, className }: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <span
      className={cn("relative inline-flex cursor-help", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      tabIndex={0}
      aria-describedby={open ? id : undefined}
    >
      <span className="border-b border-dotted border-[var(--color-text-faint)]">{children}</span>
      {open && (
        <span
          role="tooltip"
          id={id}
          className="absolute bottom-[calc(100%+6px)] left-0 z-50 w-56 rounded-md border border-[var(--color-border)] bg-surface p-2 text-[11px] leading-relaxed text-[var(--color-text-secondary)] shadow-lg"
        >
          {content}
        </span>
      )}
    </span>
  );
}
