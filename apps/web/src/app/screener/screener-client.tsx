"use client";

import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, LayoutGrid, List } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQueryState } from "nuqs";
import { useEffect, useMemo, useState } from "react";

import { ChartGrid } from "@/components/screener/chart-grid";
import { Screen, ScreenHeader } from "@/components/screen/screen-header";
import { Button, Card, Chip, DataSourceFooter, EmptyState, Skeleton, Tooltip } from "@/components/ui";
import { useScreener } from "@/lib/api/market-hooks";
import type { BreakoutStage, PatternCode, ScreenerRow } from "@/lib/api/market-types";
import { cn } from "@/lib/cn";
import { direction, pct, price } from "@/lib/format";
import { PATTERNS, STAGE_NOTE, STAGES } from "@/lib/patterns";
import { toSlug } from "@/lib/slug";

function toneClass(v: number | null | undefined) {
  const d = direction(v);
  return d === "up" ? "text-up-text" : d === "down" ? "text-down-text" : "text-text-secondary";
}

/** Distance from LTP to the top-confidence pattern's pivot — negative means still below it. */
function pivotDist(row: ScreenerRow): number | null {
  const pivot = row.patterns[0]?.pivot_price;
  return pivot ? ((row.ltp / pivot - 1) * 100) : null;
}

type SortColumn = "symbol" | "ltp" | "change_pct" | "pivot_dist";
type SortDir = "asc" | "desc";
const DEFAULT_DIR: Record<SortColumn, SortDir> = {
  symbol: "asc",
  ltp: "desc",
  change_pct: "desc",
  pivot_dist: "asc", // closest to pivot first
};
const COLUMNS: { key: SortColumn; label: string; align: "left" | "right" }[] = [
  { key: "symbol", label: "Symbol", align: "left" },
  { key: "ltp", label: "LTP", align: "right" },
  { key: "change_pct", label: "%Chg", align: "right" },
  { key: "pivot_dist", label: "Near pivot", align: "right" },
];
const PAGE_SIZE_LIST = 25;
const PAGE_SIZE_GRID = 10; // 2 columns x 5 rows

