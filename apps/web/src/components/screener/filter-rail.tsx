"use client";

import { Accordion, Button, Segmented } from "@/components/ui";
import { useSectors } from "@/lib/api/hooks";
import { cn } from "@/lib/cn";
import { type BreakoutStage, type PatternCode, useFilters } from "@/stores/filters";

const PATTERNS: { code: PatternCode; label: string; tip: string }[] = [
  { code: "vcp", label: "VCP", tip: "Volatility Contraction Pattern — successive shallower pullbacks, volume drying up into the pivot." },
  { code: "ipo_base", label: "IPO Base", tip: "First base after listing — a 4+ week range with the listing-day high as resistance." },
  { code: "high_52w_breakout", label: "52-Week High Breakout", tip: "Close above the trailing 52-week high, confirmed by above-average volume." },
  { code: "near_pivot", label: "Near Pivot Point", tip: "Within ~3% of the pattern pivot — the buy trigger, not yet crossed." },
];

const STAGES: { value: BreakoutStage; label: string }[] = [
  { value: "all", label: "All" },
  { value: "forming", label: "Forming" },
  { value: "confirmed", label: "Confirmed" },
  { value: "extended", label: "Extended" },
];

export function FilterRail() {
  const f = useFilters();
  const sectors = useSectors();

  if (f.railCollapsed) {
    return (
      <div className="flex w-10 flex-none flex-col items-center border-r border-[var(--color-border)] bg-bg py-4">
        <button
          onClick={f.toggleRail}
          className="text-[var(--color-text-muted)] hover:text-text"
          title="Show filters"
        >
          ▶
        </button>
      </div>
    );
  }

  return (
    <aside className="w-[280px] flex-none border-r border-[var(--color-border)] bg-bg">
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] p-4">
        <span className="text-[13px] font-semibold">Filters</span>
        <span className="tnum rounded-full bg-accent px-1.5 py-0.5 text-[11px] font-semibold text-white">
          {f.activeCount()}
        </span>
        <div className="ml-auto flex items-center gap-2.5 text-[11px]">
          <button onClick={f.reset} className="text-[var(--color-text-secondary)] hover:text-text">
            Reset
          </button>
          <span className="text-[var(--color-text-faint)]">|</span>
          <button onClick={f.toggleRail} className="text-[var(--color-text-muted)]">
            ◀
          </button>
        </div>
      </div>

      <div className="border-b border-[var(--color-border)] p-4">
        <div className="mb-2.5 flex items-center gap-2">
          <span className="text-[13px] font-semibold">Setup patterns</span>
          <span className="font-mono text-[11px] text-accent">▸ primary action</span>
        </div>
        <div className="flex flex-col gap-0.5">
          {PATTERNS.map((p) => {
            const on = f.patterns.includes(p.code);
            return (
              <button
                key={p.code}
                title={p.tip}
                onClick={() => f.togglePattern(p.code)}
                className={cn(
                  "flex items-center gap-2.5 rounded-r-md border-l-2 px-2.5 py-2 text-left hover:bg-surface-2",
                  on ? "border-l-[var(--color-accent)] bg-[var(--color-accent-tint-2)]" : "border-l-transparent",
                )}
              >
                <span
                  className={cn(
                    "flex h-3.5 w-3.5 flex-none items-center justify-center rounded-sm border text-[10px] leading-none",
                    on
                      ? "border-[var(--color-accent)] bg-[var(--color-accent-tint)]"
                      : "border-[var(--color-border-strong)]",
                  )}
                >
                  {on ? "✓" : ""}
                </span>
                <span
                  className={cn(
                    "text-[13px] font-medium",
                    on ? "text-text" : "text-[var(--color-text-secondary)]",
                  )}
                >
                  {p.label}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 rounded-lg border border-[rgba(139,92,246,0.28)] bg-surface p-3">
          <div className="mb-2 text-[11px] font-semibold tracking-wide">BREAKOUT STAGE</div>
          <Segmented
            options={STAGES}
            value={f.stage}
            onChange={f.setStage}
            size="sm"
            className="w-full [&>button]:flex-1"
          />
        </div>
      </div>

      <Accordion
        title="Sector"
        summary={f.sector ?? "all"}
        count={f.sector ? 1 : 0}
        open={f.openGroup === "sector"}
        onToggle={() => f.setOpenGroup("sector")}
      >
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => f.setSector(null)}
            className={cn(
              "rounded-md border px-2 py-1 text-[11px] font-medium",
              !f.sector
                ? "border-[var(--color-accent-border)] bg-[var(--color-accent-tint-2)] text-text"
                : "border-[var(--color-border)] bg-surface-2 text-[var(--color-text-secondary)]",
            )}
          >
            All sectors
          </button>
          {sectors.data?.data.map((s) => (
            <button
              key={s.slug}
              onClick={() => f.setSector(s.slug)}
              className={cn(
                "rounded-md border px-2 py-1 text-[11px] font-medium",
                f.sector === s.slug
                  ? "border-[var(--color-accent-border)] bg-[var(--color-accent-tint-2)] text-text"
                  : "border-[var(--color-border)] bg-surface-2 text-[var(--color-text-secondary)]",
              )}
            >
              {s.name}
            </button>
          ))}
        </div>
      </Accordion>

      <Accordion
        title="Technical"
        summary="RSI, DMA, 52WH, volume"
        open={f.openGroup === "technical"}
        onToggle={() => f.setOpenGroup("technical")}
      >
        <p className="text-[11px] leading-relaxed text-[var(--color-text-muted)]">
          RSI, distance-from-52W-high, volume-vs-20d and delivery ranges wire up in Phase 1
          once <code>daily_indicators</code> is populated.
        </p>
      </Accordion>

      <div className="p-4">
        <Button className="w-full" disabled>
          Save this screen
        </Button>
        <div className="mt-2 text-center font-mono text-[11px] text-[var(--color-text-faint)]">
          saved screens land in Phase 1 · ⌘S
        </div>
      </div>
    </aside>
  );
}
