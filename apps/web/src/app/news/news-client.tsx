"use client";

import { ExternalLink } from "lucide-react";
import { useMemo, useState } from "react";

import { Screen, ScreenHeader } from "@/components/screen/screen-header";
import { Button, Card, DataSourceFooter, EmptyState, Skeleton } from "@/components/ui";
import { useNews } from "@/lib/api/market-hooks";
import { useWatchlist } from "@/lib/api/watchlist-hooks";
import type { NewsImpact, NewsItem } from "@/lib/api/market-types";
import { cn } from "@/lib/cn";
import { IMPACT_META, IMPACT_ORDER } from "@/lib/news-impact";

const RANGES = [
  { key: "1", label: "Today" },
  { key: "3", label: "3D" },
  { key: "7", label: "1W" },
  { key: "9999", label: "All" },
] as const;

function daysAgo(dateStr: string): number {
  const d = new Date(`${dateStr}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((today.getTime() - d.getTime()) / 86_400_000);
}

function groupByDate(items: NewsItem[]): { date: string; items: NewsItem[] }[] {
  const groups = new Map<string, NewsItem[]>();
  for (const it of items) {
    const list = groups.get(it.date) ?? [];
    list.push(it);
    groups.set(it.date, list);
  }
  return [...groups.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, items]) => ({ date, items }));
}

function dateLabel(dateStr: string): string {
  const diff = daysAgo(dateStr);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function NewsClient() {
  const q = useNews();
  const wlQ = useWatchlist();
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("3");
  const [activeImpacts, setActiveImpacts] = useState<Set<NewsImpact>>(new Set());
  const [wlOnly, setWlOnly] = useState(false);

  const watchlistSymbols = useMemo(() => new Set((wlQ.data?.data ?? []).map((w) => w.symbol)), [wlQ.data]);

  if (q.isPending) {
    return (
      <Screen>
        <ScreenHeader title="News" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
        <div className="mt-2 flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </Screen>
    );
  }

  if (q.isError) {
    return (
      <Screen>
        <ScreenHeader title="News" />
        <EmptyState
          title="Could not load news"
          description={String((q.error as Error).message)}
          actions={<Button onClick={() => q.refetch()}>Retry</Button>}
        />
      </Screen>
    );
  }

  const d = q.data!.data;
  const meta = q.data!.meta;

  function toggleImpact(k: NewsImpact) {
    setActiveImpacts((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  const maxAge = Number(range);
  const filtered = d.items.filter((it) => {
    if (daysAgo(it.date) > maxAge) return false;
    if (activeImpacts.size > 0 && !activeImpacts.has(it.impact)) return false;
    if (wlOnly && !watchlistSymbols.has(it.symbol)) return false;
    return true;
  });
  const groups = groupByDate(filtered);
  const isEmpty = filtered.length === 0;

  return (
    <Screen>
      <ScreenHeader
        title="News"
        subtitle={`Exchange filings classified by likely swing impact · ${d.items.length} in the last 3 days`}
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {IMPACT_ORDER.map((k) => {
          const meta = IMPACT_META[k];
          const on = activeImpacts.has(k);
          return (
            <button
              key={k}
              onClick={() => toggleImpact(k)}
              className="rounded-lg border-l-[3px] border p-2.5 text-left transition-colors"
              style={{
                background: on ? meta.bg : "var(--color-surface)",
                borderColor: on ? meta.bd : "var(--color-border)",
                borderLeftColor: meta.bar,
              }}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-[11px]">{meta.icon}</span>
                <span className="text-[11px] font-medium" style={{ color: on ? meta.fg : "var(--color-text-secondary)" }}>
                  {meta.label}
                </span>
              </div>
              <div className="tnum mt-1.5 text-[18px] font-semibold" style={{ color: on ? meta.fg : undefined }}>
                {d.counts[k] ?? 0}
              </div>
            </button>
          );
        })}
      </div>

      <div className="sticky top-2 z-20 mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface/95 p-2 backdrop-blur">
        <div className="flex gap-0.5 rounded-md bg-surface-2 p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={cn(
                "rounded px-2.5 py-1 text-[11px] font-medium",
                range === r.key ? "bg-[var(--color-accent-tint)] text-accent-hover" : "text-text-secondary hover:text-text",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setWlOnly((v) => !v)}
          className="flex items-center gap-2"
        >
          <span
            className="relative h-4 w-7 flex-none rounded-full transition-colors"
            style={{ background: wlOnly ? "var(--color-accent)" : "var(--color-border)" }}
          >
            <span
              className="absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all"
              style={{ left: wlOnly ? 14 : 2 }}
            />
          </span>
          <span className="text-[11px] font-medium text-text-secondary">Watchlist only</span>
        </button>
        {(activeImpacts.size > 0 || wlOnly) && (
          <button
            onClick={() => {
              setActiveImpacts(new Set());
              setWlOnly(false);
            }}
            className="ml-auto text-[11px] text-text-muted hover:text-text"
          >
            Clear filters
          </button>
        )}
      </div>

      {isEmpty ? (
        <Card className="mt-2 p-10 text-center">
          <div className="text-[14px] font-semibold">No announcements match these filters</div>
          <div className="mt-1.5 text-[12px] text-text-muted">Try widening the date range or clearing the impact filters.</div>
        </Card>
      ) : (
        <div className="mt-2 flex flex-col gap-4">
          {groups.map((g) => (
            <div key={g.date}>
              <div className="mb-2 flex items-center gap-2.5">
                <span className="text-[11px] font-semibold tracking-wide text-text-secondary">{dateLabel(g.date).toUpperCase()}</span>
                <span className="font-mono text-[11px] text-text-faint">{g.items.length} filings</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="flex flex-col gap-2">
                {g.items.map((n, i) => (
                  <NewsCard key={`${n.symbol}-${n.date}-${n.time}-${i}`} item={n} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Card className="mt-3 flex items-start gap-2 p-3">
        <span className="text-[12px]">⚠️</span>
        <div className="text-[11px] leading-relaxed text-text-secondary">
          Impact levels and summaries are <span className="font-medium text-text">AI-generated from the filing text</span> and can
          be wrong — always check the original filing before acting.
        </div>
      </Card>

      <div className="mt-2">
        <DataSourceFooter meta={meta} />
      </div>
    </Screen>
  );
}

function NewsCard({ item }: { item: NewsItem }) {
  const meta = IMPACT_META[item.impact];
  return (
    <Card className="flex overflow-hidden p-0">
      <div className="w-1 flex-none" style={{ background: meta.bar }} />
      <div className="min-w-0 flex-1 p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] font-semibold">{item.symbol}</span>
          <span className="truncate text-[11px] text-text-muted">{item.name}</span>
          <span
            className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap"
            style={{ color: meta.fg, background: meta.bg, borderColor: meta.bd }}
          >
            {meta.icon} {meta.label}
          </span>
          <span className="ml-auto font-mono text-[11px] text-text-faint">{item.time}</span>
        </div>
        <div className="mt-2 text-[14px] font-medium leading-snug">{item.headline}</div>
        {item.summary && (
          <div className="mt-2 flex gap-2 rounded-md border border-[var(--color-accent-border)] bg-[var(--color-accent-tint)] p-2.5">
            <span className="text-[11px] text-accent">✦</span>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold tracking-wide text-accent">AI IMPACT SUMMARY</div>
              <div className="mt-0.5 text-[12px] leading-relaxed text-text-secondary">{item.summary}</div>
            </div>
          </div>
        )}
        <div className="mt-2.5 flex items-center gap-2.5 border-t border-border pt-2">
          <span className="rounded bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-text-secondary">{item.category}</span>
          {item.filing_url && (
            <a
              href={item.filing_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-[11px] font-medium text-accent hover:text-accent-hover"
            >
              Original filing <ExternalLink size={11} />
            </a>
          )}
        </div>
      </div>
    </Card>
  );
}
