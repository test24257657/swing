"use client";

import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Screen, ScreenHeader } from "@/components/screen/screen-header";
import { Button, Card, Chip, DataSourceFooter, EmptyState, Segmented, Skeleton } from "@/components/ui";
import { useInstitutional } from "@/lib/api/market-hooks";
import type { DealRow, MoneyFlowPick } from "@/lib/api/market-types";
import { cn } from "@/lib/cn";
import { count, inrCompact, price } from "@/lib/format";
import { safeGridCols } from "@/lib/grid";
import { toSlug } from "@/lib/slug";

const DEAL_KINDS = [
  { value: "all", label: "Both" },
  { value: "Bulk", label: "Bulk" },
  { value: "Block", label: "Block" },
] as const;

const DEALS_PAGE_SIZE = 15;
type DealSortColumn = "symbol" | "qty" | "price" | "value";
type SortDir = "asc" | "desc";
const DEAL_COLUMNS: { key: DealSortColumn; label: string; align: "left" | "right" }[] = [
  { key: "symbol", label: "Symbol", align: "left" },
  { key: "qty", label: "Quantity", align: "right" },
  { key: "price", label: "Price", align: "right" },
  { key: "value", label: "Deal value", align: "right" },
];
const DEALS_GRID = "72px 1fr 1.6fr 60px 60px 0.9fr 0.8fr 0.9fr";

function dealDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

const PARTICIPANT_COLOR: Record<string, string> = {
  FII: "#2563EB",
  DII: "#16A34A",
  Pro: "#D97706",
  Client: "#8B8B93",
};

