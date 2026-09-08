"use client";

import Link from "next/link";

import { FilterRail } from "@/components/screener/filter-rail";
import { PhaseStub } from "@/components/screen/phase-stub";
import { ScreenHeader } from "@/components/screen/screen-header";
import {
  Button,
  DataSourceFooter,
  EmptyState,
  Row,
  Segmented,
  Skeleton,
  Table,
} from "@/components/ui";
import { useSymbols } from "@/lib/api/hooks";
import { useFilters } from "@/stores/filters";
import { useView } from "@/stores/view";

const TEMPLATE = "1.8fr 0.8fr 1fr 1fr";

export default function ScreenerPage() {
  const sector = useFilters((s) => s.sector);
  const view = useView((s) => s.screenerView);
  const setView = useView((s) => s.setScreenerView);

  const query = useSymbols({ sector: sector ?? undefined, limit: 50 });

  return (
    <div className="flex items-stretch">
      <FilterRail />

      <div className="min-w-0 flex-1 px-6 pb-14 pt-6">
        <ScreenHeader
          title="Screener"
          subtitle={
            query.data
              ? `${query.data.data.length} symbols${sector ? ` · sector: ${sector}` : ""} · scoring lands in Phase 1`
              : "Rank strong sectors, screen for setups, confirm and size."
          }
          actions={
            <Segmented
              options={[
                { value: "list", label: "List" },
                { value: "chart", label: "Chart" },
              ]}
              value={view}
              onChange={setView}
            />
          }
        />

        {view === "chart" ? (
          <PhaseStub
            phase="Phase 3 · charts"
            contents={[
              "2-col grid of annotated mini-charts (TradingView Lightweight Charts + SVG overlay layer)",
              "Pattern-specific overlays — VCP contraction zones, IPO base, 52WH breakout box, pivot line",
              "20/50 DMA, S/R, and a 4-stat chip row per card",
            ]}
          />
        ) : query.isPending ? (
          <div className="flex flex-col gap-2 rounded-lg border border-[var(--color-border)] bg-surface p-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="h-8" style={{ animationDelay: `${i * 0.05}s` }} />
            ))}
          </div>
        ) : query.isError ? (
          <EmptyState
            title="Could not load symbols"
            description={String((query.error as Error).message)}
            actions={<Button onClick={() => query.refetch()}>Retry</Button>}
          />
        ) : query.data.data.length === 0 ? (
          <EmptyState
            title="No symbols yet"
            description="Run the ingestion jobs: sync_symbols, then ingest_bhavcopy."
          />
        ) : (
          <Table
            template={TEMPLATE}
            header={
              <>
                <div>Symbol</div>
                <div className="text-right">Series</div>
                <div>Sector</div>
                <div className="text-right">F&amp;O</div>
              </>
            }
            footer={
              <>
                <DataSourceFooter meta={query.data.meta} />
                <span>Phase 0 — reference data only, no prices/scores yet</span>
              </>
            }
          >
            {query.data.data.map((s) => (
              <Row key={s.id} template={TEMPLATE}>
                <Link href={`/stock/${s.nse_symbol}`} className="min-w-0">
                  <div className="text-[13px] font-medium text-text">{s.nse_symbol}</div>
                  <div className="truncate text-[11px] text-[var(--color-text-muted)]">{s.name}</div>
                </Link>
                <div className="text-right text-[13px] text-[var(--color-text-secondary)]">
                  {s.series}
                </div>
                <div className="truncate text-[11px] text-[var(--color-text-secondary)]">
                  {s.sector?.name ?? "—"}
                </div>
                <div className="text-right text-[13px] text-[var(--color-text-secondary)]">
                  {s.is_fno ? "✓" : "—"}
                </div>
              </Row>
            ))}
          </Table>
        )}
      </div>
    </div>
  );
}
