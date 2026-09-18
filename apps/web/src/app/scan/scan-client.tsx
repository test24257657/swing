"use client";

import Link from "next/link";
import { type ReactNode } from "react";

import { MarketLight, RsBadge, StockLink as SharedStockLink, toneClass } from "@/components/scan/scan-parts";
import { Screen, ScreenHeader } from "@/components/screen/screen-header";
import { Button, Card, Chip, DataSourceFooter, EmptyState, Skeleton, Tooltip } from "@/components/ui";
import { useDailyScan } from "@/lib/api/market-hooks";
import type { ScanRow } from "@/lib/api/market-types";
import { cn } from "@/lib/cn";
import { pct, pctPlain, price, ratio } from "@/lib/format";
import { PATTERNS } from "@/lib/patterns";
import { toSlug } from "@/lib/slug";

function StockLink({ symbol }: { symbol: string }) {
  return <SharedStockLink symbol={symbol} back="/scan" />;
}

function Section({
  title,
  hint,
  empty,
  rows,
  children,
}: {
  title: string;
  hint: string;
  empty: string;
  rows: ScanRow[];
  children: (r: ScanRow) => ReactNode;
}) {
  return (
    <Card className="flex flex-col p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-semibold">{title}</h2>
        <span className="font-mono text-[11px] text-text-faint">{rows.length}</span>
      </div>
      <p className="mt-0.5 text-[11px] leading-relaxed text-text-muted">{hint}</p>
      {rows.length === 0 ? (
        <p className="mt-3 text-[12px] text-text-muted">{empty}</p>
      ) : (
        <div className="mt-2 divide-y divide-border">
          {rows.map((r) => (
            <div key={r.symbol} className="flex items-center gap-2 py-1.5">
              <RsBadge rs={r.rs} />
              <div className="min-w-0 flex-1">
                <StockLink symbol={r.symbol} />
                <div className="truncate text-[11px] text-text-muted">{r.name}</div>
              </div>
              <div className="tnum shrink-0 text-right text-[12px]">{children(r)}</div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function PriceChange({ r }: { r: ScanRow }) {
  return (
    <>
      <div>{price(r.ltp)}</div>
      <div className={cn("text-[11px]", toneClass(r.change_pct))}>{pct(r.change_pct)}</div>
    </>
  );
}

export function ScanClient() {
  const q = useDailyScan();

  if (q.isPending) {
    return (
      <Screen>
        <ScreenHeader title="Daily Scan" subtitle="Is it safe to buy — and what to buy tonight." />
        <Skeleton className="h-28" />
        <div className="mt-2 grid grid-cols-1 gap-2 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-72" />
          ))}
        </div>
      </Screen>
    );
  }

  if (q.isError) {
    return (
      <Screen>
        <ScreenHeader title="Daily Scan" />
        <EmptyState
          title="Could not load the Daily Scan"
          description={String((q.error as Error).message)}
          actions={<Button onClick={() => q.refetch()}>Retry</Button>}
        />
      </Screen>
    );
  }

  const d = q.data.data;
  const meta = q.data.meta;

  return (
    <Screen>
      <ScreenHeader
        title="Daily Scan"
        subtitle={
          <>
            Is it safe to buy — and what to buy tonight. {d.counts.rated.toLocaleString("en-IN")} stocks rated,{" "}
            {d.counts.trend_template} in a clean uptrend · {d.as_of}
          </>
        }
      />

      {d.market && <MarketLight m={d.market} />}

      <div className="mt-2 grid grid-cols-1 gap-2 lg:grid-cols-2">
        <Card className="flex flex-col p-4 lg:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[13px] font-semibold">Ready today</h2>
            <span className="font-mono text-[11px] text-text-faint">{d.ready.length}</span>
          </div>
          <p className="mt-0.5 text-[11px] leading-relaxed text-text-muted">
            Clean uptrend, RS 80+, and a setup sitting just under its breakout level (pivot). Set an alert at the pivot —
            buy only if it breaks out on volume.
            {d.market?.light === "red" && (
              <span className="text-down-text"> The market light is red: wait, or use half size.</span>
            )}
          </p>
          {d.ready.length === 0 ? (
            <p className="mt-3 text-[12px] text-text-muted">Nothing is coiled under a pivot tonight.</p>
          ) : (
            <div className="-mx-4 mt-2 overflow-x-auto px-4">
              <table className="w-full min-w-[560px] text-[12px]">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] text-text-muted">
                    <th className="py-1.5 pr-2 font-normal">RS</th>
                    <th className="py-1.5 pr-2 font-normal">Stock</th>
                    <th className="py-1.5 pr-2 font-normal">Setup</th>
                    <th className="py-1.5 pr-2 text-right font-normal">Price</th>
                    <th className="py-1.5 pr-2 text-right font-normal">Pivot</th>
                    <th className="py-1.5 pr-2 text-right font-normal">To pivot</th>
                    <th className="py-1.5 text-right font-normal">Stop</th>
                  </tr>
                </thead>
                <tbody className="tnum">
                  {d.ready.map((r) => {
                    const pat = r.pattern ? PATTERNS[r.pattern] : null;
                    return (
                      <tr key={r.symbol} className="border-b border-border last:border-0">
                        <td className="py-2 pr-2">
                          <RsBadge rs={r.rs} />
                        </td>
                        <td className="py-2 pr-2">
                          <StockLink symbol={r.symbol} />
                          <div className="max-w-[180px] truncate text-[11px] text-text-muted">{r.name}</div>
                        </td>
                        <td className="py-2 pr-2">
                          <div className="flex flex-wrap gap-1">
                            {pat && <Chip tone={pat.tone}>{pat.label}</Chip>}
                            {r.dry_up && (
                              <Tooltip content="Volume dried up to under 60% of normal — sellers look exhausted.">
                                <Chip tone="info">Dry-up</Chip>
                              </Tooltip>
                            )}
                          </div>
                        </td>
                        <td className="py-2 pr-2 text-right">{price(r.ltp)}</td>
                        <td className="py-2 pr-2 text-right">{price(r.pivot)}</td>
                        <td className="py-2 pr-2 text-right text-text-secondary">{pct(r.gap_to_pivot_pct, 1)}</td>
                        <td className="py-2 text-right">{price(r.stop)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Section
          title="RS leaders"
          hint="The strongest stocks in the market over the past year (RS = beats that % of all stocks), all in a clean uptrend."
          empty="No stock passes the uptrend filter tonight."
          rows={d.rs_leaders}
        >
          {(r) => <PriceChange r={r} />}
        </Section>

        <Section
          title="Pocket pivots"
          hint="Up day on volume bigger than any down day in the last 10 sessions — big buyers stepping in, often before the breakout."
          empty="No pocket pivots today."
          rows={d.pocket_pivots}
        >
          {(r) => (
            <>
              <div>{price(r.ltp)}</div>
              <div className="text-[11px] text-text-muted">{ratio(r.rel_volume)} vol</div>
            </>
          )}
        </Section>

        <Section
          title="Delivery spikes"
          hint="Price up on heavy volume with delivery far above its own normal — buyers taking shares home, not intraday trading."
          empty="No delivery spikes today — common on a weak day."
          rows={d.delivery_spikes}
        >
          {(r) => (
            <>
              <div>{pctPlain(r.delivery_pct, 1)} del</div>
              <div className="text-[11px] text-text-muted">usually {pctPlain(r.delivery_avg_pct, 1)}</div>
            </>
          )}
        </Section>

        <Card className="flex flex-col p-4">
          <h2 className="text-[13px] font-semibold">Sector leaders</h2>
          <p className="mt-0.5 text-[11px] leading-relaxed text-text-muted">
            Highest-RS stocks inside the top-ranked sectors — leaders in leading groups.
          </p>
          <div className="mt-2 space-y-3">
            {d.sector_leaders.map((s) => (
              <div key={s.sector}>
                <div className="flex items-center justify-between text-[12px]">
                  <span className="font-medium">
                    #{s.rank} {s.sector.replace(/^NIFTY /, "")}
                  </span>
                  <span className={cn("tnum text-[11px]", toneClass(s.return_1m))}>1M {pct(s.return_1m)}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {s.stocks.map((x) => (
                    <Link
                      key={x.symbol}
                      href={`/chart/${toSlug(x.symbol)}?back=${encodeURIComponent("/scan")}`}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[12px] hover:border-[var(--color-accent-border)]"
                    >
                      <RsBadge rs={x.rs} />
                      {x.symbol}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <DataSourceFooter meta={meta} />
        <span className="font-mono text-[11px] text-text-faint">rule-based · end-of-day · not investment advice</span>
      </div>
    </Screen>
  );
}
