"use client";

import { useRouter } from "next/navigation";
import { parseAsStringLiteral, useQueryState } from "nuqs";

import { RrgScatter } from "@/components/charts/rrg-scatter";
import { PhaseStub } from "@/components/screen/phase-stub";
import { Screen, ScreenHeader } from "@/components/screen/screen-header";
import { Card, DataSourceFooter, EmptyState, Segmented, Skeleton } from "@/components/ui";
import { useSectorRotation } from "@/lib/api/market-hooks";
import type { HeatmapCell } from "@/lib/api/market-types";
import { cn } from "@/lib/cn";
import { pct } from "@/lib/format";

const TFS = ["1W", "1M", "3M", "6M"] as const;

function heatStyle(r: number | null): { background: string; color: string } {
  if (r == null) return { background: "var(--color-surface-2)", color: "var(--color-text-secondary)" };
  const t = Math.max(-1, Math.min(1, r / 8));
  return t >= 0
    ? { background: `rgba(22,163,74,${(0.08 + t * 0.26).toFixed(3)})`, color: "var(--color-up-text)" }
    : { background: `rgba(220,38,38,${(0.08 + -t * 0.26).toFixed(3)})`, color: "var(--color-down-text)" };
}

export function SectorsClient() {
  const router = useRouter();
  const [tf, setTf] = useQueryState("tf", parseAsStringLiteral(TFS).withDefault("1M"));
  const q = useSectorRotation(tf);

  const goScreener = (slug: string) => router.push(`/screener?sector=${slug}`);

  if (q.isPending) {
    return (
      <Screen>
        <ScreenHeader title="Sector Rotation" subtitle="Where capital is rotating." />
        <Skeleton className="h-96 w-full" />
      </Screen>
    );
  }
  if (q.isError) {
    return (
      <Screen>
        <EmptyState title="Could not load sector rotation" description={String((q.error as Error).message)} />
      </Screen>
    );
  }

  const d = q.data!.data;
  const cellSizes = sizeCells(d.sectors);

  return (
    <Screen>
      <ScreenHeader
        title="Sector Rotation"
        subtitle="Where capital is rotating into and out of, and which sectors have slipped."
        actions={
          <Segmented
            options={TFS.map((t) => ({ value: t, label: t }))}
            value={tf}
            onChange={setTf}
            size="sm"
          />
        }
      />

      {d.sectors.length === 0 ? (
        <PhaseStub
          phase="Phase 6 — waiting on data"
          contents={["Run ingest_indices to populate sectoral index history, then this screen fills in."]}
        />
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            {/* Heatmap */}
            <Card className="min-w-0 flex-1 p-4">
              <div className="mb-3 flex items-center justify-between text-[13px] font-semibold">
                <span>Heatmap · cell size = constituent count, colour = {tf} return</span>
                <span className="font-mono text-[11px] text-text-muted">−8% ▬▬▬ +8%</span>
              </div>
              <div className="grid auto-rows-[104px] grid-cols-6 gap-1">
                {d.sectors.map((s) => {
                  const st = heatStyle(s.return_tf);
                  return (
                    <button
                      key={s.slug}
                      onClick={() => goScreener(s.slug)}
                      className="flex flex-col rounded-lg border border-border p-3 text-left transition-colors hover:border-accent"
                      style={{ background: st.background, gridColumn: `span ${cellSizes[s.slug]}` }}
                    >
                      <div className="text-[13px] font-medium leading-tight">{s.name}</div>
                      <div className="tnum mt-auto text-[20px] font-semibold tracking-tight" style={{ color: st.color }}>
                        {s.return_tf == null ? "—" : pct(s.return_tf, 1)}
                      </div>
                      <div className="text-[11px] text-text-secondary">
                        {s.constituents} stocks{s.advancers != null ? ` · ${s.advancers} adv` : ""}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 border-t border-border pt-2">
                <DataSourceFooter meta={q.data!.meta} />
              </div>
            </Card>

            {/* Ranked rail */}
            <Card className="w-[320px] flex-none p-0">
              <div className="p-4 pb-2">
                <div className="text-[13px] font-semibold">Ranked by momentum</div>
                <div className="mt-0.5 text-[11px] text-text-muted">Arrow = rank change vs ~3 weeks ago</div>
              </div>
              <div className="grid grid-cols-[20px_1fr_56px_56px_32px] gap-2 border-b border-border px-4 pb-1.5 text-[11px] text-text-muted">
                <span>#</span>
                <span>Sector</span>
                <span className="text-right">{tf}</span>
                <span className="text-right">3M</span>
                <span className="text-right">Δ</span>
              </div>
              {d.ranked.map((r) => (
                <button
                  key={r.slug}
                  onClick={() => goScreener(r.slug)}
                  className="tnum grid w-full grid-cols-[20px_1fr_56px_56px_32px] items-center gap-2 border-b border-border px-4 py-2 text-left last:border-0 hover:bg-surface-2"
                >
                  <span className="font-mono text-[11px] text-text-muted">{r.rank}</span>
                  <span className="truncate text-[13px]">{r.name}</span>
                  <span className={cn("text-right text-[13px]", (r.return_tf ?? 0) >= 0 ? "text-up-text" : "text-down-text")}>
                    {r.return_tf == null ? "—" : pct(r.return_tf, 1)}
                  </span>
                  <span className={cn("text-right text-[13px]", (r.return_3m ?? 0) >= 0 ? "text-up-text" : "text-down-text")}>
                    {r.return_3m == null ? "—" : pct(r.return_3m, 1)}
                  </span>
                  <span
                    className={cn(
                      "text-right text-[11px] font-medium",
                      r.rank_change == null || r.rank_change === 0
                        ? "text-text-muted"
                        : r.rank_change > 0
                          ? "text-up-text"
                          : "text-down-text",
                    )}
                  >
                    {r.rank_change == null || r.rank_change === 0
                      ? "—"
                      : r.rank_change > 0
                        ? `▲${r.rank_change}`
                        : `▼${Math.abs(r.rank_change)}`}
                  </span>
                </button>
              ))}
            </Card>
          </div>

          {/* RRG */}
          <Card className="p-4">
            <div className="mb-1 text-[13px] font-semibold">Relative rotation · sector vs NIFTY 500</div>
            <div className="mb-2 text-[11px] text-text-muted">
              Tails show the last few weekly readings — direction matters more than position.
            </div>
            {d.rrg.length ? (
              <RrgScatter points={d.rrg} />
            ) : (
              <p className="py-8 text-center text-[13px] text-text-muted">
                Not enough index history for the RRG yet (needs ~6 months).
              </p>
            )}
          </Card>
        </div>
      )}
    </Screen>
  );
}

/** Map constituent counts to a 1–3 column span for the treemap-ish grid. */
function sizeCells(cells: HeatmapCell[]): Record<string, number> {
  const max = Math.max(1, ...cells.map((c) => c.constituents));
  const out: Record<string, number> = {};
  for (const c of cells) {
    const ratio = c.constituents / max;
    out[c.slug] = ratio > 0.66 ? 3 : ratio > 0.33 ? 2 : 1;
  }
  return out;
}
