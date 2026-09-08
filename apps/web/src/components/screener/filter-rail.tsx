"use client";

import { useState } from "react";

import { Accordion, Segmented } from "@/components/ui";
import { useSaveScreen, useSectors } from "@/lib/api/hooks";
import { cn } from "@/lib/cn";
import {
  activeFilterCount,
  PATTERNS,
  STAGES,
  type PatternCode,
  type ScreenerState,
} from "@/lib/url/screener-params";
import { useFilters } from "@/stores/filters";

import { RangeField } from "./range-field";
import { SavedScreens } from "./saved-screens";

const PATTERN_META: Record<PatternCode, { label: string; tip: string }> = {
  vcp: { label: "VCP", tip: "Volatility Contraction Pattern — successive shallower pullbacks, volume drying up into the pivot." },
  ipo_base: { label: "IPO Base", tip: "First base after listing — a 4+ week range with the listing-day high as resistance." },
  high_52w_breakout: { label: "52-Week High Breakout", tip: "Close above the trailing 52-week high, confirmed by above-average volume." },
  near_pivot: { label: "Near Pivot Point", tip: "Within ~3% of the pattern pivot — the buy trigger, not yet crossed." },
};

const STAGE_OPTS = STAGES.map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }));

interface Props {
  params: ScreenerState;
  setParams: (patch: Partial<ScreenerState>) => void;
  reset: () => void;
  facets: Record<string, number>;
}

