"use client";

import Link from "next/link";
import { type ReactNode } from "react";

import { Card } from "@/components/ui";
import type { MarketRegime, ScanRow } from "@/lib/api/market-types";
import { cn } from "@/lib/cn";
import { direction } from "@/lib/format";
import { toSlug } from "@/lib/slug";
import { TONE_BOX } from "@/lib/tone";

/** Shared by Market Pulse (summary) and Daily Scan (full lists). */

const LIGHT = {
  green: { box: TONE_BOX.up, dot: "var(--color-up)" },
  yellow: { box: { bg: "rgba(217,119,6,0.08)", bd: "rgba(217,119,6,0.28)", fg: "text-stale-text" }, dot: "var(--color-stale)" },
  red: { box: TONE_BOX.down, dot: "var(--color-down)" },
} as const;

export function toneClass(v: number | null | undefined) {
  const d = direction(v);
  return d === "up" ? "text-up-text" : d === "down" ? "text-down-text" : "text-text-secondary";
}

export function RsBadge({ rs }: { rs: number | null }) {
  if (rs == null) return <span className="text-text-faint">—</span>;
  return (
    <span
      title={`RS ${rs}: stronger than ${rs}% of all stocks over the past year`}
      className={cn(
        "tnum inline-flex min-w-[28px] justify-center rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold",
        rs >= 80 ? "bg-[rgba(22,163,74,0.12)] text-up-text" : "bg-surface-2 text-text-secondary",
      )}
    >
      {rs}
    </span>
  );
}

export function StockLink({ symbol, back }: { symbol: string; back: string }) {
  return (
    <Link
      href={`/chart/${toSlug(symbol)}?back=${encodeURIComponent(back)}`}
      className="text-[13px] font-semibold hover:text-accent"
    >
      {symbol}
    </Link>
  );
}

export function MarketLight({ m, footer }: { m: MarketRegime; footer?: ReactNode }) {
  const l = LIGHT[m.light];
  return (
    <Card className="p-4" style={{ borderColor: l.box.bd }}>
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="h-10 w-10 shrink-0 rounded-full"
            style={{ background: l.dot, boxShadow: `0 0 0 6px ${l.box.bg}` }}
          />
          <div>
            <div className="text-[11px] uppercase tracking-wide text-text-muted">Market light</div>
            <div className={cn("text-[18px] font-semibold", l.box.fg)}>{m.label}</div>
          </div>
        </div>
        <div className="min-w-0 flex-1 basis-64">
          <p className="text-[13px] font-medium text-text">{m.advice}</p>
          <ul className="mt-1.5 space-y-0.5 text-[12px] text-text-secondary">
            {m.reasons.map((r) => (
              <li key={r} className="flex gap-1.5">
                <span className="text-text-faint">•</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {footer}
    </Card>
  );
}

/** Numbered step heading — the dashboard reads top to bottom as a routine. */
export function StepHeading({ n, title, hint, action }: { n: number; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex flex-wrap items-end justify-between gap-2 first:mt-0">
      <div className="flex items-baseline gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-white">
          {n}
        </span>
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {hint && <span className="hidden text-[12px] text-text-muted sm:inline">{hint}</span>}
      </div>
      {action}
    </div>
  );
}

/** Compact top-N list with a "see all" link — the Pulse summary of a Daily Scan list. */
export function MiniList({
  title,
  hint,
  rows,
  empty,
  back,
  seeAll,
  right,
}: {
  title: string;
  hint: string;
  rows: ScanRow[];
  empty: string;
  back: string;
  seeAll?: string;
  right: (r: ScanRow) => ReactNode;
}) {
  return (
    <Card className="flex flex-col p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[13px] font-semibold">{title}</h3>
        {seeAll && (
          <Link href={seeAll} className="text-[11px] text-accent hover:underline">
            See all →
          </Link>
        )}
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
                <StockLink symbol={r.symbol} back={back} />
                <div className="truncate text-[11px] text-text-muted">{r.name}</div>
              </div>
              <div className="tnum shrink-0 text-right text-[12px]">{right(r)}</div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
