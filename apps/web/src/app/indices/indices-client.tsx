"use client";

import { LayoutGrid, List, X } from "lucide-react";
import Link from "next/link";
import { useQueryState } from "nuqs";
import { useMemo, useState } from "react";

import { PriceChart } from "@/components/charts/price-chart";
import { IndexCompareChart } from "@/components/charts/index-compare-chart";
import { Screen, ScreenHeader } from "@/components/screen/screen-header";
import { Button, Card, Chip, DataSourceFooter, EmptyState, Skeleton } from "@/components/ui";
import { useChart, useIndices, useSectors } from "@/lib/api/market-hooks";
import type { IndexRow } from "@/lib/api/market-types";
import { cn } from "@/lib/cn";
import { direction, pct, price } from "@/lib/format";
import { toSlug } from "@/lib/slug";

function toneClass(v: number | null | undefined) {
  const d = direction(v);
  return d === "up" ? "text-up-text" : d === "down" ? "text-down-text" : "text-text-secondary";
}

const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "broad", label: "Broad market" },
  { key: "sectoral", label: "Sectoral" },
] as const;

export function IndicesClient() {
  const q = useIndices();
  const sectorsQ = useSectors();
  const [viewParam, setViewParam] = useQueryState("view");
  const view = viewParam === "chart" ? "chart" : "list";
  const [category, setCategory] = useState<"all" | "broad" | "sectoral">("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [compareSet, setCompareSet] = useState<Set<string>>(new Set());
  const [showCompare, setShowCompare] = useState(false);

  if (q.isPending) {
    return (
      <Screen>
        <ScreenHeader title="Indices" subtitle="Loading..." />
        <Skeleton className="h-96" />
      </Screen>
    );
  }

  if (q.isError) {
    return (
      <Screen>
        <ScreenHeader title="Indices" />
        <EmptyState
          title="Could not load indices"
          description={String((q.error as Error).message)}
          actions={<Button onClick={() => q.refetch()}>Retry</Button>}
        />
      </Screen>
    );
  }

  const d = q.data!.data;
  const meta = q.data!.meta;
  const filtered = d.indices.filter((r) => category === "all" || r.category === category);
  const sectorByName = new Map((sectorsQ.data?.data.sectors ?? []).map((s) => [s.name, s]));

  function toggleCompare(symbol: string) {
    setCompareSet((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) next.delete(symbol);
      else if (next.size < 6) next.add(symbol);
      return next;
    });
  }

  return (
    <Screen>
      <ScreenHeader
        title="Indices"
        subtitle={`${filtered.length} indices · close of ${d.as_of ?? "—"}`}
        actions={
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
              onClick={() => setViewParam("chart")}
              className={cn(
                "flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium",
                view === "chart" ? "bg-[var(--color-accent-tint)] text-accent-hover" : "text-text-secondary hover:text-text",
              )}
            >
              <LayoutGrid size={12} /> Chart
            </button>
          </div>
        }
      />

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-0.5 rounded-md border border-border bg-surface p-0.5">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => setCategory(c.key)}
              className={cn(
                "rounded px-2.5 py-1 text-[11px] font-medium",
                category === c.key ? "bg-[var(--color-accent-tint)] text-accent-hover" : "text-text-secondary hover:text-text",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
        <Button size="sm" variant={showCompare ? "primary" : "secondary"} onClick={() => setShowCompare((v) => !v)}>
          Compare {compareSet.size > 0 ? `(${compareSet.size})` : ""}
        </Button>
      </div>

      {showCompare && (
        <Card className="mb-2 p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[13px] font-semibold">Index comparison · rebased to 100</div>
            {compareSet.size > 0 && (
              <button onClick={() => setCompareSet(new Set())} className="text-[11px] text-text-muted hover:text-text">
                Clear
              </button>
            )}
          </div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {filtered.map((r) => (
              <button
                key={r.symbol}
                onClick={() => toggleCompare(r.symbol)}
                disabled={!compareSet.has(r.symbol) && compareSet.size >= 6}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] font-medium disabled:cursor-default disabled:opacity-40",
                  compareSet.has(r.symbol)
                    ? "border-accent bg-[var(--color-accent-tint)] text-accent-hover"
                    : "border-border text-text-secondary hover:bg-surface-2",
                )}
              >
                {r.symbol}
              </button>
            ))}
          </div>
          <IndexCompareChart slugs={[...compareSet].map(toSlug)} />
          <div className="mt-2 font-mono text-[11px] text-text-faint">pick up to 6 · each line = close price ÷ its own value on the first common session</div>
        </Card>
      )}

      {view === "chart" ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => (
            <IndexChartCard key={r.symbol} row={r} />
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[480px]">
              <div className="grid grid-cols-[1.6fr_0.9fr_0.9fr_0.9fr] gap-2 border-b border-border px-4 py-1.5 text-[11px] text-text-muted">
                <span>Index</span>
                <span className="text-right">Value</span>
                <span className="text-right">Change</span>
                <span className="text-right">%Chg</span>
              </div>
              {filtered.map((r) => {
                const sector = sectorByName.get(r.symbol);
                const canExpand = r.category === "sectoral" && sector && sector.constituents.length > 0;
                return (
                  <div key={r.symbol} className="border-b border-border last:border-0">
                    <div
                      className="grid grid-cols-[1.6fr_0.9fr_0.9fr_0.9fr] items-center gap-2 px-4 py-2.5"
                      onClick={() => canExpand && setExpanded((e) => (e === r.symbol ? null : r.symbol))}
                      role={canExpand ? "button" : undefined}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <Link
                          href={`/chart/${r.slug}?back=${encodeURIComponent("/indices")}`}
                          onClick={(e) => e.stopPropagation()}
                          className="tnum truncate text-[13px] font-medium hover:text-accent"
                        >
                          {r.symbol}
                        </Link>
                        {r.category === "sectoral" && <Chip tone="accent">sector</Chip>}
                        {canExpand && <span className="text-[11px] text-text-muted">{expanded === r.symbol ? "▾" : "▸"}</span>}
                      </div>
                      <span className="tnum text-right text-[13px]">{price(r.value)}</span>
                      <span className={cn("tnum text-right text-[13px]", toneClass(r.change_pct))}>
                        {r.change == null ? "—" : (r.change >= 0 ? "+" : "") + r.change.toLocaleString("en-IN")}
                      </span>
                      <span className={cn("tnum text-right text-[13px]", toneClass(r.change_pct))}>
                        {r.change_pct == null ? "—" : pct(r.change_pct)}
                      </span>
                    </div>
                    {expanded === r.symbol && sector && (
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 bg-surface-2 p-4 sm:grid-cols-3 lg:grid-cols-4">
                        {sector.constituents.map((c) => (
                          <Link
                            key={c.symbol}
                            href={`/chart/${toSlug(c.symbol)}?back=${encodeURIComponent("/indices")}`}
                            className="tnum flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-surface"
                          >
                            <span className="min-w-0 truncate text-[13px] font-medium">{c.symbol}</span>
                            <span className="flex items-center gap-2">
                              <span className="text-[12px] text-text-secondary">{price(c.ltp)}</span>
                              <span className={cn("text-[11px]", toneClass(c.change_pct))}>
                                {c.change_pct == null ? "—" : pct(c.change_pct)}
                              </span>
                            </span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="border-t border-border px-4 py-2.5">
            <DataSourceFooter meta={meta} />
          </div>
        </Card>
      )}
    </Screen>
  );
}

function IndexChartCard({ row }: { row: IndexRow }) {
  const chart = useChart(row.slug);
  return (
    <Card className="p-3">
      <div className="flex items-center justify-between">
        <Link href={`/chart/${row.slug}?back=${encodeURIComponent("/indices")}`} className="text-[13px] font-semibold hover:text-accent">
          {row.symbol}
        </Link>
        <span className={cn("tnum text-[12px]", toneClass(row.change_pct))}>
          {row.change_pct == null ? "—" : pct(row.change_pct)}
        </span>
      </div>
      <div className="mt-2 h-[140px]">
        {chart.isPending ? (
          <div className="h-full animate-pulse rounded-md bg-surface-2" />
        ) : chart.isError || !chart.data ? (
          <div className="flex h-full items-center justify-center text-[11px] text-text-muted">chart unavailable</div>
        ) : (
          <PriceChart data={chart.data.data} height={140} showVolume={false} showSr={false} />
        )}
      </div>
    </Card>
  );
}
