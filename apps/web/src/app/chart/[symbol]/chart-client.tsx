"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { PriceChart } from "@/components/charts/price-chart";
import { Screen } from "@/components/screen/screen-header";
import { Button, Card, Chip, DataSourceFooter, EmptyState, Skeleton } from "@/components/ui";
import { useChart } from "@/lib/api/market-hooks";
import type { ChartArtifact } from "@/lib/api/market-types";
import { cn } from "@/lib/cn";
import { change, direction, pct, price } from "@/lib/format";

const RANGES = [
  { label: "1M", days: 21 },
  { label: "3M", days: 63 },
  { label: "6M", days: 126 },
  { label: "1Y", days: 252 },
] as const;

const MA_LEGEND = [
  { key: "sma_20", label: "20 DMA", color: "#2563eb" },
  { key: "sma_50", label: "50 DMA", color: "#d97706" },
  { key: "sma_200", label: "200 DMA", color: "#7c3aed" },
] as const;

function sliced(data: ChartArtifact, days: number): ChartArtifact {
  if (data.bars.length <= days) return data;
  const cutoff = data.bars[data.bars.length - days].time;
  return {
    ...data,
    bars: data.bars.slice(-days),
    ma: {
      sma_20: data.ma.sma_20?.filter((p) => p.time >= cutoff),
      sma_50: data.ma.sma_50?.filter((p) => p.time >= cutoff),
      sma_200: data.ma.sma_200?.filter((p) => p.time >= cutoff),
    },
  };
}

export function ChartClient({ slug }: { slug: string }) {
  const q = useChart(slug);
  const [range, setRange] = useState<(typeof RANGES)[number]["label"]>("6M");

  const view = useMemo(() => {
    if (!q.data) return null;
    const days = RANGES.find((r) => r.label === range)!.days;
    return sliced(q.data.data, days);
  }, [q.data, range]);

  return (
    <Screen>
      <Link
        href="/pulse"
        className="mb-4 inline-flex items-center gap-1.5 text-[12px] text-text-muted hover:text-text"
      >
        <ArrowLeft size={13} /> Market Pulse
      </Link>

      {q.isPending ? (
        <ChartSkeleton />
      ) : q.isError ? (
        <EmptyState
          title="Chart unavailable"
          description={String((q.error as Error).message)}
          actions={
            <Link href="/pulse">
              <Button>Back to Pulse</Button>
            </Link>
          }
        />
      ) : view ? (
        <Loaded
          data={view}
          range={range}
          onRange={setRange}
          meta={q.data!.meta}
          hasVolume={view.kind === "stock"}
        />
      ) : null}
    </Screen>
  );
}

function Loaded({
  data,
  range,
  onRange,
  meta,
  hasVolume,
}: {
  data: ChartArtifact;
  range: string;
  onRange: (r: (typeof RANGES)[number]["label"]) => void;
  meta: React.ComponentProps<typeof DataSourceFooter>["meta"];
  hasVolume: boolean;
}) {
  const bars = data.bars;
  const last = bars.at(-1);
  const prev = bars.at(-2);
  const lastClose = last?.close ?? null;
  const chg = lastClose != null && prev?.close != null ? lastClose - prev.close : null;
  const chgPct = lastClose != null && prev?.close ? (lastClose / prev.close - 1) * 100 : null;

  return (
    <>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[20px] font-semibold tracking-tight">{data.symbol}</h1>
            <Chip tone={data.kind === "index" ? "accent" : "neutral"}>
              {data.kind === "index" ? "Index" : "Stock"}
            </Chip>
          </div>
          <div className="mt-1 text-[13px] text-text-muted">{data.name}</div>
        </div>
        <div className="text-right">
          <div className="tnum text-[24px] font-semibold tracking-tight">{price(lastClose)}</div>
          <div className={cn("tnum text-[13px]", toneClass(chgPct))}>
            {chg == null ? "" : `${change(chg)} · ${pct(chgPct)}`}
          </div>
        </div>
      </div>

      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-3">
            {MA_LEGEND.map((m) =>
              data.ma[m.key as keyof typeof data.ma]?.length ? (
                <span key={m.key} className="flex items-center gap-1.5 text-[11px] text-text-secondary">
                  <span className="h-0.5 w-3" style={{ background: m.color }} />
                  {m.label}
                </span>
              ) : null,
            )}
          </div>
          <div className="flex gap-0.5 rounded-md border border-border bg-surface p-0.5">
            {RANGES.map((r) => (
              <button
                key={r.label}
                onClick={() => onRange(r.label)}
                className={cn(
                  "rounded px-2.5 py-1 text-[11px] font-medium",
                  range === r.label
                    ? "bg-[var(--color-accent-tint)] text-accent-hover"
                    : "text-text-secondary hover:text-text",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <PriceChart data={data} height={460} showVolume={hasVolume} />

        <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5">
          <DataSourceFooter meta={meta} />
          <span className="font-mono text-[11px] text-text-faint">
            wheel to zoom · drag to pan · {bars.length} sessions
          </span>
        </div>
      </Card>
    </>
  );
}

function toneClass(v: number | null) {
  const d = direction(v);
  return d === "up" ? "text-up-text" : d === "down" ? "text-down-text" : "text-text-secondary";
}

function ChartSkeleton() {
  return (
    <>
      <div className="mb-3 flex items-end justify-between">
        <div>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="mt-2 h-3.5 w-56" />
        </div>
        <div className="text-right">
          <Skeleton className="ml-auto h-7 w-28" />
          <Skeleton className="ml-auto mt-2 h-3.5 w-32" />
        </div>
      </div>
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-7 w-40" />
        </div>
        <div className="relative h-[460px] overflow-hidden rounded-md bg-surface-2">
          <div
            className="absolute inset-0"
            style={{ animation: "shimmer 1.4s ease-in-out infinite" }}
          />
          {/* faint gridlines so the loading state reads as "a chart" */}
          <div className="absolute inset-0 flex flex-col justify-between p-4 opacity-40">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-px bg-border" />
            ))}
          </div>
        </div>
        <Skeleton className="mt-3 h-3 w-64" />
      </Card>
    </>
  );
}
