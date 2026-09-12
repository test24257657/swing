"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { PriceChart } from "@/components/charts/price-chart";
import { Screen } from "@/components/screen/screen-header";
import { Button, Card, Chip, DataSourceFooter, EmptyState, Skeleton, Tooltip } from "@/components/ui";
import { useChart, useDepth, useFno, useFundamentals, useNews, useScreener } from "@/lib/api/market-hooks";
import type { ChartArtifact, ChartBar, DepthData, FnoData, FundamentalsData, NewsItem, PatternMatch } from "@/lib/api/market-types";
import { cn } from "@/lib/cn";
import { change, direction, pct, price } from "@/lib/format";
import { PATTERNS } from "@/lib/patterns";
import { TONE_BOX } from "@/lib/tone";

import {
  DeliveryTrend,
  FilingVerificationCard,
  FnoPositioningCard,
  FundamentalsCard,
  MarketDepthCard,
  OptionChainCard,
  PositionSizing,
  StockAnnouncements,
  TechnicalSnapshot,
  technicalVerdict,
} from "./detail-cards";

const TIMEFRAMES = [
  { label: "D" },
  { label: "W" },
  { label: "M" },
] as const;
type Timeframe = (typeof TIMEFRAMES)[number]["label"];

const MA_LEGEND = [
  { key: "sma_20", label: "20 DMA", color: "#2563eb" },
  { key: "sma_50", label: "50 DMA", color: "#d97706" },
  { key: "sma_200", label: "200 DMA", color: "#7c3aed" },
] as const;

function weekKey(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const isoDay = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - isoDay + 1);
  return d.toISOString().slice(0, 10);
}

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

function aggregate(data: ChartArtifact, tf: Timeframe): ChartArtifact {
  if (tf === "D") return data;
  const keyFn = tf === "W" ? weekKey : monthKey;
  const groups = new Map<string, ChartBar[]>();
  for (const bar of data.bars) {
    const key = keyFn(bar.time);
    const group = groups.get(key);
    if (group) group.push(bar);
    else groups.set(key, [bar]);
  }
  const bars: ChartBar[] = [...groups.values()].map((group) => {
    const highs = group.map((b) => b.high).filter((v): v is number => v != null);
    const lows = group.map((b) => b.low).filter((v): v is number => v != null);
    return {
      time: group[group.length - 1].time,
      open: group[0].open,
      high: highs.length ? Math.max(...highs) : null,
      low: lows.length ? Math.min(...lows) : null,
      close: group[group.length - 1].close,
      volume: group.reduce((sum, b) => sum + (b.volume ?? 0), 0),
      delivery_pct: group[group.length - 1].delivery_pct,
    };
  });
  // Candle DMAs are daily-period; they don't map to weekly/monthly bars.
  return { ...data, bars, ma: {} };
}

export function ChartClient({ slug }: { slug: string }) {
  const q = useChart(slug);
  const screener = useScreener();
  const fundamentals = useFundamentals(slug);
  const news = useNews();
  const fno = useFno(slug);
  const depth = useDepth(slug);
  const [timeframe, setTimeframe] = useState<Timeframe>("D");
  const searchParams = useSearchParams();

  const back = searchParams.get("back");
  const backHref = back && back.startsWith("/") ? back : "/pulse";
  const backLabel = backHref.startsWith("/screener") ? "Screener" : "Market Pulse";

  const view = useMemo(() => {
    if (!q.data) return null;
    return aggregate(q.data.data, timeframe);
  }, [q.data, timeframe]);

  // Pattern overlays are daily-session data — only meaningful on the D timeframe.
  const pattern: PatternMatch | null =
    timeframe === "D"
      ? (screener.data?.data.rows.find((r) => r.symbol === q.data?.data.symbol)?.patterns[0] ?? null)
      : null;

  return (
    <Screen>
      <Link href={backHref} className="mb-4 inline-flex items-center gap-1.5 text-[12px] text-text-muted hover:text-text">
        <ArrowLeft size={13} /> {backLabel}
      </Link>

      {q.isPending ? (
        <ChartSkeleton />
      ) : q.isError ? (
        <EmptyState
          title="Chart unavailable"
          description={String((q.error as Error).message)}
          actions={
            <Link href={backHref}>
              <Button>Back to {backLabel}</Button>
            </Link>
          }
        />
      ) : view ? (
        <Loaded
          data={view}
          timeframe={timeframe}
          onTimeframe={setTimeframe}
          meta={q.data!.meta}
          hasVolume={view.kind === "stock"}
          pattern={pattern}
          fundamentals={fundamentals.data?.data ?? null}
          news={news.data?.data.items.filter((n) => n.symbol === view.symbol) ?? []}
          fno={fno.data?.data ?? null}
          depth={depth.data?.data ?? null}
        />
      ) : null}
    </Screen>
  );
}