export function FilterRail({ params, setParams, reset, facets }: Props) {
  const collapsed = useFilters((s) => s.railCollapsed);
  const toggleRail = useFilters((s) => s.toggleRail);
  const openGroup = useFilters((s) => s.openGroup);
  const setOpenGroup = useFilters((s) => s.setOpenGroup);

  const sectors = useSectors();
  const saveScreen = useSaveScreen();
  const [name, setName] = useState("");

  if (collapsed) {
    return (
      <div className="flex w-10 flex-none flex-col items-center border-r border-border bg-bg py-4">
        <button onClick={toggleRail} className="text-text-muted hover:text-text" title="Show filters">
          ▶
        </button>
      </div>
    );
  }

  const togglePattern = (p: PatternCode) =>
    setParams({
      patterns: params.patterns.includes(p)
        ? params.patterns.filter((x) => x !== p)
        : [...params.patterns, p],
      page: 1,
    });

  return (
    <aside className="w-[280px] flex-none border-r border-border bg-bg">
      <div className="flex items-center gap-2 border-b border-border p-4">
        <span className="text-[13px] font-semibold">Filters</span>
        <span className="tnum rounded-full bg-accent px-1.5 py-0.5 text-[11px] font-semibold text-white">
          {activeFilterCount(params)}
        </span>
        <div className="ml-auto flex items-center gap-2.5 text-[11px]">
          <button onClick={reset} className="text-text-secondary hover:text-text">
            Reset
          </button>
          <span className="text-text-faint">|</span>
          <button onClick={toggleRail} className="text-text-muted">
            ◀
          </button>
        </div>
      </div>

      {/* Setup patterns — primary action (detectors land in Phase 2) */}
      <div className="border-b border-border p-4">
        <div className="mb-2.5 flex items-center gap-2">
          <span className="text-[13px] font-semibold">Setup patterns</span>
          <span className="font-mono text-[11px] text-accent">▸ primary action</span>
        </div>
        <div className="flex flex-col gap-0.5">
          {PATTERNS.map((code) => {
            const on = params.patterns.includes(code);
            return (
              <button
                key={code}
                title={PATTERN_META[code].tip}
                onClick={() => togglePattern(code)}
                className={cn(
                  "flex items-center gap-2.5 rounded-r-md border-l-2 px-2.5 py-2 text-left hover:bg-surface-2",
                  on ? "border-l-accent bg-[var(--color-accent-tint-2)]" : "border-l-transparent",
                )}
              >
                <span
                  className={cn(
                    "flex h-3.5 w-3.5 flex-none items-center justify-center rounded-sm border text-[10px] leading-none",
                    on ? "border-accent bg-[var(--color-accent-tint)]" : "border-border-strong",
                  )}
                >
                  {on ? "✓" : ""}
                </span>
                <span className={cn("text-[13px] font-medium", on ? "text-text" : "text-text-secondary")}>
                  {PATTERN_META[code].label}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 font-mono text-[11px] text-text-faint">counts arrive with Phase 2</p>

        <div className="mt-4 rounded-lg border border-[rgba(139,92,246,0.28)] bg-surface p-3">
          <div className="mb-2 text-[11px] font-semibold tracking-wide">BREAKOUT STAGE</div>
          <Segmented
            options={STAGE_OPTS}
            value={params.stage}
            onChange={(stage) => setParams({ stage, page: 1 })}
            size="sm"
            className="w-full [&>button]:flex-1"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 px-4 pb-1 pt-3.5">
        <span className="text-[11px] font-semibold tracking-wide text-text-muted">REFINE</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <Accordion
        title="Universe"
        summary={params.sector ?? (params.fno_only ? "F&O only" : "all")}
        count={(params.sector ? 1 : 0) + (params.fno_only ? 1 : 0)}
        open={openGroup === "universe"}
        onToggle={() => setOpenGroup("universe")}
      >
        <label className="flex cursor-pointer items-center gap-2 text-[12px] text-text-secondary">
          <input
            type="checkbox"
            checked={params.fno_only}
            onChange={(e) => setParams({ fno_only: e.target.checked, page: 1 })}
          />
          F&amp;O-eligible only
        </label>
        <div>
          <div className="mb-1.5 text-[11px] text-text-secondary">Sector</div>
          <div className="flex flex-wrap gap-1.5">
            <SectorChip active={!params.sector} onClick={() => setParams({ sector: null, page: 1 })}>
              All
            </SectorChip>
            {sectors.data?.data.map((s) => (
              <SectorChip
                key={s.slug}
                active={params.sector === s.slug}
                count={facets[s.name]}
                onClick={() => setParams({ sector: s.slug, page: 1 })}
              >
                {s.name}
              </SectorChip>
            ))}
          </div>
        </div>
      </Accordion>

      <Accordion
        title="Technical"
        summary="RSI, DMA, 52WH, volume"
        count={
          (params.rsi_min != null || params.rsi_max != null ? 1 : 0) +
          (params.dist_52wh_min != null || params.dist_52wh_max != null ? 1 : 0) +
          (params.rel_volume_min != null ? 1 : 0) +
          (params.above_sma_20 || params.above_sma_50 || params.above_sma_200 ? 1 : 0)
        }
        open={openGroup === "technical"}
        onToggle={() => setOpenGroup("technical")}
      >
        <div className="flex flex-wrap gap-1.5">
          {([20, 50, 200] as const).map((n) => {
            const key = `above_sma_${n}` as const;
            return (
              <SectorChip key={n} active={params[key]} onClick={() => setParams({ [key]: !params[key], page: 1 })}>
                &gt; {n} DMA
              </SectorChip>
            );
          })}
        </div>
        <RangeField
          label="RSI (14)"
          min={params.rsi_min}
          max={params.rsi_max}
          onChange={(r) => setParams({ rsi_min: r.min, rsi_max: r.max, page: 1 })}
        />
        <RangeField
          label="Distance from 52W high (%)"
          min={params.dist_52wh_min}
          max={params.dist_52wh_max}
          step={0.5}
          onChange={(r) => setParams({ dist_52wh_min: r.min, dist_52wh_max: r.max, page: 1 })}
        />
        <RangeField
          label="Volume vs 20d avg"
          min={params.rel_volume_min}
          max={null}
          step={0.1}
          unit="×"
          onChange={(r) => setParams({ rel_volume_min: r.min, page: 1 })}
        />
      </Accordion>

      <Accordion
        title="Delivery"
        summary={params.delivery_min != null ? `> ${params.delivery_min}%` : "any"}
        count={params.delivery_min != null ? 1 : 0}
        open={openGroup === "delivery"}
        onToggle={() => setOpenGroup("delivery")}
      >
        <RangeField
          label="Delivery % (20d avg)"
          min={params.delivery_min}
          max={null}
          onChange={(r) => setParams({ delivery_min: r.min, page: 1 })}
        />
        <p className="text-[11px] leading-relaxed text-text-muted">
          Delivery-trend (rising / flat / falling) filtering arrives once enough history is ingested.
        </p>
      </Accordion>

      <Accordion
        title="Score"
        summary={params.min_score != null ? `≥ ${params.min_score}` : "any"}
        count={params.min_score != null ? 1 : 0}
        open={openGroup === "score"}
        onToggle={() => setOpenGroup("score")}
      >
        <RangeField
          label="Minimum composite score"
          min={params.min_score}
          max={null}
          onChange={(r) => setParams({ min_score: r.min, page: 1 })}
        />
      </Accordion>

      <div className="flex flex-col gap-2 p-4">
        <div className="flex gap-1.5">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name this screen"
            className="h-9 flex-1 rounded-md border border-border bg-surface px-2.5 text-[12px] focus:border-accent focus:outline-none"
          />
          <button
            disabled={!name.trim() || saveScreen.isPending}
            onClick={() => {
              saveScreen.mutate(
                { name: name.trim(), filters: paramsToFilters(params) },
                { onSuccess: () => setName("") },
              );
            }}
            className="rounded-md bg-accent px-3 text-[12px] font-medium text-white disabled:opacity-50"
          >
            Save
          </button>
        </div>
        <SavedScreens onApply={(f) => setParams({ ...emptyState(), ...(f as Partial<ScreenerState>), page: 1 })} />
      </div>
    </aside>
  );
}

function SectorChip({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean;
  count?: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-md border px-2 py-1 text-[11px] font-medium",
        active
          ? "border-[var(--color-accent-border)] bg-[var(--color-accent-tint-2)] text-text"
          : "border-border bg-surface-2 text-text-secondary",
      )}
    >
      {children}
      {count != null && count > 0 && <span className="ml-1 text-text-faint">{count}</span>}
    </button>
  );
}

function paramsToFilters(p: ScreenerState): Record<string, unknown> {
  const { page: _p, per_page: _pp, ...rest } = p;
  return Object.fromEntries(Object.entries(rest).filter(([, v]) => v != null && !(Array.isArray(v) && v.length === 0)));
}

function emptyState(): Partial<ScreenerState> {
  return {
    patterns: [],
    stage: "all",
    sector: null,
    fno_only: false,
    rsi_min: null,
    rsi_max: null,
    dist_52wh_min: null,
    dist_52wh_max: null,
    rel_volume_min: null,
    delivery_min: null,
    min_score: null,
    above_sma_20: false,
    above_sma_50: false,
    above_sma_200: false,
  };
}