export function ScreenerClient() {
  const q = useScreener();
  const searchParams = useSearchParams();
  const [patternsParam, setPatternsParam] = useQueryState("patterns");
  const [stageParam, setStageParam] = useQueryState("stage");
  const [viewParam, setViewParam] = useQueryState("view");
  const view = viewParam === "grid" ? "grid" : "list";

  const patternFilter = useMemo(
    () => new Set((patternsParam?.split(",").filter(Boolean) ?? []) as PatternCode[]),
    [patternsParam],
  );
  const stageFilter = (stageParam as BreakoutStage | null) || null;

  // Carried through to every chart link so "back" returns here with these filters applied.
  const backHref = `/screener${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;

  const [sortState, setSortState] = useState<{ col: SortColumn; dir: SortDir } | null>(null);
  const [page, setPage] = useState(1);

  const rows = useMemo(() => q.data?.data.rows ?? [], [q.data]);
  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const matchesPattern = patternFilter.size === 0 || r.patterns.some((p) => patternFilter.has(p.code));
      const matchesStage = stageFilter === null || r.patterns.some((p) => p.stage === stageFilter);
      return matchesPattern && matchesStage;
    });
  }, [rows, patternFilter, stageFilter]);

  const sorted = useMemo(() => {
    if (!sortState) return filtered;
    const { col, dir } = sortState;
    const mul = dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = col === "symbol" ? a.symbol : col === "pivot_dist" ? pivotDist(a) : a[col];
      const bv = col === "symbol" ? b.symbol : col === "pivot_dist" ? pivotDist(b) : b[col];
      if (av == null) return bv == null ? 0 : 1;
      if (bv == null) return -1;
      if (typeof av === "string") return mul * av.localeCompare(bv as string);
      const an = col === "pivot_dist" ? Math.abs(av) : av;
      const bn = col === "pivot_dist" ? Math.abs(bv as number) : (bv as number);
      return mul * (an - bn);
    });
  }, [filtered, sortState]);

  const pageSize = view === "grid" ? PAGE_SIZE_GRID : PAGE_SIZE_LIST;
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageSafe = Math.min(page, pageCount);
  const paged = sorted.slice((pageSafe - 1) * pageSize, pageSafe * pageSize);

  useEffect(() => {
    setPage(1);
  }, [patternFilter, stageFilter, sortState, view]);

  function toggleSort(col: SortColumn) {
    setSortState((prev) => (prev?.col === col ? { col, dir: prev.dir === "asc" ? "desc" : "asc" } : { col, dir: DEFAULT_DIR[col] }));
  }

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
            <div className="flex items-center gap-3">
              {(patternFilter.size > 0 || stageFilter) && (
                <button onClick={clearFilters} className="text-[11px] text-text-muted hover:text-text">
                  Clear filters
                </button>
              )}
              <div className="flex gap-0.5 rounded-md border border-border bg-surface p-0.5">
                <button
                  onClick={() => setViewParam(null)}
                  className={cn(
                    "flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium",
                    view === "list" ? "bg-[var(--color-accent-tint)] text-accent-hover" : "text-text-secondary hover:text-text",
                  )}
                >
                  <List size={12} /> List
                </button>
                <button
                  onClick={() => setViewParam("grid")}
                  className={cn(
                    "flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium",
                    view === "grid" ? "bg-[var(--color-accent-tint)] text-accent-hover" : "text-text-secondary hover:text-text",
                  )}
                >
                  <LayoutGrid size={12} /> Chart
                </button>
              </div>
            </div>
          </div>

          {view === "list" && (
            <div
              className="grid gap-2 border-b border-border px-4 py-1.5 text-[11px] text-text-muted"
              style={{ gridTemplateColumns: "1.8fr 0.8fr 0.7fr 0.9fr 1.4fr" }}
            >
              {COLUMNS.map((c) => (
                <button
                  key={c.key}
                  onClick={() => toggleSort(c.key)}
                  className={cn(
                    "flex items-center gap-1 hover:text-text",
                    c.align === "right" ? "justify-end" : "justify-start",
                    sortState?.col === c.key && "font-semibold text-text",
                  )}
                >
                  {c.label}
                  {sortState?.col === c.key &&
                    (sortState.dir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
                </button>
              ))}
              <span>Pattern</span>
            </div>
          )}

          {paged.length === 0 ? (
            <EmptyState
              title="No stock matches these filters"
              description="Try clearing a filter — Forming often has candidates even when Confirmed is empty."
              actions={(patternFilter.size > 0 || stageFilter) && <Button onClick={clearFilters}>Clear filters</Button>}
            />
          ) : view === "grid" ? (
            <ChartGrid rows={paged} backHref={backHref} />
          ) : (
            paged.map((r) => <Row key={r.symbol} row={r} backHref={backHref} />)
          )}

          {pageCount > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-2">
              <span className="text-[11px] text-text-muted">
                {(pageSafe - 1) * pageSize + 1}–{Math.min(pageSafe * pageSize, sorted.length)} of {sorted.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={pageSafe <= 1}
                  className="flex h-6 w-6 items-center justify-center rounded border border-border text-text-secondary hover:bg-surface-2 disabled:cursor-default disabled:opacity-40"
                >
                  <ChevronLeft size={13} />
                </button>
                <span className="tnum px-1 text-[11px] text-text-secondary">
                  {pageSafe} / {pageCount}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  disabled={pageSafe >= pageCount}
                  className="flex h-6 w-6 items-center justify-center rounded border border-border text-text-secondary hover:bg-surface-2 disabled:cursor-default disabled:opacity-40"
                >
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
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
  const dist = pivotDist(row);
  return (
    <Link
      href={`/chart/${toSlug(row.symbol)}?back=${encodeURIComponent(backHref)}`}
      className="tnum grid items-center gap-2 border-b border-border px-4 py-2.5 last:border-0 hover:bg-surface-2"
      style={{ gridTemplateColumns: "1.8fr 0.8fr 0.7fr 0.9fr 1.4fr" }}
    >
      <div className="min-w-0">
        <div className="text-[13px] font-medium">{row.symbol}</div>
        <div className="truncate text-[11px] text-text-muted">{row.name}</div>
      </div>
      <span className="text-right text-[13px]">{price(row.ltp)}</span>
      <span className={cn("text-right text-[13px]", toneClass(row.change_pct))}>
        {row.change_pct == null ? "—" : pct(row.change_pct)}
      </span>
      <span className="text-right text-[13px] text-text-secondary">{dist == null ? "—" : pct(dist)}</span>
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
