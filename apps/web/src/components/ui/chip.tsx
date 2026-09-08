import { type HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

type Tone = "neutral" | "accent" | "up" | "down" | "stale" | "info";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-[var(--color-text-secondary)] border-[var(--color-border)]",
  accent: "bg-[var(--color-accent-tint-2)] text-accent border-[var(--color-accent-border)]",
  up: "bg-[rgba(22,163,74,0.12)] text-up-text border-[rgba(22,163,74,0.32)]",
  down: "bg-[rgba(220,38,38,0.1)] text-down-text border-[rgba(220,38,38,0.28)]",
  stale: "bg-[rgba(217,119,6,0.12)] text-stale-text border-[rgba(217,119,6,0.32)]",
  info: "bg-[rgba(37,99,235,0.1)] text-[var(--color-info-text)] border-[rgba(37,99,235,0.25)]",
};

interface Props extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  pill?: boolean;
}

export function Chip({ tone = "neutral", pill = false, className, ...props }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        pill ? "rounded-full" : "rounded",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
