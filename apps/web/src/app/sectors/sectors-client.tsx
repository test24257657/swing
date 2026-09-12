"use client";

import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { RrgScatter, shortName } from "@/components/charts/rrg-scatter";
import { Screen, ScreenHeader } from "@/components/screen/screen-header";
import { Button, Card, DataSourceFooter, EmptyState, Skeleton, Tooltip } from "@/components/ui";
import { useSectors } from "@/lib/api/market-hooks";
import type { SectorRow } from "@/lib/api/market-types";
import { cn } from "@/lib/cn";
import { direction, pct, price } from "@/lib/format";
import { toSlug } from "@/lib/slug";

function toneClass(v: number | null | undefined) {
  const d = direction(v);
  return d === "up" ? "text-up-text" : d === "down" ? "text-down-text" : "text-text-secondary";
}

/** Equal-size cells (not market-cap weighted — this build has no market-cap data),
 * coloured by 1-month return on a fixed -8%..+8% scale. */
function heatTone(r: number | null): { bg: string; bd: string; fg: string } {
  if (r == null) return { bg: "var(--color-surface-2)", bd: "var(--color-border)", fg: "text-text-secondary" };
  const t = Math.max(-1, Math.min(1, r / 8));
  if (t >= 0.5) return { bg: "rgba(22,163,74,0.22)", bd: "rgba(22,163,74,0.45)", fg: "text-up-text" };
  if (t > 0.05) return { bg: "rgba(22,163,74,0.10)", bd: "rgba(22,163,74,0.28)", fg: "text-up-text" };
  if (t >= -0.05) return { bg: "var(--color-surface-2)", bd: "var(--color-border)", fg: "text-text-secondary" };
  if (t > -0.5) return { bg: "rgba(220,38,38,0.10)", bd: "rgba(220,38,38,0.28)", fg: "text-down-text" };
  return { bg: "rgba(220,38,38,0.22)", bd: "rgba(220,38,38,0.45)", fg: "text-down-text" };
}

function summaryLine(sectors: SectorRow[]): string {
  const withDelta = sectors.filter((s) => s.rank_delta != null);
  if (withDelta.length === 0) return "Sector momentum for the last month, ranked by 1-month return.";
  const risers = [...withDelta].sort((a, b) => b.rank_delta! - a.rank_delta!).slice(0, 2);
  const biggestFaller = [...withDelta].sort((a, b) => a.rank_delta! - b.rank_delta!)[0];
  const riserNames = risers.map((s) => shortName(s.name)).join(" and ");
  if (!biggestFaller || biggestFaller.rank_delta! >= -2) {
    return `Capital is rotating into ${riserNames} this month.`;
  }
  return `Capital is rotating into ${riserNames}; ${shortName(biggestFaller.name)} has slipped ${Math.abs(biggestFaller.rank_delta!)} ranks in 3 weeks.`;
}

