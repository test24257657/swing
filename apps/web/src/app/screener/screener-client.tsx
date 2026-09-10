"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQueryState } from "nuqs";
import { useMemo } from "react";

import { Screen, ScreenHeader } from "@/components/screen/screen-header";
import { Button, Card, Chip, DataSourceFooter, EmptyState, Skeleton, Tooltip } from "@/components/ui";
import { useScreener } from "@/lib/api/market-hooks";
import type { BreakoutStage, PatternCode, ScreenerRow } from "@/lib/api/market-types";
import { cn } from "@/lib/cn";
import { direction, pct, price } from "@/lib/format";
import { toSlug } from "@/lib/slug";

const PATTERNS: Record<PatternCode, { label: string; tone: "accent" | "info" | "up" | "stale"; tip: string }> = {
  vcp: {
    label: "VCP",
    tone: "accent",
    tip: "Volatility Contraction Pattern — successive pullbacks each shallower than the last, volume drying up into the pivot.",
  },
  ipo_base: {
    label: "IPO Base",
    tone: "info",
    tip: "First base built after listing — sideways range of 4+ weeks with the listing-day high as resistance.",
  },
  high_52w_breakout: {
    label: "52WH",
    tone: "up",
    tip: "Close above the highest close of the trailing 52 weeks, confirmed by above-average volume.",
  },
  near_pivot: {
    label: "Pivot",
    tone: "stale",
    tip: "Within 3% of the pattern pivot — the buy trigger level, not yet crossed.",
  },
};

const STAGES: { code: BreakoutStage; label: string }[] = [
  { code: "forming", label: "Forming" },
  { code: "confirmed", label: "Confirmed" },
  { code: "extended", label: "Extended" },
];

const STAGE_NOTE: Record<BreakoutStage, string> = {
  forming: "Pivot not yet crossed, or crossed without a volume thrust — a watchlist candidate.",
  confirmed: "Pivot crossed within 3 sessions on ≥1.4× the 20-day average volume.",
  extended: "More than 5% past the pivot — risk/reward has decayed.",
};

function toneClass(v: number | null | undefined) {
  const d = direction(v);
  return d === "up" ? "text-up-text" : d === "down" ? "text-down-text" : "text-text-secondary";
}

