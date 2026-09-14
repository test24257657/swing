"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Screen, ScreenHeader } from "@/components/screen/screen-header";
import { Button, Card, EmptyState, Skeleton } from "@/components/ui";
import { useResultsCalendar } from "@/lib/api/market-hooks";
import type { ResultsCalendarEntry } from "@/lib/api/market-types";
import { cn } from "@/lib/cn";
import { toSlug } from "@/lib/slug";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_CHIPS_PER_DAY = 3;

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay()); // back up to the Sunday on/before the 1st
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}

export function ResultsCalendarClient() {
  const q = useResultsCalendar();
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState<{ year: number; month: number }>({ year: today.getFullYear(), month: today.getMonth() });

  if (q.isPending) {
    return (
      <Screen>
        <ScreenHeader title="Results Calendar" />
        <Skeleton className="h-[560px]" />
      </Screen>
    );
  }

  if (q.isError) {
    return (
      <Screen>
        <ScreenHeader title="Results Calendar" />
        <EmptyState
          title="Could not load the results calendar"
          description={String((q.error as Error).message)}
          actions={<Button onClick={() => q.refetch()}>Retry</Button>}
        />
      </Screen>
    );
  }

  const d = q.data!.data;
  const entriesByDay = new Map<string, ResultsCalendarEntry[]>();
  for (const entry of d.entries) {
    const list = entriesByDay.get(entry.date) ?? [];
    list.push(entry);
    entriesByDay.set(entry.date, list);
  }

  const days = monthGrid(cursor.year, cursor.month);
  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const todayStr = ymd(today);

  // Bound navigation to roughly the ±30-day window the data actually covers.
  const minMonth = new Date(d.window.from + "T00:00:00");
  const maxMonth = new Date(d.window.to + "T00:00:00");
  const atMin = cursor.year === minMonth.getFullYear() && cursor.month === minMonth.getMonth();
  const atMax = cursor.year === maxMonth.getFullYear() && cursor.month === maxMonth.getMonth();

  function shiftMonth(delta: number) {
    setCursor((c) => {
      const next = new Date(c.year, c.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  }

  const upcomingCount = d.entries.filter((e) => e.status === "upcoming").length;
  const goodCount = d.entries.filter((e) => e.status === "good").length;

  return (
    <Screen>
      <ScreenHeader
        title="Results Calendar"
        subtitle={`${upcomingCount} upcoming quarterly results · ${goodCount} recently filed results AI judged genuinely good`}
      />

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-3">
            <span className="text-[15px] font-semibold">{monthLabel}</span>
            <div className="flex gap-1">
              <button
                onClick={() => shiftMonth(-1)}
                disabled={atMin}
                className="flex h-7 w-7 items-center justify-center rounded border border-border text-text-secondary hover:bg-surface-2 disabled:cursor-default disabled:opacity-40"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => shiftMonth(1)}
                disabled={atMax}
                className="flex h-7 w-7 items-center justify-center rounded border border-border text-text-secondary hover:bg-surface-2 disabled:cursor-default disabled:opacity-40"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-text-secondary">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[var(--color-accent)]" /> upcoming
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-up-text" /> good result
            </span>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-border text-center text-[11px] font-medium text-text-muted">
          {WEEKDAYS.map((w) => (
            <div key={w} className="py-2">
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {days.map((day) => {
            const key = ymd(day);
            const inMonth = day.getMonth() === cursor.month;
            const isToday = key === todayStr;
            const entries = entriesByDay.get(key) ?? [];
            const shown = entries.slice(0, MAX_CHIPS_PER_DAY);
            const extra = entries.length - shown.length;

            return (
              <div
                key={key}
                className={cn(
                  "min-h-[92px] border-b border-r border-border p-1.5",
                  !inMonth && "bg-surface-2/40",
                )}
              >
                <div className={cn("text-[11px]", inMonth ? "text-text-secondary" : "text-text-faint", isToday && "font-semibold text-accent")}>
                  {day.getDate()}
                </div>
                <div className="mt-1 flex flex-col gap-0.5">
                  {shown.map((entry, i) => (
                    <Link
                      key={`${entry.symbol}-${i}`}
                      href={`/chart/${toSlug(entry.symbol)}?back=${encodeURIComponent("/calendar")}`}
                      title={entry.rationale ?? entry.name}
                      className={cn(
                        "truncate rounded px-1 py-0.5 text-[10px] font-medium",
                        entry.status === "good" ? "bg-[rgba(22,163,74,0.12)] text-up-text" : "bg-[var(--color-accent-tint)] text-accent",
                      )}
                    >
                      {entry.symbol}
                    </Link>
                  ))}
                  {extra > 0 && <div className="px-1 text-[10px] text-text-muted">+{extra} more</div>}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="mt-2 flex items-start gap-2 p-3">
        <span className="text-[12px]">✦</span>
        <div className="text-[11px] leading-relaxed text-text-secondary">
          <span className="font-medium text-text">Upcoming</span> dates come straight from NSE&apos;s board-meeting filings — always shown,
          unjudged. <span className="font-medium text-text">Good result</span> is an AI verdict from the real filed figures once results land
          — a bad or not-yet-filed result is simply absent here, not flagged.
        </div>
      </Card>
    </Screen>
  );
}
