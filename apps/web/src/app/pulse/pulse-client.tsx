"use client";

import { BreadthDonut } from "@/components/charts/breadth-donut";
import { FlowBars } from "@/components/charts/flow-bars";
import { Sparkline } from "@/components/charts/sparkline";
import { PhaseStub } from "@/components/screen/phase-stub";
import { Screen, ScreenHeader } from "@/components/screen/screen-header";
import { Card, DataSourceFooter, EmptyState, Skeleton, Tooltip } from "@/components/ui";
import { useMarketPulse } from "@/lib/api/market-hooks";
import { change, count, direction, inrCompact, pct, pctPlain, price } from "@/lib/format";
import { cn } from "@/lib/cn";

const UP = "var(--color-up)";
const DOWN = "var(--color-down)";

export function PulseClient() {
  const q = useMarketPulse();

  if (q.isPending) {
    return (
      <Screen>
        <ScreenHeader title="Market Pulse" subtitle="Post-close read on breadth, flows and volatility." />
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </Screen>
    );
  }
  if (q.isError) {
    return (
      <Screen>
        <EmptyState title="Could not load Market Pulse" description={String((q.error as Error).message)} />
      </Screen>
    );
  }

  const d = q.data!.data;
  const hasData = d.tiles.length > 0 || d.breadth || d.vix;

  return (
    <Screen>
      <ScreenHeader title="Market Pulse" subtitle="Post-close read on breadth, flows and volatility." />

      {!hasData ? (
        <PhaseStub
          phase="Phase 6 — waiting on data"
          contents={[
            "Run the pipeline: ingest_indices → ingest_bhavcopy → ingest_fii_dii → compute_indicators → compute_breadth",
            "Then this screen shows index tiles, the breadth donut, FII/DII flows and the VIX regime gauge with live data.",
          ]}
        />
      ) : (
        <div className="flex flex-col gap-6">
          {/* Index tiles */}
          <div className="grid grid-cols-4 gap-2">
            {d.tiles.map((t) => {
              const dir = direction(t.change_pct);
              return (
                <Card key={t.symbol} className="p-4">
                  <div className="text-[11px] font-semibold tracking-wide text-text-secondary">{t.symbol}</div>
                  <div className="mt-2 flex items-end justify-between gap-3">
                    <div>
                      <div className="tnum text-[20px] font-semibold tracking-tight">{price(t.value)}</div>
                      <div
                        className={cn(
                          "tnum mt-1 flex gap-2 text-[13px]",
                          dir === "up" ? "text-up-text" : dir === "down" ? "text-down-text" : "text-text-secondary",
                        )}
                      >
                        <span>{t.change == null ? "—" : change(t.change)}</span>
                        <span className="opacity-75">{t.change_pct == null ? "" : pct(t.change_pct)}</span>
                      </div>
                    </div>
                    <Sparkline data={t.spark} stroke={dir === "down" ? DOWN : UP} />
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Breadth · Flows · Volatility */}
          <div className="grid grid-cols-[1fr_1.35fr_1fr] gap-2">
            <Card className="flex flex-col p-4">
              <div className="flex items-center justify-between">
                <div className="text-[13px] font-semibold">Market breadth</div>
                {d.breadth?.ad_ratio != null && (
                  <Tooltip content="Advances ÷ declines across all NSE equities that traded today.">
                    <span className="text-[11px] text-text-muted">A/D {d.breadth.ad_ratio}</span>
                  </Tooltip>
                )}
              </div>
              {d.breadth ? (
                <div className="mt-4 flex items-center gap-5">
                  <BreadthDonut
                    advances={d.breadth.advances}
                    declines={d.breadth.declines}
                    unchanged={d.breadth.unchanged}
                  />
                  <div className="flex flex-1 flex-col gap-2.5">
                    {[
                      { label: "Advances", v: d.breadth.advances, c: UP },
                      { label: "Declines", v: d.breadth.declines, c: DOWN },
                      { label: "Unchanged", v: d.breadth.unchanged, c: "var(--color-text-faint)" },
                    ].map((r) => (
                      <div key={r.label} className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-sm" style={{ background: r.c }} />
                        <span className="text-[13px] text-text-secondary">{r.label}</span>
                        <span className="tnum ml-auto text-[13px] font-medium">{count(r.v)}</span>
                      </div>
                    ))}
                    <div className="mt-1 border-t border-border pt-2 text-[11px] text-text-muted">
                      {count(d.breadth.traded)} traded · {pctPlain(d.breadth.pct_above_50dma, 0)} &gt; 50 DMA
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-[13px] text-text-muted">Breadth not computed yet.</p>
              )}
              <div className="mt-auto pt-3">
                <DataSourceFooter meta={q.data!.meta} />
              </div>
            </Card>

            <Card className="flex flex-col p-4">
              <div className="flex items-center justify-between">
                <div className="text-[13px] font-semibold">FII / DII flow · last {d.flows.series.length} sessions</div>
                <div className="flex gap-3 text-[11px] text-text-secondary">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm bg-[var(--color-info)]" />FII net
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm bg-accent" />DII net
                  </span>
                  <span className="text-text-muted">₹ cr</span>
                </div>
              </div>
              {d.flows.series.length ? (
                <>
                  <div className="mt-3">
                    <FlowBars series={d.flows.series} />
                  </div>
                  <div className="mt-2 flex gap-2">
                    <FlowTile label="FII 10-session net" v={d.flows.fii_10_session_net} />
                    <FlowTile label="DII 10-session net" v={d.flows.dii_10_session_net} />
                  </div>
                </>
              ) : (
                <p className="mt-4 text-[13px] text-text-muted">FII/DII flows not ingested yet.</p>
              )}
            </Card>

            <Card className="flex flex-col p-4">
              <div className="text-[13px] font-semibold">Volatility</div>
              {d.vix ? (
                <>
                  <div className="mt-3 flex items-end gap-2">
                    <span className="tnum text-[32px] font-semibold leading-none tracking-tight">
                      {d.vix.value.toFixed(2)}
                    </span>
                    <span
                      className={cn(
                        "tnum pb-1 text-[13px]",
                        direction(d.vix.change_pct) === "up" ? "text-down-text" : "text-up-text",
                      )}
                    >
                      {d.vix.change_pct == null ? "" : pct(d.vix.change_pct)}
                    </span>
                  </div>
                  {d.vix.percentile_250d != null && (
                    <div className="mt-1 text-[11px] text-text-muted">
                      {d.vix.percentile_250d.toFixed(0)}th percentile over 250 sessions
                    </div>
                  )}
                  <div className="mt-4 rounded-md border border-[rgba(22,163,74,0.22)] bg-[rgba(22,163,74,0.07)] px-3 py-2.5">
                    <div className="text-[13px] font-medium text-up-text">{d.vix.verdict}</div>
                    <div className="mt-1 text-[11px] leading-relaxed text-text-secondary">{d.vix.advice}</div>
                  </div>
                </>
              ) : (
                <p className="mt-4 text-[13px] text-text-muted">INDIA VIX not ingested yet.</p>
              )}
            </Card>
          </div>
        </div>
      )}
    </Screen>
  );
}

function FlowTile({ label, v }: { label: string; v: number | null }) {
  return (
    <div className="flex-1 rounded-md bg-surface-2 px-2.5 py-2">
      <div className="text-[11px] text-text-muted">{label}</div>
      <div
        className={cn(
          "tnum mt-0.5 text-[15px] font-semibold",
          direction(v) === "up" ? "text-up-text" : direction(v) === "down" ? "text-down-text" : "",
        )}
      >
        {v == null ? "—" : inrCompact(v * 1e7)}
      </div>
    </div>
  );
}
