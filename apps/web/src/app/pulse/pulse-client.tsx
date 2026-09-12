"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { BreadthDonut } from "@/components/charts/breadth-donut";
import { FlowBars } from "@/components/charts/flow-bars";
import { Sparkline } from "@/components/charts/sparkline";
import { Screen, ScreenHeader } from "@/components/screen/screen-header";
import { Button, Card, DataSourceFooter, EmptyState, Skeleton, Tooltip } from "@/components/ui";
import { useMarketPulse } from "@/lib/api/market-hooks";
import type { ActiveRow, Breadth, BreakoutRow, Flows } from "@/lib/api/market-types";
import { cn } from "@/lib/cn";
import { change, count, direction, pct, pctPlain, price, ratio } from "@/lib/format";
import { safeGridCols } from "@/lib/grid";
import { toSlug } from "@/lib/slug";
import { type Tone, TONE_BOX } from "@/lib/tone";

const UP = "var(--color-up)";
const DOWN = "var(--color-down)";

const VIX_TONE: Record<string, { bg: string; bd: string; fg: string }> = {
  low: TONE_BOX.up,
  moderate: TONE_BOX.neutral,
  elevated: { bg: "rgba(217,119,6,0.08)", bd: "rgba(217,119,6,0.28)", fg: "text-stale-text" },
  high: TONE_BOX.down,
};
// Same thresholds as jobs/config.py VIX_BANDS — mirrored here so the gauge lines up
// with the verdict the backend already computed.
const VIX_BANDS = [
  { key: "low", to: 13, color: "var(--color-up)" },
  { key: "moderate", to: 18, color: "var(--color-info)" },
  { key: "elevated", to: 24, color: "var(--color-stale)" },
  { key: "high", to: 32, color: "var(--color-down)" },
] as const;
const VIX_SCALE_MAX = 32;

function toneClass(v: number | null | undefined) {
  const d = direction(v);
  return d === "up" ? "text-up-text" : d === "down" ? "text-down-text" : "text-text-secondary";
}

/** Plain-English read on breadth — the raw advance/decline count doesn't say who's
 * winning at a glance, so translate it into one of five calls. */
function breadthVerdict(b: Breadth): { label: string; note: string; tone: Tone } {
  const r = b.ad_ratio ?? (b.declines > 0 ? b.advances / b.declines : null);
  if (r == null) return { label: "No read", tone: "neutral", note: "Not enough data to call breadth today." };
  if (r >= 1.5)
    return {
      label: "Broad strength",
      tone: "up",
      note: `${count(b.advances)} stocks rising vs ${count(b.declines)} falling — buyers in control across the board.`,
    };
  if (r >= 1.1)
    return { label: "Mildly positive", tone: "up", note: "More stocks rising than falling, but not a broad rally." };
  if (r <= 0.67)
    return {
      label: "Broad weakness",
      tone: "down",
      note: `${count(b.declines)} stocks falling vs ${count(b.advances)} rising — sellers in control across the board.`,
    };
  if (r <= 0.9)
    return { label: "Mildly negative", tone: "down", note: "More stocks falling than rising — caution on new longs." };
  return { label: "Mixed / range-bound", tone: "neutral", note: "Rising and falling stocks roughly balanced — no clear direction today." };
}

/** Same idea for FII/DII — the number alone doesn't say whether the two are pulling
 * together or offsetting each other, which is the actually useful read. */
function flowVerdict(flows: Flows): { label: string; note: string; tone: Tone } | null {
  const last = flows.series.at(-1);
  if (!last || (last.fii_net == null && last.dii_net == null)) return null;
  const fii = last.fii_net ?? 0;
  const dii = last.dii_net ?? 0;
  const net = fii + dii;
  const netStr = `${net >= 0 ? "+" : "−"}${Math.abs(Math.round(net)).toLocaleString("en-IN")} cr`;
  const agree = (fii >= 0) === (dii >= 0);
  if (agree) {
    return net >= 0
      ? { label: "Broad institutional buying", tone: "up", note: `FII and DII both net buyers today — combined ${netStr}.` }
      : { label: "Broad institutional selling", tone: "down", note: `FII and DII both net sellers today — combined ${netStr}.` };
  }
  if (fii < 0 && dii > 0)
    return {
      label: "DII cushioning FII selling",
      tone: net >= 0 ? "up" : "neutral",
      note: `FII sold ${Math.abs(Math.round(fii)).toLocaleString("en-IN")} cr, DII bought ${Math.round(dii).toLocaleString("en-IN")} cr — domestic buying offsetting foreign outflows.`,
    };
  return {
    label: "FII buying against DII selling",
    tone: net >= 0 ? "up" : "neutral",
    note: `FII bought ${Math.round(fii).toLocaleString("en-IN")} cr, DII sold ${Math.abs(Math.round(dii)).toLocaleString("en-IN")} cr.`,
  };
}