export function SectorsClient() {
  const q = useSectors();
  const [selected, setSelected] = useState<string | null>(null);

  if (q.isPending) {
    return (
      <Screen>
        <ScreenHeader title="Sector Rotation" />
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Card className="p-4">
            <Skeleton className="h-4 w-56" />
            <div className="mt-4 grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-28" />
              ))}
            </div>
          </Card>
          <Card className="p-4">
            <Skeleton className="h-4 w-40" />
            <div className="mt-4 flex flex-col gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-6" />
              ))}
            </div>
          </Card>
        </div>
        <Skeleton className="mt-2 h-[430px]" />
      </Screen>
    );
  }

  if (q.isError) {
    return (
      <Screen>
        <ScreenHeader title="Sector Rotation" />
        <EmptyState
          title="Could not load sector rotation"
          description={String((q.error as Error).message)}
          actions={<Button onClick={() => q.refetch()}>Retry</Button>}
        />
      </Screen>
    );
  }

  const d = q.data!.data;
  const meta = q.data!.meta;
  const sectors = d.sectors;
  const selectedSector = sectors.find((s) => s.name === selected) ?? null;

  return (
    <Screen>
      <ScreenHeader
        title="Sector Rotation"
        subtitle={`${summaryLine(sectors)} · vs ${d.benchmark}, close of ${d.as_of}.`}
      />

      <div className="grid grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-[13px] font-semibold">Heatmap · colour = 1-month return</div>
            <div className="flex items-center gap-2 font-mono text-[11px] text-text-muted">
              <span>-8%</span>
              <div className="h-1.5 w-24 rounded-full" style={{ background: "linear-gradient(90deg,#dc2626,#a8a8b0,#16a34a)" }} />
              <span>+8%</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
            {sectors.map((s) => {
              const t = heatTone(s.return_1m);
              return (
                <button
                  key={s.name}
                  onClick={() => setSelected((cur) => (cur === s.name ? null : s.name))}
                  className={cn(
                    "flex h-28 flex-col rounded-lg border p-3 text-left transition-colors",
                    selected === s.name && "ring-2 ring-accent",
                  )}
                  style={{ background: t.bg, borderColor: t.bd }}
                >
                  <div className="text-[13px] font-medium leading-tight">{shortName(s.name)}</div>
                  <div className={cn("tnum mt-auto text-[20px] font-semibold tracking-tight", t.fg)}>
                    {s.return_1m == null ? "—" : pct(s.return_1m)}
                  </div>
                  <div className="mt-0.5 text-[11px] text-text-secondary">
                    {s.stock_count} stocks · {s.advancers} up
                  </div>
                </button>
              );
            })}
          </div>
          <div className="mt-3 border-t border-border pt-2.5">
            <DataSourceFooter meta={meta} />
          </div>
        </Card>

        <Card className="flex flex-col overflow-hidden">
          <div className="px-4 pt-4">
            <div className="text-[13px] font-semibold">Ranked by momentum</div>
            <div className="mt-0.5 text-[11px] text-text-muted">Arrow = rank change vs 3 weeks ago</div>
          </div>
          <div className="mt-2 grid grid-cols-[20px_minmax(0,1fr)_56px_56px_30px] gap-2 border-b border-border px-4 pb-1.5 text-[11px] text-text-muted">
            <span>#</span>
            <span>Sector</span>
            <span className="text-right">1M</span>
            <span className="text-right">3M</span>
            <span className="text-right">Δ</span>
          </div>
          {sectors.map((s) => (
            <button
              key={s.name}
              onClick={() => setSelected((cur) => (cur === s.name ? null : s.name))}
              className={cn(
                "tnum grid grid-cols-[20px_minmax(0,1fr)_56px_56px_30px] gap-2 border-b border-border px-4 py-2 text-left last:border-0 hover:bg-surface-2",
                selected === s.name && "bg-[var(--color-accent-tint)]",
              )}
            >
              <span className="font-mono text-[11px] text-text-muted">{s.rank ?? "—"}</span>
              <span className="truncate text-[13px]">{shortName(s.name)}</span>
              <span className={cn("text-right text-[13px]", toneClass(s.return_1m))}>
                {s.return_1m == null ? "—" : pct(s.return_1m)}
              </span>
              <span className={cn("text-right text-[13px]", toneClass(s.return_3m))}>
                {s.return_3m == null ? "—" : pct(s.return_3m)}
              </span>
              <span className={cn("flex items-center justify-end gap-0.5 text-[11px] font-medium", toneClass(s.rank_delta))}>
                {s.rank_delta == null || s.rank_delta === 0 ? (
                  <Minus size={11} />
                ) : s.rank_delta > 0 ? (
                  <ArrowUp size={11} />
                ) : (
                  <ArrowDown size={11} />
                )}
                {s.rank_delta != null && s.rank_delta !== 0 ? Math.abs(s.rank_delta) : ""}
              </span>
            </button>
          ))}
          <div className="mt-auto px-4 py-2.5 font-mono text-[11px] text-text-faint">
            derived: {sectors.length} sector indices · daily close
          </div>
        </Card>
      </div>

      {selectedSector && (
        <Card className="mt-2 overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="text-[13px] font-semibold">{shortName(selectedSector.name)} · constituents</div>
            <button onClick={() => setSelected(null)} className="text-[11px] text-text-muted hover:text-text">
              Close
            </button>
          </div>
          {selectedSector.constituents.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13px] text-text-muted">No constituent data for this sector.</p>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 p-4 sm:grid-cols-3 lg:grid-cols-4">
              {selectedSector.constituents.map((c) => (
                <Link
                  key={c.symbol}
                  href={`/chart/${toSlug(c.symbol)}?back=${encodeURIComponent("/sectors")}`}
                  className="tnum flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-surface-2"
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
        </Card>
      )}

      <Card className="mt-2 p-4">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <div className="text-[13px] font-semibold">Relative rotation · sector vs {d.benchmark}</div>
            <div className="mt-0.5 text-[11px] text-text-muted">
              Tails show the last 6 weekly readings — direction matters more than position.
            </div>
          </div>
          <Tooltip content="X = 30-session relative-strength ratio vs the benchmark, rebased to 100. Y = that ratio's 10-week rate of change.">
            <span className="text-[11px] text-text-muted">how is this computed?</span>
          </Tooltip>
        </div>
        <RrgScatter sectors={sectors} />
        <div className="mt-2 border-t border-border pt-2 font-mono text-[11px] text-text-faint">
          derived: RS ratio vs {d.benchmark} · weekly, 6 periods · {d.as_of}
        </div>
      </Card>
    </Screen>
  );
}