export function InstitutionalClient() {
  const q = useInstitutional();
  const [kind, setKind] = useState<(typeof DEAL_KINDS)[number]["value"]>("all");
  const [dealQuery, setDealQuery] = useState("");
  const [dealSort, setDealSort] = useState<{ col: DealSortColumn; dir: SortDir } | null>(null);
  const [dealPage, setDealPage] = useState(1);

  useEffect(() => {
    setDealPage(1);
  }, [kind, dealQuery, dealSort]);

  if (q.isPending) {
    return (
      <Screen>
        <ScreenHeader title="Institutional Activity" />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="mt-2 h-96" />
      </Screen>
    );
  }

  if (q.isError) {
    return (
      <Screen>
        <ScreenHeader title="Institutional Activity" />
        <EmptyState
          title="Could not load institutional activity"
          description={String((q.error as Error).message)}
          actions={<Button onClick={() => q.refetch()}>Retry</Button>}
        />
      </Screen>
    );
  }

  const d = q.data!.data;
  const meta = q.data!.meta;
  const poi = d.participant_oi;

  const kindFiltered = d.deals.filter((deal) => kind === "all" || deal.kind === kind);
  const q2 = dealQuery.trim().toLowerCase();
  const searched = q2
    ? kindFiltered.filter((deal) => deal.symbol.toLowerCase().includes(q2) || deal.client.toLowerCase().includes(q2))
    : kindFiltered;
  const sortedDeals = dealSort
    ? [...searched].sort((a, b) => {
        const mul = dealSort.dir === "asc" ? 1 : -1;
        const av = a[dealSort.col];
        const bv = b[dealSort.col];
        return typeof av === "string" ? mul * av.localeCompare(bv as string) : mul * ((av as number) - (bv as number));
      })
    : searched;
  const dealPageCount = Math.max(1, Math.ceil(sortedDeals.length / DEALS_PAGE_SIZE));
  const dealPageSafe = Math.min(dealPage, dealPageCount);
  const pagedDeals = sortedDeals.slice((dealPageSafe - 1) * DEALS_PAGE_SIZE, dealPageSafe * DEALS_PAGE_SIZE);

  function toggleDealSort(col: DealSortColumn) {
    setDealSort((prev) => (prev?.col === col ? { col, dir: prev.dir === "asc" ? "desc" : "asc" } : { col, dir: col === "symbol" ? "asc" : "desc" }));
  }

  return (
    <Screen>
      <ScreenHeader
        title="Institutional Activity"
        subtitle="Who is accumulating, and whether the derivatives book agrees with them."
      />

      <MoneyFlowCard picks={d.ai_money_flow} />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <SummaryCard label="Deals today" value={String(d.deal_summary.deals_today)} sub={`${d.deal_summary.bulk_count} bulk · ${d.deal_summary.block_count} block`} />
        <SummaryCard label="Total value" value={inrCompact(d.deal_summary.total_value)} sub="disclosed today" />
        <SummaryCard label="Repeat accumulation" value={String(d.deal_summary.repeat_count)} sub="same client, last 30 sessions" />
      </div>

      <Card className="mt-2 overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <div>
            <div className="text-[13px] font-semibold">Bulk &amp; block deals</div>
            <div className="mt-0.5 text-[11px] text-text-muted">Client-level disclosures above the exchange reporting threshold</div>
          </div>
          <Segmented options={DEAL_KINDS as unknown as { value: string; label: string }[]} value={kind} onChange={(v) => setKind(v as typeof kind)} size="sm" />
          <div className="relative ml-auto w-full sm:w-56">
            <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              value={dealQuery}
              onChange={(e) => setDealQuery(e.target.value)}
              placeholder="Search symbol or client…"
              className="w-full rounded-md border border-border bg-surface py-1.5 pl-8 pr-3 text-[12px] outline-none focus:border-accent"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[720px]">
            <div
              className="grid gap-2 border-b border-border bg-surface-2 px-4 py-1.5 text-[11px] text-text-muted"
              style={{ gridTemplateColumns: safeGridCols(DEALS_GRID) }}
            >
              <span>Date</span>
              {DEAL_COLUMNS.slice(0, 1).map((c) => (
                <button key={c.key} onClick={() => toggleDealSort(c.key)} className={cn("flex items-center gap-1 hover:text-text", dealSort?.col === c.key && "font-semibold text-text")}>
                  {c.label}
                  {dealSort?.col === c.key && (dealSort.dir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
                </button>
              ))}
              <span>Client</span>
              <span>Side</span>
              <span>Type</span>
              {DEAL_COLUMNS.slice(1).map((c) => (
                <button
                  key={c.key}
                  onClick={() => toggleDealSort(c.key)}
                  className={cn("flex items-center justify-end gap-1 text-right hover:text-text", dealSort?.col === c.key && "font-semibold text-text")}
                >
                  {dealSort?.col === c.key && (dealSort.dir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
                  {c.label}
                </button>
              ))}
            </div>
            {pagedDeals.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] text-text-muted">
                {dealQuery ? `No deals match "${dealQuery}".` : "No deals disclosed for this filter today."}
              </p>
            ) : (
              pagedDeals.map((deal, i) => <DealRowView key={`${deal.symbol}-${deal.client}-${i}`} deal={deal} />)
            )}
          </div>
        </div>
        {dealPageCount > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-2">
            <span className="text-[11px] text-text-muted">
              {(dealPageSafe - 1) * DEALS_PAGE_SIZE + 1}–{Math.min(dealPageSafe * DEALS_PAGE_SIZE, sortedDeals.length)} of {sortedDeals.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setDealPage((p) => Math.max(1, p - 1))}
                disabled={dealPageSafe <= 1}
                className="flex h-6 w-6 items-center justify-center rounded border border-border text-text-secondary hover:bg-surface-2 disabled:cursor-default disabled:opacity-40"
              >
                <ChevronLeft size={13} />
              </button>
              <span className="tnum px-1 text-[11px] text-text-secondary">
                {dealPageSafe} / {dealPageCount}
              </span>
              <button
                onClick={() => setDealPage((p) => Math.min(dealPageCount, p + 1))}
                disabled={dealPageSafe >= dealPageCount}
                className="flex h-6 w-6 items-center justify-center rounded border border-border text-text-secondary hover:bg-surface-2 disabled:cursor-default disabled:opacity-40"
              >
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
        <div className="border-t border-border px-4 py-2.5 font-mono text-[11px] text-text-faint">
          source: NSE / BSE bulk &amp; block deal disclosures · repeat flag computed over 30 sessions
        </div>
      </Card>

      {poi && (
        <div className="mt-2 grid grid-cols-1 gap-2 lg:grid-cols-[1.15fr_1fr]">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[13px] font-semibold">Participant-wise open interest</div>
                <div className="mt-0.5 text-[11px] text-text-muted">Share of long open interest by participant category</div>
              </div>
              <div className="flex gap-3">
                {Object.entries(PARTICIPANT_COLOR).map(([who, c]) => (
                  <span key={who} className="flex items-center gap-1.5 text-[11px] text-text-secondary">
                    <span className="h-2 w-2 rounded-sm" style={{ background: c }} />
                    {who}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-4">
              {poi.sections.map((s) => (
                <div key={s.name}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[13px] font-medium">{s.name}</span>
                    <Chip tone="up">{s.note}</Chip>
                  </div>
                  <div className="flex h-7 overflow-hidden rounded-md">
                    {s.parts.map((p) => (
                      <div
                        key={p.who}
                        style={{ width: `${p.pct}%`, background: PARTICIPANT_COLOR[p.who] }}
                        className="flex items-center justify-center text-[11px] font-medium text-white"
                      >
                        {p.pct >= 8 ? `${p.who} ${p.pct}%` : ""}
                      </div>
                    ))}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-3">
                    {s.parts.map((p) => (
                      <span key={p.who} className="text-[11px] text-text-muted">
                        {p.who} <span className="text-text-secondary">{p.side}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 border-t border-border pt-2 font-mono text-[11px] text-text-faint">source: NSE participant-wise OI</div>
          </Card>

          <FiiRatioCard series={poi.fii_index_futures_ratio} />
        </div>
      )}

      <div className="mt-2">
        <DataSourceFooter meta={meta} />
      </div>
    </Screen>
  );
}

function SummaryCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card className="p-4">
      <div className="text-[11px] text-text-muted">{label}</div>
      <div className="tnum mt-1 text-[20px] font-semibold tracking-tight">{value}</div>
      <div className="mt-1 text-[11px] text-text-muted">{sub}</div>
    </Card>
  );
}

function DealRowView({ deal }: { deal: DealRow }) {
  const up = deal.side === "BUY";
  return (
    <div
      className="grid grid-cols-[72px_1fr_1.6fr_60px_60px_0.9fr_0.8fr_0.9fr] items-center gap-2 border-b border-border px-4 py-2 last:border-0 hover:bg-surface-2"
      style={{ borderLeft: `2px solid ${deal.repeat ? "var(--color-accent)" : "transparent"}` }}
    >
      <span className="font-mono text-[11px] text-text-faint">{dealDate(deal.date)}</span>
      <Link href={`/chart/${toSlug(deal.symbol)}?back=${encodeURIComponent("/institutional")}`} className="truncate text-[13px] font-medium hover:text-accent">
        {deal.symbol}
      </Link>
      <div className="min-w-0">
        <div className="truncate text-[13px] text-text-secondary">{deal.client}</div>
        {deal.repeat && (
          <div className="mt-0.5 text-[11px] font-medium text-accent">↻ {deal.repeat_count}× in the last 30 sessions</div>
        )}
      </div>
      <span
        className={cn(
          "inline-flex w-fit rounded px-1.5 py-0.5 text-[11px] font-semibold",
          up ? "bg-[rgba(22,163,74,0.12)] text-up-text" : "bg-[rgba(220,38,38,0.1)] text-down-text",
        )}
      >
        {deal.side}
      </span>
      <span className="text-[11px] text-text-secondary">{deal.kind}</span>
      <span className="tnum text-right text-[13px]">{count(deal.qty)}</span>
      <span className="tnum text-right text-[13px] text-text-secondary">{price(deal.price)}</span>
      <span className="tnum text-right text-[13px] font-medium">{inrCompact(deal.value)}</span>
    </div>
  );
}

function FiiRatioCard({ series }: { series: { date: string; ratio: number }[] }) {
  const points = useMemo(() => {
    if (series.length === 0) return null;
    const values = series.map((s) => s.ratio);
    const min = Math.min(...values, 0.8);
    const max = Math.max(...values, 1.4);
    const w = 560;
    const h = 180;
    const x = (i: number) => (i / Math.max(1, series.length - 1)) * w;
    const y = (v: number) => h - ((v - min) / (max - min || 1)) * h;
    return {
      w,
      h,
      min,
      max,
      poly: series.map((s, i) => `${x(i).toFixed(1)},${y(s.ratio).toFixed(1)}`).join(" "),
      lastX: x(series.length - 1),
      lastY: y(values.at(-1)!),
    };
  }, [series]);

  const last = series.at(-1)?.ratio ?? null;

  return (
    <Card className="flex flex-col p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[13px] font-semibold">FII derivatives statistics</div>
          <div className="mt-0.5 text-[11px] text-text-muted">Long/short ratio in index futures · 30 sessions</div>
        </div>
        <div className="text-right">
          <div className="tnum text-[20px] font-semibold tracking-tight">{last != null ? last.toFixed(2) : "—"}</div>
          <div className="text-[11px] text-text-muted">current ratio</div>
        </div>
      </div>
      {points ? (
        <svg width="100%" height="180" viewBox={`0 0 ${points.w} ${points.h}`} preserveAspectRatio="none" className="mt-3">
          <polyline points={points.poly} fill="none" stroke="#2563EB" strokeWidth="1.75" />
          <circle cx={points.lastX} cy={points.lastY} r="4" fill="#2563EB" />
        </svg>
      ) : (
        <div className="mt-3 flex h-[180px] items-center justify-center text-[12px] text-text-muted">no history yet</div>
      )}
      <div className="mt-3 flex flex-col gap-1.5 text-[11px] text-text-secondary">
        <div className="flex items-center gap-2">
          <span className="h-2 w-3.5 rounded-sm bg-[rgba(220,38,38,0.18)]" />
          Above 1.4 — historically stretched long positioning, often mean-reverts
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-3.5 rounded-sm bg-[rgba(22,163,74,0.18)]" />
          Below 0.8 — stretched short positioning
        </div>
      </div>
      <div className="mt-3 border-t border-border pt-2 font-mono text-[11px] text-text-faint">source: NSE participant-wise OI</div>
    </Card>
  );
}

const CONVICTION_TONE: Record<MoneyFlowPick["conviction"], "up" | "accent"> = {
  high: "up",
  medium: "accent",
};

/** Today's largest bulk/block deals, synthesized by AI into "where is real
 * institutional money going" — weighted toward repeat accumulation, not just deal
 * size (jobs/institutional.py::_ai_money_flow). Renders nothing when there were no
 * deals to analyze, or Gemini was unavailable that night — never a broken-looking
 * empty card. */
function MoneyFlowCard({ picks }: { picks: MoneyFlowPick[] | null }) {
  if (!picks || picks.length === 0) return null;
  return (
    <Card className="mb-2 p-4">
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-semibold">Where money is flowing today</span>
        <span className="rounded-full border border-[var(--color-accent-border)] bg-[var(--color-accent-tint)] px-2 py-0.5 text-[11px] font-medium text-accent">
          ✦ AI
        </span>
      </div>
      <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {picks.map((p) => (
          <Link
            key={p.symbol}
            href={`/chart/${toSlug(p.symbol)}?back=${encodeURIComponent("/institutional")}`}
            className="rounded-md border border-border p-3 transition-colors hover:border-accent"
          >
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold">{p.symbol}</span>
              <Chip tone={CONVICTION_TONE[p.conviction]}>{p.conviction} conviction</Chip>
            </div>
            <div className="mt-1.5 text-[11px] leading-relaxed text-text-secondary">{p.rationale}</div>
          </Link>
        ))}
      </div>
      <div className="mt-2.5 text-[11px] leading-relaxed text-text-faint">
        AI-generated from today&apos;s bulk/block deals, weighted toward the same client buying repeatedly across
        sessions. Not a recommendation — verify against the deals table below.
      </div>
    </Card>
  );
}
