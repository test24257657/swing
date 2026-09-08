"use client";

import { use } from "react";

import { PhaseStub } from "@/components/screen/phase-stub";
import { Screen, ScreenHeader } from "@/components/screen/screen-header";
import {
  Button,
  Card,
  Chip,
  DataSourceFooter,
  EmptyState,
  Skeleton,
} from "@/components/ui";
import { useSymbol } from "@/lib/api/hooks";
import { useWatchlist } from "@/stores/watchlist";

export default function StockDetailPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = use(params);
  const q = useSymbol(symbol);
  const wl = useWatchlist();

  if (q.isPending) {
    return (
      <Screen>
        <Skeleton className="h-20 w-full" />
      </Screen>
    );
  }
  if (q.isError) {
    return (
      <Screen>
        <EmptyState
          title={`Unknown symbol ${symbol}`}
          description={String((q.error as Error).message)}
          actions={<Button onClick={() => q.refetch()}>Retry</Button>}
        />
      </Screen>
    );
  }

  const s = q.data.data;
  const inList = wl.has(s.nse_symbol);

  return (
    <Screen>
      <Card className="mb-2 flex items-center gap-5 p-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-[20px] font-semibold tracking-tight">{s.nse_symbol}</span>
            {s.sector && <Chip>{s.sector.name}</Chip>}
            {s.is_fno && <Chip tone="accent" pill>F&amp;O</Chip>}
          </div>
          <div className="mt-1 text-[13px] text-[var(--color-text-muted)]">
            {s.name} · NSE: {s.nse_symbol}
            {s.isin ? ` · ISIN ${s.isin}` : ""}
          </div>
        </div>
        <div className="ml-auto">
          <Button
            variant={inList ? "secondary" : "primary"}
            onClick={() =>
              inList
                ? wl.remove(s.nse_symbol)
                : wl.add({ nseSymbol: s.nse_symbol, name: s.name, entry: null, target: null, stop: null, thesis: "" })
            }
          >
            {inList ? "On watchlist ✓" : "+ Watchlist"}
          </Button>
        </div>
      </Card>

      <div className="mb-2">
        <DataSourceFooter meta={q.data.meta} />
      </div>

      <ScreenHeader title="Stock Detail" />
      <PhaseStub
        phase="Phase 4 · stock detail"
        contents={[
          "Read-only price chart — candles + volume + 20/50/200 DMA + delivery-% overlay + S/R + OI levels",
          "Technical snapshot — RSI, ATR, distance from 52W high/low, price vs MAs, volume vs 20d",
          "Fundamentals (last 4 quarters) with filing-verification divergence flags",
          "F&O positioning + option chain (F&O-eligible symbols only)",
          "Delivery trend, market depth, and an ATR-based position-sizing calculator",
          "Corporate announcements classified by expected swing impact",
        ]}
      />
    </Screen>
  );
}