export function ScreenerClient() {
  const q = useScreener();
  const searchParams = useSearchParams();
  const [patternsParam, setPatternsParam] = useQueryState("patterns");
  const [stageParam, setStageParam] = useQueryState("stage");

  const patternFilter = useMemo(
    () => new Set((patternsParam?.split(",").filter(Boolean) ?? []) as PatternCode[]),
    [patternsParam],
  );
  const stageFilter = (stageParam as BreakoutStage | null) || null;

  // Carried through to every chart link so "back" returns here with these filters applied.
  const backHref = `/screener${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;

  const rows = useMemo(() => q.data?.data.rows ?? [], [q.data]);
  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const matchesPattern = patternFilter.size === 0 || r.patterns.some((p) => patternFilter.has(p.code));
      const matchesStage = stageFilter === null || r.patterns.some((p) => p.stage === stageFilter);
      return matchesPattern && matchesStage;
    });
  }, [rows, patternFilter, stageFilter]);

  if (q.isPending) {
    return (
      <Screen>
        <ScreenHeader title="Screener" subtitle="Setup-pattern matches from tonight's run." />
        <div className="grid grid-cols-[280px_1fr] gap-2">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </Screen>
    );
  }

  if (q.isError) {
    return (
      <Screen>
        <ScreenHeader title="Screener" />
        <EmptyState
          title="Could not load the screener"
          description={String((q.error as Error).message)}
          actions={<Button onClick={() => q.refetch()}>Retry</Button>}
        />
      </Screen>
    );
  }

  const d = q.data!.data;
  const meta = q.data!.meta;
  const degraded = meta.degraded_sources ?? [];

  function togglePattern(code: PatternCode) {
    const next = new Set(patternFilter);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setPatternsParam(next.size ? [...next].join(",") : null);
  }

  function toggleStage(code: BreakoutStage) {
    setStageParam(stageFilter === code ? null : code);
  }

  function clearFilters() {
    setPatternsParam(null);
    setStageParam(null);
  }

  return (
    <Screen>
      <ScreenHeader
        title="Screener"
        subtitle={`Close of ${d.as_of} · VCP, IPO base, 52-week breakout and near-pivot matches.`}
      />

      {degraded.length > 0 && (
        <div className="mb-3 rounded-md border border-[rgba(217,119,6,0.35)] bg-stale-bg px-3 py-2 text-[11px] text-stale-text">
          Some sources failed in the last run: {degraded.join(", ")}. Matches may be stale.
        </div>
      )}

      <div className="grid grid-cols-[240px_1fr] items-start gap-3">
        {/* Filter rail */}
        <Card className="p-3">
          <div className="text-[13px] font-semibold">Setup patterns</div>
          <div className="mt-2 flex flex-col gap-1">
            {(Object.keys(PATTERNS) as PatternCode[]).map((code) => {
              const p = PATTERNS[code];
              const active = patternFilter.has(code);
              const cnt = d.facets.patterns[code] ?? 0;
              return (
                <Tooltip key={code} content={p.tip}>
                  <button
                    onClick={() => togglePattern(code)}
                    disabled={cnt === 0}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] font-medium disabled:cursor-default disabled:opacity-40",
                      active ? "bg-[var(--color-accent-tint)]" : "hover:bg-surface-2",
                    )}
                  >
                    <Chip tone={p.tone}>{p.label}</Chip>
                    <span className="tnum ml-auto text-[11px] text-text-muted">{cnt}</span>
                  </button>
                </Tooltip>
              );
            })}
          </div>

          <div className="mt-4 rounded-md border border-[var(--color-accent-border)] bg-surface p-2.5">
            <div className="text-[11px] font-semibold tracking-wide text-text-secondary">BREAKOUT STAGE</div>
            <div className="mt-2 grid grid-cols-2 gap-1">
              {STAGES.map((s) => {
                const active = stageFilter === s.code;
                const cnt = d.facets.stages[s.code] ?? 0;
                return (
                  <button
                    key={s.code}
                    onClick={() => toggleStage(s.code)}
                    disabled={cnt === 0}
                    className={cn(
                      "flex h-8 items-center justify-center gap-1.5 rounded-md border text-[13px] font-medium disabled:cursor-default disabled:opacity-40",
                      active
                        ? "border-accent bg-[var(--color-accent-tint)] text-accent-hover"
                        : "border-border text-text-secondary hover:bg-surface-2",
                    )}
                  >
                    {s.label}
                    <span className="tnum text-[11px] opacity-70">{cnt}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-2 text-[11px] leading-relaxed text-text-muted">
              {stageFilter ? STAGE_NOTE[stageFilter] : "Forming = still building. Confirmed = pivot crossed on volume. Extended = risk/reward decayed."}
            </div>
          </div>
        </Card>

        {/* Results */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-[13px] text-text-secondary">
              <span className="tnum font-medium text-text">{filtered.length}</span> matches
              {filtered.length !== rows.length ? ` of ${rows.length}` : ""}
            </span>
            {(patternFilter.size > 0 || stageFilter) && (
              <button onClick={clearFilters} className="text-[11px] text-text-muted hover:text-text">
                Clear filters
              </button>
            )}
          </div>

          <div
            className="grid gap-2 border-b border-border px-4 py-1.5 text-[11px] text-text-muted"
            style={{ gridTemplateColumns: "1.8fr 0.8fr 0.7fr 1.6fr" }}
          >
            <span>Symbol</span>
            <span className="text-right">LTP</span>
            <span className="text-right">%Chg</span>
            <span>Pattern</span>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              title="No stock matches these filters"
              description="Try clearing a filter — Forming often has candidates even when Confirmed is empty."
              actions={(patternFilter.size > 0 || stageFilter) && <Button onClick={clearFilters}>Clear filters</Button>}
            />
          ) : (
            filtered.map((r) => <Row key={r.symbol} row={r} backHref={backHref} />)
          )}

          <div className="border-t border-border px-4 py-2.5">
            <DataSourceFooter meta={meta} />
          </div>
        </Card>
      </div>
    </Screen>
  );
}

function Row({ row, backHref }: { row: ScreenerRow; backHref: string }) {
  return (
    <Link
      href={`/chart/${toSlug(row.symbol)}?back=${encodeURIComponent(backHref)}`}
      className="tnum grid items-center gap-2 border-b border-border px-4 py-2.5 last:border-0 hover:bg-surface-2"
      style={{ gridTemplateColumns: "1.8fr 0.8fr 0.7fr 1.6fr" }}
    >
      <div className="min-w-0">
        <div className="text-[13px] font-medium">{row.symbol}</div>
        <div className="truncate text-[11px] text-text-muted">{row.name}</div>
      </div>
      <span className="text-right text-[13px]">{price(row.ltp)}</span>
      <span className={cn("text-right text-[13px]", toneClass(row.change_pct))}>
        {row.change_pct == null ? "—" : pct(row.change_pct)}
      </span>
      <div className="flex flex-wrap items-center gap-1">
        {row.patterns.map((p) => (
          <Tooltip
            key={p.code}
            content={`${PATTERNS[p.code].tip} Stage: ${p.stage}. Pivot ${price(p.pivot_price)}${
              p.target_suggestion ? `, target ${price(p.target_suggestion)}` : ""
            }.`}
          >
            <Chip tone={PATTERNS[p.code].tone}>{PATTERNS[p.code].label}</Chip>
          </Tooltip>
        ))}
      </div>
    </Link>
  );
}
