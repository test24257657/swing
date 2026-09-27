"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { IpoMiniChart } from "@/components/charts/ipo-mini-chart";
import { Screen, ScreenHeader } from "@/components/screen/screen-header";
import { Button, Card, Chip, DataSourceFooter, EmptyState, Skeleton } from "@/components/ui";
import { useIpoChart, useIpos } from "@/lib/api/market-hooks";
import type { IpoRow } from "@/lib/api/market-types";
import { cn } from "@/lib/cn";
import { direction, pct, price } from "@/lib/format";
import { toSlug } from "@/lib/slug";

const PER_PAGE = 10;

const SORTS = {
  recent: { label: "Newest listing", fn: (a: IpoRow, b: IpoRow) => b.listing_date.localeCompare(a.listing_date) },
  gain: { label: "Best since IPO", fn: (a: IpoRow, b: IpoRow) => (b.gain_since_ipo_pct ?? -1e9) - (a.gain_since_ipo_pct ?? -1e9) },
  loss: { label: "Worst since IPO", fn: (a: IpoRow, b: IpoRow) => (a.gain_since_ipo_pct ?? 1e9) - (b.gain_since_ipo_pct ?? 1e9) },
} as const;
type SortKey = keyof typeof SORTS;

function toneClass(v: number | null | undefined) {
  const d = direction(v);
  return d === "up" ? "text-up-text" : d === "down" ? "text-down-text" : "text-text-secondary";
}

function IpoCard({ row }: { row: IpoRow }) {
  const slug = toSlug(row.symbol);
  const chart = useIpoChart(slug);
  const bars = chart.data?.data.bars ?? [];

  return (
    <Card className="flex flex-col p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Link href={`/chart/${slug}?back=${encodeURIComponent("/ipo")}`} className="text-[15px] font-semibold hover:text-accent">
              {row.symbol}
            </Link>
            {row.pattern && (
              <Chip tone="accent">IPO base · {row.pattern.stage}</Chip>
            )}
          </div>
          <div className="truncate text-[12px] text-text-muted">{row.name}</div>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-text-muted">Current price</div>
          <div className="tnum text-[18px] font-semibold">{price(row.ltp)}</div>
          <div className="font-mono text-[11px] text-text-faint">listed {row.listing_date}</div>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <Chip tone={direction(row.gain_since_ipo_pct) === "down" ? "down" : "up"}>
          Now {pct(row.gain_since_ipo_pct, 1)}
        </Chip>
        <Chip tone={direction(row.listing_pop_pct) === "down" ? "down" : "up"}>
          List {pct(row.listing_pop_pct, 1)}
        </Chip>
        <Chip tone="neutral">IPO {price(row.issue_price)}</Chip>
        {row.series === "BE" && <Chip tone="stale">BE series</Chip>}
      </div>

      <div className="mt-2 min-h-[200px]">
        {chart.isPending ? (
          <Skeleton className="h-[200px]" />
        ) : chart.isError || bars.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-[12px] text-text-muted">Chart unavailable</div>
        ) : (
          <IpoMiniChart bars={bars} issuePrice={row.issue_price} listingClose={row.listing_close} />
        )}
      </div>

      <div className="tnum mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 border-t border-border pt-2 text-[11px] sm:grid-cols-4">
        <span className="text-text-muted">Since listing</span>
        <span className={cn("text-right sm:text-left", toneClass(row.gain_since_listing_pct))}>
          {pct(row.gain_since_listing_pct, 1)}
        </span>
        <span className="text-text-muted">From high</span>
        <span className={cn("text-right sm:text-left", toneClass(row.from_high_pct))}>{pct(row.from_high_pct, 1)}</span>
        <span className="text-text-muted">High · low</span>
        <span className="text-right sm:text-left">
          {price(row.high_since_listing)} · {price(row.low_since_listing)}
        </span>
        <span className="text-text-muted">Sessions</span>
        <span className="text-right sm:text-left">{row.sessions}</span>
      </div>
    </Card>
  );
}

export function IpoClient() {
  const q = useIpos();
  const [sort, setSort] = useState<SortKey>("recent");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const rows = useMemo(() => {
    const all = q.data?.data.ipos ?? [];
    const needle = search.trim().toUpperCase();
    const filtered = needle
      ? all.filter((r) => r.symbol.includes(needle) || r.name.toUpperCase().includes(needle))
      : all;
    return [...filtered].sort(SORTS[sort].fn);
  }, [q.data, search, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const current = Math.min(page, pages - 1);
  const shown = rows.slice(current * PER_PAGE, current * PER_PAGE + PER_PAGE);

  if (q.isPending) {
    return (
      <Screen>
        <ScreenHeader title="IPOs" subtitle="Every NSE listing of the last year, with its chart since listing." />
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[380px]" />
          ))}
        </div>
      </Screen>
    );
  }

  if (q.isError) {
    return (
      <Screen>
        <ScreenHeader title="IPOs" />
        <EmptyState
          title="Could not load IPOs"
          description={String((q.error as Error).message)}
          actions={<Button onClick={() => q.refetch()}>Retry</Button>}
        />
      </Screen>
    );
  }

  const d = q.data.data;

  return (
    <Screen>
      <ScreenHeader
        title="IPOs"
        subtitle={`${d.counts.charted} NSE listings in the last year, newest first · ${d.counts.sme_skipped} SME/bond issues excluded (no price history)`}
      />

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          placeholder="Search IPO…"
          aria-label="Search IPOs"
          className="h-8 min-w-0 flex-1 rounded-md border border-border bg-surface px-3 text-[13px] outline-none placeholder:text-text-faint focus:border-[var(--color-accent-border)] sm:max-w-[240px]"
        />
        <div className="flex flex-wrap gap-1">
          {(Object.keys(SORTS) as SortKey[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setSort(k);
                setPage(0);
              }}
              className={cn(
                "rounded-md border px-2.5 py-1 text-[12px]",
                sort === k
                  ? "border-[var(--color-accent-border)] bg-[var(--color-accent-tint)] text-accent"
                  : "border-border text-text-secondary hover:text-text",
              )}
            >
              {SORTS[k].label}
            </button>
          ))}
        </div>
        <span className="ml-auto font-mono text-[11px] text-text-faint">
          {rows.length} result{rows.length === 1 ? "" : "s"}
        </span>
      </div>

      {shown.length === 0 ? (
        <EmptyState title="No IPO matches that search" description="Try the symbol or part of the company name." />
      ) : (
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          {shown.map((row) => (
            <IpoCard key={row.symbol} row={row} />
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="mt-3 flex items-center justify-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setPage(current - 1)} disabled={current === 0}>
            Previous
          </Button>
          <span className="tnum text-[12px] text-text-muted">
            Page {current + 1} of {pages}
          </span>
          <Button variant="secondary" size="sm" onClick={() => setPage(current + 1)} disabled={current >= pages - 1}>
            Next
          </Button>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <DataSourceFooter meta={q.data.meta} />
        <span className="font-mono text-[11px] text-text-faint">
          orange line = IPO price · blue dashed = listing-day close
        </span>
      </div>
    </Screen>
  );
}
