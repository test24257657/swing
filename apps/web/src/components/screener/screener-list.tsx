"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { DataSourceFooter, EmptyState, Row, Skeleton, Table } from "@/components/ui";
import type { Envelope, ScreenerResult } from "@/lib/api/types";
import { change, direction, pct, pctPlain, price, ratio } from "@/lib/format";
import { cn } from "@/lib/cn";
import { type ScreenerState, type Sort } from "@/lib/url/screener-params";
import { useWatchlist } from "@/stores/watchlist";

import { PatternChip } from "./pattern-chip";
import { ScoreCell } from "./score-cell";

const TEMPLATE =
  "1.7fr 0.7fr 0.6fr 1.25fr 1fr 0.6fr 0.7fr 0.7fr 0.55fr 0.5fr 0.85fr";

const COLUMNS: { key: string; label: string; sort?: Sort; align?: "right" }[] = [
  { key: "symbol", label: "Symbol" },
  { key: "ltp", label: "LTP", align: "right" },
  { key: "chg", label: "%Chg", align: "right" },
  { key: "score", label: "Score", sort: "composite" },
  { key: "pattern", label: "Pattern" },
  { key: "rs", label: "RS sec", sort: "rs", align: "right" },
  { key: "dist", label: "52WH", sort: "dist_52wh", align: "right" },
  { key: "deliv", label: "Deliv %", sort: "delivery", align: "right" },
  { key: "vol", label: "Vol×", sort: "rel_volume", align: "right" },
  { key: "rsi", label: "RSI", sort: "rsi", align: "right" },
  { key: "sector", label: "Sector" },
];

function toneColor(d: "up" | "down" | "flat") {
  return d === "up" ? "text-up-text" : d === "down" ? "text-down-text" : "text-text-secondary";
}

interface Props {
  query: {
    data?: Envelope<ScreenerResult>;
    isPending: boolean;
    isError: boolean;
    error: unknown;
    isPlaceholderData: boolean;
    refetch: () => void;
  };
  params: ScreenerState;
  setParams: (patch: Partial<ScreenerState>) => void;
  onClearFilters: () => void;
}

