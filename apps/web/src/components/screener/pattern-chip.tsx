import { Tooltip } from "@/components/ui";
import { cn } from "@/lib/cn";

export const PATTERN_META: Record<
  string,
  { label: string; short: string; tone: string; tip: string }
> = {
  vcp: {
    label: "VCP",
    short: "VCP",
    tone: "text-accent bg-[var(--color-accent-tint-2)] border-[var(--color-accent-border)]",
    tip: "Volatility Contraction Pattern — successive shallower pullbacks, volume drying into the pivot.",
  },
  ipo_base: {
    label: "IPO Base",
    short: "IPO",
    tone: "text-[var(--color-info-text)] bg-[rgba(37,99,235,0.12)] border-[rgba(37,99,235,0.35)]",
    tip: "First base after listing — a 4+ week range with the post-listing high as resistance.",
  },
  high_52w_breakout: {
    label: "52W Breakout",
    short: "52WH",
    tone: "text-up-text bg-[rgba(22,163,74,0.12)] border-[rgba(22,163,74,0.32)]",
    tip: "Close at/above the trailing 52-week high, confirmed by above-average volume.",
  },
  near_pivot: {
    label: "Near Pivot",
    short: "Pivot",
    tone: "text-stale-text bg-[rgba(217,119,6,0.12)] border-[rgba(217,119,6,0.32)]",
    tip: "Within ~3% of a tested resistance (the pivot) — the buy trigger, not yet crossed.",
  },
};

export function PatternChip({ code, size = "sm" }: { code: string; size?: "sm" | "md" }) {
  const meta = PATTERN_META[code];
  if (!meta) return <span className="text-[11px] text-text-faint">{code}</span>;
  return (
    <Tooltip content={meta.tip}>
      <span
        className={cn(
          "inline-flex items-center rounded border font-medium",
          size === "sm" ? "px-1.5 py-px text-[11px]" : "px-2 py-0.5 text-[11px]",
          meta.tone,
        )}
      >
        {size === "sm" ? meta.short : meta.label}
      </span>
    </Tooltip>
  );
}
