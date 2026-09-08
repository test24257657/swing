"use client";

import { cn } from "@/lib/cn";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
  className?: string;
}

/** The pill toggle used all over the design for timeframe / view / stage switches. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  className,
}: Props<T>) {
  return (
    <div
      className={cn(
        "inline-flex gap-0.5 rounded-md border border-[var(--color-border)] bg-surface p-0.5",
        className,
      )}
      role="tablist"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded font-medium transition-colors",
              size === "sm" ? "px-2.5 py-1 text-[11px]" : "px-3.5 py-1.5 text-[13px]",
              active
                ? "bg-[var(--color-accent-tint)] text-accent-hover"
                : "text-[var(--color-text-secondary)] hover:text-text",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
