"use client";

import Link from "next/link";

import { PriceChart } from "@/components/charts/price-chart";
import { Chip } from "@/components/ui";
import { useChart } from "@/lib/api/market-hooks";
import type { ScreenerRow } from "@/lib/api/market-types";
import { cn } from "@/lib/cn";
import { direction, pct, price } from "@/lib/format";
import { PATTERNS } from "@/lib/patterns";
import { toSlug } from "@/lib/slug";
import { useInView } from "@/lib/use-in-view";

function toneClass(v: number | null | undefined) {
  const d = direction(v);
  return d === "up" ? "text-up-text" : d === "down" ? "text-down-text" : "text-text-secondary";
}

/** 2-column grid of setup-pattern cards. Each card's chart (and its API call) only
 * mounts once the card scrolls within 200px of the viewport. */
export function ChartGrid({ rows, backHref }: { rows: ScreenerRow[]; backHref: string }) {
  return (
    <div className="grid grid-cols-2 gap-2 p-2">
      {rows.map((r) => (
        <GridCard key={r.symbol} row={r} backHref={backHref} />
      ))}
    </div>
  );
}

function GridCard({ row, backHref }: { row: ScreenerRow; backHref: string }) {
  const [ref, inView] = useInView<HTMLAnchorElement>();
  const slug = toSlug(row.symbol);
  const chart = useChart(inView ? slug : "");
  const top = row.patterns[0];

  return (
    <Link
      ref={ref}
      href={`/chart/${slug}?back=${encodeURIComponent(backHref)}`}
      className="flex h-[260px] flex-col rounded-lg border border-border bg-surface p-3 transition-colors hover:border-accent"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold">{row.symbol}</span>
          <span className={cn("tnum text-[12px]", toneClass(row.change_pct))}>
            {row.change_pct == null ? "—" : pct(row.change_pct)}
          </span>
        </div>
        <span className="tnum text-[13px] font-medium">{price(row.ltp)}</span>
      </div>

      <div className="mt-1.5 flex flex-wrap gap-1">
        {row.patterns.map((p) => (
          <Chip key={p.code} tone={PATTERNS[p.code].tone}>
            {PATTERNS[p.code].label}
          </Chip>
        ))}
      </div>

      <div className="mt-2 flex-1 overflow-hidden rounded-md">
        {!inView || chart.isPending ? (
          <div className="h-full animate-pulse rounded-md bg-surface-2" />
        ) : chart.isError || !chart.data ? (
          <div className="flex h-full items-center justify-center text-[11px] text-text-muted">
            chart unavailable
          </div>
        ) : (
          <PriceChart data={chart.data.data} height={160} showVolume={false} showSr={false} pattern={top ?? null} />
        )}
      </div>
    </Link>
  );
}
