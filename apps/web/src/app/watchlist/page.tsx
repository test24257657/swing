"use client";

import Link from "next/link";

import { Screen, ScreenHeader } from "@/components/screen/screen-header";
import { Button, EmptyState, Row, Table } from "@/components/ui";
import { istStamp } from "@/lib/format";
import { useWatchlist } from "@/stores/watchlist";

const TEMPLATE = "1.6fr 1fr 1fr 0.6fr";

export default function WatchlistPage() {
  const items = useWatchlist((s) => s.list());
  const remove = useWatchlist((s) => s.remove);

  return (
    <Screen>
      <ScreenHeader
        title="Watchlist"
        subtitle={`${items.length} tracked · alerts land in Phase 5`}
        actions={
          <Link href="/screener">
            <Button>+ Add from screener</Button>
          </Link>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          title="Nothing on the watchlist yet"
          description="Watchlists work best when they come from a screen. Run the screener and add the top scores."
          actions={
            <Link href="/screener">
              <Button>Open screener</Button>
            </Link>
          }
        />
      ) : (
        <Table
          template={TEMPLATE}
          header={
            <>
              <div>Symbol</div>
              <div className="text-right">Entry</div>
              <div className="text-right">Added</div>
              <div className="text-right" />
            </>
          }
        >
          {items.map((w) => (
            <Row key={w.nseSymbol} template={TEMPLATE}>
              <Link href={`/stock/${w.nseSymbol}`} className="min-w-0">
                <div className="text-[13px] font-medium text-text">{w.nseSymbol}</div>
                <div className="truncate text-[11px] text-[var(--color-text-muted)]">{w.name}</div>
              </Link>
              <div className="text-right text-[13px] text-[var(--color-text-secondary)]">
                {w.entry ?? "not set"}
              </div>
              <div className="text-right font-mono text-[11px] text-[var(--color-text-muted)]">
                {istStamp(w.addedAt)}
              </div>
              <div className="text-right">
                <button
                  onClick={() => remove(w.nseSymbol)}
                  className="text-[11px] font-medium text-[var(--color-text-muted)] hover:text-down-text"
                >
                  remove
                </button>
              </div>
            </Row>
          ))}
        </Table>
      )}
    </Screen>
  );
}