export function ScreenerList({ query, params, setParams, onClearFilters }: Props) {
  const router = useRouter();
  const wl = useWatchlist();

  function toggleSort(col: Sort) {
    if (params.sort === col) {
      setParams({ order: params.order === "desc" ? "asc" : "desc" });
    } else {
      setParams({ sort: col, order: "desc", page: 1 });
    }
  }

  const header = (
    <>
      {COLUMNS.map((c) => {
        const active = c.sort && params.sort === c.sort;
        return (
          <div
            key={c.key}
            className={cn(c.align === "right" && "text-right", c.sort && "cursor-pointer select-none")}
            onClick={c.sort ? () => toggleSort(c.sort!) : undefined}
          >
            <span className={cn(active && "font-semibold text-text")}>{c.label}</span>
            {active && <span className="ml-1 text-accent">{params.order === "desc" ? "▼" : "▲"}</span>}
          </div>
        );
      })}
    </>
  );

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-9" style={{ animationDelay: `${i * 0.04}s` }} />
        ))}
      </div>
    );
  }
  if (query.isError) {
    return (
      <EmptyState
        title="Could not run the screen"
        description={String((query.error as Error).message)}
        actions={
          <button className="rounded-md bg-accent px-3.5 py-2 text-[13px] font-medium text-white" onClick={query.refetch}>
            Retry
          </button>
        }
      />
    );
  }

  const result = query.data!.data;

  if (result.rows.length === 0) {
    return (
      <EmptyState
        title={result.as_of ? "No stocks match these filters" : "No screener data yet"}
        description={
          result.as_of
            ? "Loosen a filter — delivery and RSI bands together are restrictive in a quiet tape."
            : "Run the ingestion pipeline: sync_symbols → ingest_bhavcopy → compute_indicators → compute_scores."
        }
        actions={
          result.as_of ? (
            <button
              className="rounded-md border border-border px-3.5 py-2 text-[13px] font-medium text-text-secondary"
              onClick={onClearFilters}
            >
              Clear all filters
            </button>
          ) : undefined
        }
      />
    );
  }

  const totalPages = Math.max(1, Math.ceil(result.total / result.per_page));

  return (
    <div className={cn(query.isPlaceholderData && "opacity-60 transition-opacity")}>
      {!result.score_validated && (
        <div className="mb-2 rounded-md border border-[rgba(217,119,6,0.35)] bg-stale-bg px-3 py-2 text-[11px] text-stale-text">
          Composite score v1 is <strong>not yet validated</strong> against a benchmark — treat it as a sort
          key, not a signal, until the backtest passes.
        </div>
      )}

      <Table
        template={TEMPLATE}
        header={header}
        footer={
          <>
            <DataSourceFooter meta={query.data!.meta} />
            <span>
              {result.total.toLocaleString("en-IN")} matches · page {result.page}/{totalPages}
            </span>
          </>
        }
      >
        {result.rows.map((r) => {
          const inList = wl.has(r.symbol);
          return (
            <Row key={r.symbol} template={TEMPLATE} className="group">
              <Link href={`/stock/${r.symbol}`} className="min-w-0">
                <div className="text-[13px] font-medium text-text">{r.symbol}</div>
                <div className="truncate text-[11px] text-text-muted">{r.name}</div>
              </Link>
              <div className="text-right text-[13px]">{price(r.ltp)}</div>
              <div className={cn("text-right text-[13px]", toneColor(direction(r.change_pct)))}>
                {r.change_pct == null ? "—" : pct(r.change_pct)}
              </div>
              <ScoreCell score={r.composite_score} verdict={r.verdict} inputsPresent={r.inputs_present} />
              <div className="flex flex-wrap gap-1">
                {r.patterns.length === 0 ? (
                  <span className="text-[11px] text-text-faint">—</span>
                ) : (
                  r.patterns.map((p) => <PatternChip key={p} code={p} />)
                )}
              </div>
              <div className={cn("text-right text-[13px]", toneColor(direction(r.rs_vs_sector_1m)))}>
                {r.rs_vs_sector_1m == null ? "—" : change(r.rs_vs_sector_1m, 1)}
              </div>
              <div className="text-right text-[13px] text-text-secondary">
                {r.dist_52w_high_pct == null ? "—" : change(r.dist_52w_high_pct, 1) + "%"}
              </div>
              <div
                className={cn(
                  "text-right text-[13px]",
                  (r.delivery_pct_sma_20 ?? 0) >= 60 ? "text-up-text" : "text-text-secondary",
                )}
              >
                {pctPlain(r.delivery_pct_sma_20, 0)}
              </div>
              <div
                className={cn(
                  "text-right text-[13px]",
                  (r.rel_volume ?? 0) >= 1.5 ? "text-up-text" : "text-text-secondary",
                )}
              >
                {ratio(r.rel_volume)}
              </div>
              <div className="text-right text-[13px] text-text-secondary">
                {r.rsi_14 == null ? "—" : r.rsi_14.toFixed(0)}
              </div>
              <div className="flex items-center justify-between gap-1">
                <span className="truncate text-[11px] text-text-secondary">{r.sector ?? "—"}</span>
                <span className="hidden shrink-0 items-center gap-1 rounded bg-surface-inset p-0.5 group-hover:flex">
                  <button
                    title={inList ? "On watchlist" : "Add to watchlist"}
                    onClick={() =>
                      inList
                        ? wl.remove(r.symbol)
                        : wl.add({ nseSymbol: r.symbol, name: r.name, entry: null, target: null, stop: null, thesis: "" })
                    }
                    className="rounded px-1.5 text-[11px] font-medium text-text-secondary hover:bg-white"
                  >
                    {inList ? "✓" : "+W"}
                  </button>
                  <button
                    title="Stock detail"
                    onClick={() => router.push(`/stock/${r.symbol}`)}
                    className="rounded px-1.5 text-[11px] font-medium text-text-secondary hover:bg-white"
                  >
                    ↗
                  </button>
                </span>
              </div>
            </Row>
          );
        })}
      </Table>

      <div className="mt-2 flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2.5 text-[13px] text-text-secondary">
        <span>
          Showing{" "}
          <span className="tnum text-text">
            {(result.page - 1) * result.per_page + 1}–{Math.min(result.total, result.page * result.per_page)}
          </span>{" "}
          of <span className="tnum text-text">{result.total.toLocaleString("en-IN")}</span>
        </span>
        <div className="flex items-center gap-1">
          <button
            disabled={result.page <= 1}
            onClick={() => setParams({ page: result.page - 1 })}
            className="rounded-md border border-border px-2.5 py-1 disabled:opacity-40"
          >
            ← Prev
          </button>
          <span className="tnum px-2">
            {result.page} / {totalPages}
          </span>
          <button
            disabled={result.page >= totalPages}
            onClick={() => setParams({ page: result.page + 1 })}
            className="rounded-md border border-border px-2.5 py-1 disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