export function PulseClient() {
  const q = useMarketPulse();

  if (q.isPending) {
    return (
      <Screen>
        <ScreenHeader title="Market Pulse" subtitle="Post-close read on breadth, flows and volatility." />
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <div className="mt-6 grid grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)_minmax(0,1fr)]">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </Screen>
    );
  }

  if (q.isError) {
    return (
      <Screen>
        <ScreenHeader title="Market Pulse" />
        <EmptyState
          title="Could not load Market Pulse"
          description={String((q.error as Error).message)}
          actions={<Button onClick={() => q.refetch()}>Retry</Button>}
        />
      </Screen>
    );
  }

  const d = q.data!.data;
  const meta = q.data!.meta;
  const degraded = meta.degraded_sources ?? [];

  return (
    <Screen>
      <ScreenHeader
        title="Market Pulse"
        subtitle={`Close of ${d.as_of} · breadth, flows and volatility at a glance.`}
      />

      {degraded.length > 0 && (
        <div className="mb-3 rounded-md border border-[rgba(217,119,6,0.35)] bg-stale-bg px-3 py-2 text-[11px] text-stale-text">
          Some sources failed in the last run: {degraded.join(", ")}. Those cards may be
          missing or behind.
        </div>
      )}

      {/* Index tiles — click any to open its chart */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {d.tiles.map((t) => (
          <Link
            key={t.symbol}
            href={`/chart/${toSlug(t.symbol)}`}
            className="group rounded-lg border border-border bg-surface p-4 transition-colors hover:border-accent"
          >
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold tracking-wide text-text-secondary">
                {t.symbol}
              </span>
              <ArrowUpRight
                size={12}
                className="text-text-faint opacity-0 transition-opacity group-hover:opacity-100"
              />
            </div>
            <div className="mt-2 flex items-end justify-between gap-3">
              <div>
                <div className="tnum text-[20px] font-semibold tracking-tight">{price(t.value)}</div>
                <div className={cn("tnum mt-1 flex gap-2 text-[13px]", toneClass(t.change_pct))}>
                  <span>{t.change == null ? "—" : change(t.change)}</span>
                  <span className="opacity-75">{t.change_pct == null ? "" : pct(t.change_pct)}</span>
                </div>
              </div>
              <Sparkline data={t.spark} stroke={direction(t.change_pct) === "down" ? DOWN : UP} />
            </div>
            <div className="mt-2.5 border-t border-border pt-2 font-mono text-[11px] text-text-faint">
              {t.spark.length}d · NSE index feed
            </div>
          </Link>
        ))}
      </div>

      {/* Breadth · Flows · Volatility */}
      <div className="mt-2 grid grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)_minmax(0,1fr)]">
        <Card className="flex flex-col p-4">
          <div className="flex items-center justify-between">
            <div className="text-[13px] font-semibold">Market breadth</div>
            <Tooltip content="How many stocks rose vs. fell today across the whole exchange — a read on whether the rally (or fall) is broad or narrow.">
              <span className="text-[11px] text-text-muted">what&apos;s this?</span>
            </Tooltip>
          </div>
          {d.breadth ? (
            <>
              {(() => {
                const v = breadthVerdict(d.breadth);
                const t = TONE_BOX[v.tone];
                return (
                  <div className="mt-3 rounded-md border px-3 py-2.5" style={{ background: t.bg, borderColor: t.bd }}>
                    <div className={cn("text-[13px] font-medium", t.fg)}>{v.label}</div>
                    <div className="mt-1 text-[11px] leading-relaxed text-text-secondary">{v.note}</div>
                  </div>
                );
              })()}
              <div className="mt-3 flex items-center gap-5">
                <BreadthDonut
                  advances={d.breadth.advances}
                  declines={d.breadth.declines}
                  unchanged={d.breadth.unchanged}
                />
                <div className="flex flex-1 flex-col gap-2.5">
                  {[
                    { label: "Rising", v: d.breadth.advances, c: UP },
                    { label: "Falling", v: d.breadth.declines, c: DOWN },
                    { label: "Flat", v: d.breadth.unchanged, c: "var(--color-text-faint)" },
                  ].map((r) => (
                    <div key={r.label} className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-sm" style={{ background: r.c }} />
                      <span className="text-[13px] text-text-secondary">{r.label}</span>
                      <span className="tnum ml-auto text-[13px] font-medium">{count(r.v)}</span>
                    </div>
                  ))}
                  <div className="mt-1 border-t border-border pt-2 text-[11px] text-text-muted">
                    {count(d.breadth.traded)} traded
                  </div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Stat label="Above 50 DMA" value={pctPlain(d.breadth.pct_above_50dma, 1)} />
                <Stat label="Above 200 DMA" value={pctPlain(d.breadth.pct_above_200dma, 1)} />
                <Stat label="New 52w highs" value={count(d.breadth.new_52w_highs)} tone="up" />
                <Stat label="New 52w lows" value={count(d.breadth.new_52w_lows)} tone="down" />
              </div>
            </>
          ) : (
            <p className="mt-4 text-[13px] text-text-muted">Breadth not computed in the last run.</p>
          )}
          <div className="mt-auto pt-3">
            <DataSourceFooter meta={meta} />
          </div>
        </Card>

        <Card className="flex flex-col p-4">
          <div className="flex items-center justify-between">
            <div className="text-[13px] font-semibold">
              FII / DII flow · last {d.flows.series.length} session
              {d.flows.series.length === 1 ? "" : "s"}
            </div>
            <div className="flex gap-3 text-[11px] text-text-secondary">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-[var(--color-info)]" />
                FII net
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-accent" />
                DII net
              </span>
              <span className="text-text-muted">₹ cr</span>
            </div>
          </div>
          {d.flows.series.length ? (
            <>
              {(() => {
                const v = flowVerdict(d.flows);
                if (!v) return null;
                const t = TONE_BOX[v.tone];
                return (
                  <div className="mt-3 rounded-md border px-3 py-2.5" style={{ background: t.bg, borderColor: t.bd }}>
                    <div className={cn("text-[13px] font-medium", t.fg)}>{v.label}</div>
                    <div className="mt-1 text-[11px] leading-relaxed text-text-secondary">{v.note}</div>
                  </div>
                );
              })()}
              <div className="mt-3">
                <FlowBars series={d.flows.series} />
              </div>
              <div className="mt-2 flex gap-2">
                <FlowTile label={`FII net · ${d.flows.series.length}d`} v={d.flows.fii_10_session_net} />
                <FlowTile label={`DII net · ${d.flows.series.length}d`} v={d.flows.dii_10_session_net} />
              </div>
              <div className="mt-2 font-mono text-[11px] text-text-faint">
                history builds up one session per nightly run
              </div>
            </>
          ) : (
            <p className="mt-4 text-[13px] text-text-muted">FII/DII flows unavailable.</p>
          )}
        </Card>

        <Card className="flex flex-col p-4">
          <div className="flex items-center justify-between">
            <div className="text-[13px] font-semibold">Volatility</div>
            <Tooltip content="INDIA VIX — how much traders expect the market to swing over the next month. Higher = bigger expected moves.">
              <span className="text-[11px] text-text-muted">what&apos;s this?</span>
            </Tooltip>
          </div>
          {d.vix ? (
            <>
              <div className="mt-3 flex items-end gap-2">
                <span className="tnum text-[32px] font-semibold leading-none tracking-tight">
                  {d.vix.value.toFixed(2)}
                </span>
                {/* rising volatility is the bad direction, so the colour is inverted here */}
                <span
                  className={cn(
                    "tnum pb-1 text-[13px]",
                    direction(d.vix.change_pct) === "up" ? "text-down-text" : "text-up-text",
                  )}
                >
                  {d.vix.change_pct == null ? "" : pct(d.vix.change_pct)}
                </span>
              </div>

              <VixGauge value={d.vix.value} percentile={d.vix.percentile_250d} />

              <div
                className="mt-3 rounded-md border px-3 py-2.5"
                style={{
                  background: VIX_TONE[d.vix.band]?.bg,
                  borderColor: VIX_TONE[d.vix.band]?.bd,
                }}
              >
                <div className={cn("text-[13px] font-medium", VIX_TONE[d.vix.band]?.fg)}>
                  {d.vix.verdict}
                </div>
                <div className="mt-1 text-[11px] leading-relaxed text-text-secondary">{d.vix.advice}</div>
              </div>
            </>
          ) : (
            <p className="mt-4 text-[13px] text-text-muted">INDIA VIX unavailable.</p>
          )}
          <div className="mt-auto pt-3 font-mono text-[11px] text-text-faint">
            source: NSE INDIA VIX
          </div>
        </Card>
      </div>

      {/* Movers */}
      <div className="mt-2 grid grid-cols-1 gap-2 lg:grid-cols-2">
        <MoversTable
          title="Most active by value"
          subtitle="Turnover, cash segment"
          metricLabel="Value ₹cr"
          rows={d.most_active}
          metric={(r) => (r as ActiveRow).turnover_cr.toLocaleString("en-IN")}
          empty="No turnover data for this session."
        />
        <MoversTable
          title="52-week high breakouts"
          subtitle="Closed at a 52-week high on above-average volume"
          metricLabel="Vol ratio"
          rows={d.breakouts_52w}
          metric={(r) => ratio((r as BreakoutRow).vol_ratio)}
          empty="No breakouts cleared the volume filter today."
        />
      </div>
    </Screen>
  );
}

/** Where today's VIX sits on the calm-to-panic scale — the number alone doesn't convey
 * that, so show it against the same low/moderate/elevated/high bands the verdict uses. */
function VixGauge({ value, percentile }: { value: number; percentile: number | null }) {
  const markerPct = Math.min(100, Math.max(0, (value / VIX_SCALE_MAX) * 100));
  let from = 0;
  return (
    <div className="mt-3">
      <div className="relative flex h-2 overflow-hidden rounded-full">
        {VIX_BANDS.map((b) => {
          const to = Math.min(b.to, VIX_SCALE_MAX);
          const width = ((to - from) / VIX_SCALE_MAX) * 100;
          from = to;
          return <div key={b.key} style={{ width: `${width}%`, background: b.color }} />;
        })}
        <div
          className="absolute top-1/2 h-3 w-3 -translate-y-1/2 -translate-x-1/2 rounded-full border-2 border-white shadow"
          style={{ left: `${markerPct}%`, background: "var(--color-text)" }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-text-faint">
        <span>Calm</span>
        <span>Panic</span>
      </div>
      {percentile != null && (
        <div className="mt-1 text-[11px] text-text-muted">
          {percentile >= 50 ? "Choppier" : "Calmer"} than{" "}
          <span className="tnum font-medium text-text-secondary">
            {(percentile >= 50 ? percentile : 100 - percentile).toFixed(0)}%
          </span>{" "}
          of the last year
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  return (
    <div className="rounded-md bg-surface-2 px-2.5 py-2">
      <div className="text-[11px] text-text-muted">{label}</div>
      <div
        className={cn(
          "tnum mt-0.5 text-[13px] font-medium",
          tone === "up" ? "text-up-text" : tone === "down" ? "text-down-text" : "",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function FlowTile({ label, v }: { label: string; v: number | null }) {
  return (
    <div className="flex-1 rounded-md bg-surface-2 px-2.5 py-2">
      <div className="text-[11px] text-text-muted">{label}</div>
      <div className={cn("tnum mt-0.5 text-[15px] font-semibold", toneClass(v))}>
        {v == null ? "—" : `${v >= 0 ? "+" : "−"}${Math.abs(v).toLocaleString("en-IN")}`}
      </div>
    </div>
  );
}

function MoversTable<T extends ActiveRow | BreakoutRow>({
  title,
  subtitle,
  metricLabel,
  rows,
  metric,
  empty,
}: {
  title: string;
  subtitle: string;
  metricLabel: string;
  rows: T[];
  metric: (r: T) => string;
  empty: string;
}) {
  const template = "1.6fr 0.8fr 0.7fr 1fr";
  return (
    <Card className="overflow-hidden">
      <div className="p-4 pb-3">
        <div className="text-[13px] font-semibold">{title}</div>
        <div className="mt-0.5 text-[11px] text-text-muted">{subtitle}</div>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[420px]">
          <div
            className="grid gap-2 border-b border-border px-4 pb-1.5 text-[11px] text-text-muted"
            style={{ gridTemplateColumns: safeGridCols(template) }}
          >
            <span>Symbol</span>
            <span className="text-right">LTP</span>
            <span className="text-right">%Chg</span>
            <span className="text-right">{metricLabel}</span>
          </div>
          {rows.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-text-muted">{empty}</p>
          ) : (
            rows.map((r) => (
              <Link
                key={r.symbol}
                href={`/chart/${toSlug(r.symbol)}`}
                className="tnum grid items-center gap-2 border-b border-border px-4 py-2 last:border-0 hover:bg-surface-2"
                style={{ gridTemplateColumns: safeGridCols(template) }}
              >
                <div className="min-w-0">
                  <div className="text-[13px] font-medium">{r.symbol}</div>
                  <div className="truncate text-[11px] text-text-muted">{r.name}</div>
                </div>
                <span className="text-right text-[13px]">{price(r.ltp)}</span>
                <span className={cn("text-right text-[13px]", toneClass(r.change_pct))}>
                  {r.change_pct == null ? "—" : pct(r.change_pct)}
                </span>
                <span className="text-right text-[13px] text-text-secondary">{metric(r)}</span>
              </Link>
            ))
          )}
        </div>
      </div>
    </Card>
  );
}
