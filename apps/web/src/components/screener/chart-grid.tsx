"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { PriceChart } from "@/components/charts/price-chart";
import { Card, DataSourceFooter, EmptyState, Skeleton } from "@/components/ui";
import { useSymbolChart } from "@/lib/api/market-hooks";
import type { Envelope, ScreenerResult } from "@/lib/api/types";
import { direction, pct, price } from "@/lib/format";
import { cn } from "@/lib/cn";

import { PatternChip } from "./pattern-chip";
import { ScoreCell } from "./score-cell";

interface Props {
  query: {
    data?: Envelope<ScreenerResult>;
    isPending: boolean;
    isError: boolean;
    error: unknown;
    refetch: () => void;
  };
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
}

/** 2×5 grid of annotated mini-charts. Each chart mounts only when scrolled into view. */
export function ChartGrid({ query, page, totalPages, onPage }: Props) {
  if (query.isPending) {
    return (
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-64" />
        ))}
      </div>
    );
  }
  if (query.isError) {
    return <EmptyState title="Could not load charts" description={String((query.error as Error).message)} />;
  }
  const result = query.data!.data;
  if (result.rows.length === 0) {
    return <EmptyState title="No matches" description="Loosen a filter or clear the pattern selection." />;
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        {result.rows.slice(0, 10).map((r) => (
          <ChartCard
            key={r.symbol}
            symbol={r.symbol}
            name={r.name}
            ltp={r.ltp}
            changePct={r.change_pct}
            score={r.composite_score}
            verdict={r.verdict}
            patterns={r.patterns}
          />
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2.5 text-[13px] text-text-secondary">
        <DataSourceFooter meta={query.data!.meta} />
        <div className="flex items-center gap-1">
          <button
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
            className="rounded-md border border-border px-2.5 py-1 disabled:opacity-40"
          >
            ← Prev
          </button>
          <span className="tnum px-2">
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => onPage(page + 1)}
            className="rounded-md border border-border px-2.5 py-1 disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}

function ChartCard({
  symbol,
  name,
  ltp,
  changePct,
  score,
  verdict,
  patterns,
}: {
  symbol: string;
  name: string;
  ltp: number | null;
  changePct: number | null;
  score: number | null;
  verdict: string | null;
  patterns: string[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  const chart = useSymbolChart(symbol, "6M", visible);

  return (
    <Card ref={ref} className="p-3 transition-colors hover:border-accent">
      <div className="flex items-center gap-2">
        <Link href={`/stock/${symbol}`} className="text-[13px] font-semibold hover:text-accent">
          {symbol}
        </Link>
        <span className="tnum text-[13px]">{price(ltp)}</span>
        <span
          className={cn("tnum text-[13px]", direction(changePct) === "down" ? "text-down-text" : "text-up-text")}
        >
          {changePct == null ? "" : pct(changePct)}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          {patterns.slice(0, 2).map((p) => (
            <PatternChip key={p} code={p} />
          ))}
          <ScoreCell score={score} verdict={verdict} compact />
        </div>
      </div>
      <div className="mt-1 truncate text-[11px] text-text-muted">{name}</div>
      <div className="mt-2">
        {!visible || chart.isPending ? (
          <Skeleton className="h-[200px] w-full" />
        ) : chart.isError || !chart.data?.data.bars.length ? (
          <div className="flex h-[200px] items-center justify-center text-[11px] text-text-muted">
            No price history yet
          </div>
        ) : (
          <PriceChart data={chart.data.data} height={200} compact showVolume={false} />
        )}
      </div>
    </Card>
  );
}
