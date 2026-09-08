"use client";

import { useState } from "react";
import { parseAsArrayOf, parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";

import { LineChart } from "@/components/charts/line-chart";
import { Sparkline } from "@/components/charts/sparkline";
import { PhaseStub } from "@/components/screen/phase-stub";
import { Screen, ScreenHeader } from "@/components/screen/screen-header";
import {
  Card,
  Chip,
  DataSourceFooter,
  EmptyState,
  Row,
  Segmented,
  Skeleton,
  Table,
} from "@/components/ui";
import {
  useIndexCompare,
  useIndexConstituents,
  useIndices,
} from "@/lib/api/market-hooks";
import type { IndexRow } from "@/lib/api/market-types";
import { change, direction, pct, price } from "@/lib/format";
import { cn } from "@/lib/cn";

const CATEGORIES = ["all", "broad", "sectoral", "thematic", "strategy"] as const;
const VIEWS = ["list", "chart", "compare"] as const;
const TFS = ["1W", "1M", "3M", "6M", "1Y"] as const;

const TEMPLATE = "1.8fr 0.9fr 0.8fr 0.8fr 0.7fr 0.7fr 0.7fr 0.9fr 0.85fr";

export function IndicesClient() {
  const [category, setCategory] = useQueryState(
    "category",
    parseAsStringLiteral(CATEGORIES).withDefault("all"),
  );
  const [view, setView] = useQueryState("view", parseAsStringLiteral(VIEWS).withDefault("list"));
  const [tf, setTf] = useQueryState("tf", parseAsStringLiteral(TFS).withDefault("1M"));
  const [compareSyms, setCompareSyms] = useQueryState(
    "cmp",
    parseAsArrayOf(parseAsString).withDefault([]),
  );
  const [drawer, setDrawer] = useState<string | null>(null);

  const q = useIndices(category === "all" ? undefined : category);
  const compareQ = useIndexCompare(compareSyms, tf);
  const consQ = useIndexConstituents(drawer);

  const toggleCompare = (sym: string) =>
    setCompareSyms((cur) =>
      cur.includes(sym) ? cur.filter((s) => s !== sym) : cur.length < 5 ? [...cur, sym] : cur,
    );

  return (
    <Screen>
      <ScreenHeader
        title="Indices"
        subtitle={
          q.data
            ? `${q.data.data.count} indices · ${category === "all" ? "all categories" : category}`
            : "NSE indices — broad, sectoral, thematic, strategy."
        }
        actions={
          <div className="flex items-center gap-2">
            <Segmented options={TFS.map((t) => ({ value: t, label: t }))} value={tf} onChange={setTf} size="sm" />
            <Segmented
              options={VIEWS.map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }))}
              value={view}
              onChange={setView}
              size="sm"
            />
          </div>
        }
      />

      <div className="mb-3 flex gap-5 border-b border-border">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={cn(
              "-mb-px border-b-2 pb-2 text-[13px] capitalize",
              category === c
                ? "border-accent font-semibold text-text"
                : "border-transparent text-text-secondary hover:text-text",
            )}
          >
            {c === "all" ? "All" : c}
          </button>
        ))}
      </div>

      {q.isPending ? (
        <Skeleton className="h-96 w-full" />
      ) : q.isError ? (
        <EmptyState title="Could not load indices" description={String((q.error as Error).message)} />
      ) : q.data!.data.indices.length === 0 ? (
        <PhaseStub
          phase="Phase 6 — waiting on data"
          contents={["Run ingest_indices to populate index history, then list / chart / compare all light up."]}
        />
      ) : view === "compare" ? (
        <CompareView
          rows={q.data!.data.indices}
          selected={compareSyms}
          onToggle={toggleCompare}
          compare={compareQ}
          tf={tf}
        />
      ) : view === "chart" ? (
        <div className="grid grid-cols-2 gap-2">
          {q.data!.data.indices.map((i) => (
            <Card key={i.symbol} className="p-3">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold">{i.name}</span>
                <span className="tnum text-[13px]">{price(i.value)}</span>
                <span className={cn("tnum text-[13px]", (i.change_pct ?? 0) >= 0 ? "text-up-text" : "text-down-text")}>
                  {i.change_pct == null ? "" : pct(i.change_pct)}
                </span>
                <Chip className="ml-auto" tone="neutral">{i.category}</Chip>
              </div>
              <div className="mt-2">
                <Sparkline
                  data={i.spark}
                  width={560}
                  height={90}
                  stroke={direction(i.change_pct) === "down" ? "var(--color-down)" : "var(--color-up)"}
                />
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Table
          template={TEMPLATE}
          header={
            <>
              <div>Index</div>
              <div className="text-right">Value</div>
              <div className="text-right">%Chg</div>
              <div className="text-right">Open</div>
              <div className="text-right">1W</div>
              <div className="text-right">1M</div>
              <div className="text-right">3M</div>
              <div className="text-right">52WH</div>
              <div className="text-right">30d</div>
            </>
          }
          footer={<DataSourceFooter meta={q.data!.meta} />}
        >
          {q.data!.data.indices.map((i) => (
            <Row key={i.symbol} template={TEMPLATE} onClick={() => setDrawer(i.symbol)}>
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-[13px] font-medium">{i.name}</span>
                <Chip tone="neutral" className="shrink-0">{i.category}</Chip>
              </div>
              <div className="tnum text-right text-[13px] font-medium">{price(i.value)}</div>
              <div className={cn("tnum text-right text-[13px]", (i.change_pct ?? 0) >= 0 ? "text-up-text" : "text-down-text")}>
                {i.change_pct == null ? "—" : pct(i.change_pct)}
              </div>
              <div className="tnum text-right text-[13px] text-text-secondary">{price(i.open)}</div>
              <Ret v={i.ret_1w} />
              <Ret v={i.ret_1m} />
              <Ret v={i.ret_3m} />
              <div className="tnum text-right text-[13px] text-text-secondary">
                {i.dist_52w_high_pct == null ? "—" : pct(i.dist_52w_high_pct, 1)}
              </div>
              <div className="flex justify-end">
                <Sparkline
                  data={i.spark}
                  width={76}
                  height={20}
                  stroke={direction(i.change_pct) === "down" ? "var(--color-down)" : "var(--color-up)"}
                />
              </div>
            </Row>
          ))}
        </Table>
      )}

      {/* Constituents drawer */}
      {drawer && (
        <div className="fixed bottom-0 right-0 top-[var(--shell-topbar-h)] z-50 flex w-[460px] flex-col border-l border-border bg-surface shadow-[-8px_0_24px_rgba(9,9,11,0.06)]">
          <div className="flex items-start gap-2 border-b border-border p-4">
            <div>
              <div className="text-[15px] font-semibold">{consQ.data?.data.name ?? drawer}</div>
              <div className="mt-0.5 text-[11px] text-text-muted">
                {consQ.data?.data.constituents.length ?? 0} constituents · by point contribution
                {consQ.data?.data.weights_estimated ? " (equal-weight est.)" : ""}
              </div>
            </div>
            <button
              onClick={() => setDrawer(null)}
              className="ml-auto rounded-md px-2 py-1 text-text-secondary hover:bg-surface-2"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-auto">
            {consQ.isPending ? (
              <div className="p-4">
                <Skeleton className="h-64 w-full" />
              </div>
            ) : consQ.data?.data.constituents.length ? (
              <div className="grid grid-cols-[1.6fr_0.9fr_0.7fr_0.7fr] gap-2 px-4 py-2 text-[11px] text-text-muted">
                <span>Symbol</span>
                <span className="text-right">LTP</span>
                <span className="text-right">%Chg</span>
                <span className="text-right">Points</span>
                {consQ.data.data.constituents.map((c) => (
                  <div key={c.symbol} className="col-span-4 grid grid-cols-[1.6fr_0.9fr_0.7fr_0.7fr] gap-2 border-t border-border py-2 text-[13px]">
                    <span className="truncate font-medium">{c.symbol}</span>
                    <span className="tnum text-right">{price(c.ltp)}</span>
                    <span className={cn("tnum text-right", (c.change_pct ?? 0) >= 0 ? "text-up-text" : "text-down-text")}>
                      {c.change_pct == null ? "—" : pct(c.change_pct)}
                    </span>
                    <span className={cn("tnum text-right font-medium", (c.points ?? 0) >= 0 ? "text-up-text" : "text-down-text")}>
                      {c.points == null ? "—" : change(c.points, 2)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="p-4 text-[13px] text-text-muted">
                Constituent membership for this index isn&apos;t available yet (only sectoral indices are mapped).
              </p>
            )}
          </div>
        </div>
      )}
    </Screen>
  );
}

function Ret({ v }: { v: number | null }) {
  return (
    <div className={cn("tnum text-right text-[13px]", (v ?? 0) >= 0 ? "text-up-text" : "text-down-text")}>
      {v == null ? "—" : pct(v, 1)}
    </div>
  );
}

const COMPARE_COLORS = ["#2563EB", "#16A34A", "#D97706", "#7C3AED", "#DC2626"];

function CompareView({
  rows,
  selected,
  onToggle,
  compare,
  tf,
}: {
  rows: IndexRow[];
  selected: string[];
  onToggle: (s: string) => void;
  compare: ReturnType<typeof useIndexCompare>;
  tf: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Card className="p-4">
        <div className="mb-2 text-[13px] font-semibold">
          Pick 2–5 indices to overlay ({selected.length}/5) · normalized to 100 · {tf}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {rows.map((i) => (
            <button
              key={i.symbol}
              onClick={() => onToggle(i.symbol)}
              className={cn(
                "rounded-md border px-2 py-1 text-[11px] font-medium",
                selected.includes(i.symbol)
                  ? "border-[var(--color-accent-border)] bg-[var(--color-accent-tint-2)] text-text"
                  : "border-border bg-surface-2 text-text-secondary",
              )}
            >
              {i.name}
            </button>
          ))}
        </div>
      </Card>

      {selected.length < 2 ? (
        <EmptyState title="Select at least two indices" description="Click the chips above to build a comparison." />
      ) : compare.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : compare.data && compare.data.data.series.length ? (
        <Card className="p-4">
          <LineChart
            height={320}
            showZero100
            series={compare.data.data.series.map((s, idx) => ({
              name: s.name,
              color: COMPARE_COLORS[idx % COMPARE_COLORS.length],
              values: s.normalized,
            }))}
          />
          <div className="mt-3 flex flex-wrap gap-4 border-t border-border pt-3">
            {compare.data.data.series.map((s, idx) => (
              <div key={s.symbol} className="flex items-center gap-2 text-[13px]">
                <span className="h-2 w-4 rounded-sm" style={{ background: COMPARE_COLORS[idx % COMPARE_COLORS.length] }} />
                <span>{s.name}</span>
                <span className={cn("tnum font-medium", s.return_pct >= 0 ? "text-up-text" : "text-down-text")}>
                  {pct(s.return_pct, 1)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <EmptyState title="Not enough history to compare" description="These indices don't have overlapping data yet." />
      )}
    </div>
  );
}