function Loaded({
  data,
  timeframe,
  onTimeframe,
  meta,
  hasVolume,
  pattern,
  fundamentals,
  news,
  fno,
  depth,
}: {
  data: ChartArtifact;
  timeframe: Timeframe;
  onTimeframe: (tf: Timeframe) => void;
  meta: React.ComponentProps<typeof DataSourceFooter>["meta"];
  hasVolume: boolean;
  pattern: PatternMatch | null;
  fundamentals: FundamentalsData | null;
  news: NewsItem[];
  fno: FnoData | null;
  depth: DepthData | null;
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

      {data.kind === "stock" &&
        data.technicals &&
        (() => {
          const v = technicalVerdict(data.technicals, pattern);
          const t = TONE_BOX[v.tone];
          return (
            <div className="mb-3 rounded-md border px-3 py-2.5" style={{ background: t.bg, borderColor: t.bd }}>
              <div className={cn("text-[13px] font-medium", t.fg)}>{v.label}</div>
              <div className="mt-1 text-[11px] leading-relaxed text-text-secondary">{v.note}</div>
            </div>
          );
        })()}

      {pattern && (
        <div
          className="mb-3 flex flex-wrap items-center gap-2 rounded-md border px-3 py-2"
          style={{ borderColor: "var(--color-accent-border)", background: "var(--color-accent-tint)" }}
        >
          <Tooltip content={PATTERNS[pattern.code].tip}>
            <Chip tone={PATTERNS[pattern.code].tone}>{PATTERNS[pattern.code].label}</Chip>
          </Tooltip>
          <span className="text-[12px] capitalize text-text-secondary">{pattern.stage}</span>
          <span className="tnum ml-auto flex gap-3 text-[12px] text-text-secondary">
            <span>
              Pivot <span className="font-medium text-text">{price(pattern.pivot_price)}</span>
            </span>
            <span>
              Stop <span className="font-medium text-down-text">{price(pattern.stop_suggestion)}</span>
            </span>
            <span>
              Target <span className="font-medium text-up-text">{price(pattern.target_suggestion)}</span>
            </span>
          </span>
        </div>
      )}

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
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.label}
                onClick={() => onTimeframe(tf.label)}
                className={cn(
                  "rounded px-2.5 py-1 text-[11px] font-medium",
                  timeframe === tf.label
                    ? "bg-[var(--color-accent-tint)] text-accent-hover"
                    : "text-text-secondary hover:text-text",
                )}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>

        <PriceChart data={data} height={460} showVolume={hasVolume} showDelivery={hasVolume} pattern={pattern} />

        <div className="mt-3 flex flex-wrap items-center justify-between gap-1 border-t border-border pt-2.5">
          <DataSourceFooter meta={meta} />
          <span className="font-mono text-[11px] text-text-faint">
            wheel to zoom · drag to pan · solid lines = support/resistance · {bars.length} sessions
          </span>
        </div>
      </Card>

      {data.kind === "stock" && data.technicals && (
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <TechnicalSnapshot technicals={data.technicals} asOf={data.as_of} />
          <DeliveryTrend bars={bars} />
          <PositionSizing lastClose={lastClose} atrPct={data.technicals.atr_pct} pattern={pattern} />
          {fno?.buildup && <FnoPositioningCard data={fno} />}
          {depth && <MarketDepthCard data={depth} />}
          {news.length > 0 && (
            <div className="sm:col-span-2 lg:col-span-3">
              <StockAnnouncements items={news} />
            </div>
          )}
          {fundamentals && (
            <div className="sm:col-span-2 lg:col-span-3">
              <FundamentalsCard data={fundamentals} />
              <div className="mt-2">
                <FilingVerificationCard data={fundamentals} />
              </div>
            </div>
          )}
          {fno?.option_chain && <OptionChainCard data={fno} />}
        </div>
      )}
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
