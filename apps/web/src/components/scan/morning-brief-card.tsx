"use client";

import Link from "next/link";

import { Card, Chip } from "@/components/ui";
import { useMorningBrief } from "@/lib/api/market-hooks";
import type { MorningBrief } from "@/lib/api/market-types";
import { cn } from "@/lib/cn";
import { count, pct, price } from "@/lib/format";
import { toSlug } from "@/lib/slug";

import { toneClass } from "./scan-parts";

const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k` : count(n));

const TONE_CHIP = { positive: "up", negative: "down", mixed: "neutral" } as const;

/** Pre-market brief. Shown only while it is still ahead of the market: once the
 * session it was written for has closed (pulse as_of catches up), it's stale and
 * steps aside for the post-close view. */
export function MorningBriefCard({ lastClose }: { lastClose: string }) {
  const q = useMorningBrief();
  const b = q.data?.data;
  if (!b || b.for_session <= lastClose) return null;
  return <Brief b={b} />;
}

function Brief({ b }: { b: MorningBrief }) {
  const groups = (["US", "Asia", "Macro"] as const).map((g) => ({ g, rows: b.global_cues.filter((c) => c.group === g) }));
  const time = new Date(b.generated_at).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });

  return (
    <Card className="mb-2 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-[15px] font-semibold">☀️ Morning brief</h2>
          <Chip tone={TONE_CHIP[b.global_tone.tone]}>Global cues {b.global_tone.tone}</Chip>
        </div>
        <span className="font-mono text-[11px] text-text-faint">
          for {b.for_session} · built {time} IST
        </span>
      </div>

      {b.ai && (
        <div className="mt-3 rounded-md border border-[var(--color-accent-border)] bg-[var(--color-accent-tint)] px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold">{b.ai.headline}</span>
            <span className="text-[11px] font-medium text-accent">✦ AI</span>
          </div>
          <ul className="mt-1.5 space-y-1 text-[12px] leading-relaxed text-text-secondary">
            {b.ai.points.map((p) => (
              <li key={p} className="flex gap-1.5">
                <span className="text-text-faint">•</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {b.community && b.community.items.length > 0 && (
        <div className="mt-3 rounded-md border border-border px-3 py-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
              📰 In the news &amp; community · last {b.community.window_days} days
            </span>
            <span className="text-[11px] text-text-faint">what people are discussing — not verified, not advice</span>
          </div>
          <ul className="mt-1.5 space-y-1.5">
            {b.community.items.map((c) => (
              <li key={c.url} className="text-[12px] leading-snug">
                <a href={c.url} target="_blank" rel="noopener noreferrer nofollow" className="text-text hover:text-accent hover:underline">
                  {c.title}
                </a>
                <div className="tnum text-[11px] text-text-muted">
                  {c.where} · {c.date}
                  {c.views != null && <> · {compact(c.views)} views</>}
                  {c.upvotes != null && <> · {compact(c.upvotes)} upvotes</>}
                  {c.comments != null && <> · {compact(c.comments)} comments</>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Global cues */}
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {groups.map(({ g, rows }) => (
          <div key={g} className="rounded-md border border-border px-3 py-2">
            <div className="text-[11px] font-medium uppercase tracking-wide text-text-muted">{g}</div>
            <div className="mt-1 space-y-0.5">
              {rows.map((c) => (
                <div key={c.label} className="tnum flex items-center justify-between gap-2 text-[12px]">
                  <span className="text-text-secondary">{c.label}</span>
                  <span>
                    <span className="text-text">{price(c.value)}</span>{" "}
                    <span className={cn("inline-block min-w-[56px] text-right", toneClass(c.change_pct))}>
                      {pct(c.change_pct)}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-1 gap-2 lg:grid-cols-3">
        {/* Nifty levels */}
        {b.nifty && (
          <div className="rounded-md border border-border px-3 py-2">
            <div className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
              NIFTY levels · last close {price(b.nifty.close)}
            </div>
            <div className="tnum mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[12px]">
              <span className="text-down-text">Resistance R2</span>
              <span className="text-right">{price(b.nifty.r2)}</span>
              <span className="text-down-text">Resistance R1</span>
              <span className="text-right">{price(b.nifty.r1)}</span>
              <span className="font-medium">Pivot</span>
              <span className="text-right font-medium">{price(b.nifty.pivot)}</span>
              <span className="text-up-text">Support S1</span>
              <span className="text-right">{price(b.nifty.s1)}</span>
              <span className="text-up-text">Support S2</span>
              <span className="text-right">{price(b.nifty.s2)}</span>
            </div>
            <div className="tnum mt-1.5 border-t border-border pt-1.5 text-[11px] text-text-muted">
              20 / 50 / 200-day: {price(b.nifty.sma_20)} · {price(b.nifty.sma_50)} · {price(b.nifty.sma_200)}
            </div>
          </div>
        )}

        {/* Stocks in focus */}
        <div className="rounded-md border border-border px-3 py-2">
          <div className="text-[11px] font-medium uppercase tracking-wide text-text-muted">Stocks in focus</div>
          {b.focus.length === 0 ? (
            <p className="mt-1.5 text-[12px] text-text-muted">No setups flagged last night.</p>
          ) : (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {b.focus.map((f) => (
                <Link
                  key={f.symbol}
                  href={`/chart/${toSlug(f.symbol)}?back=${encodeURIComponent("/pulse")}`}
                  title={f.why}
                  className="rounded-md border border-border px-2 py-0.5 text-[12px] hover:border-[var(--color-accent-border)] hover:text-accent"
                >
                  {f.symbol}
                </Link>
              ))}
            </div>
          )}
          {b.overnight_news.length > 0 && (
            <>
              <div className="mt-2.5 text-[11px] font-medium uppercase tracking-wide text-text-muted">
                Overnight announcements
              </div>
              <ul className="mt-1 space-y-1 text-[11px] leading-snug text-text-secondary">
                {b.overnight_news.slice(0, 5).map((n) => (
                  <li key={`${n.symbol}-${n.time}-${n.category}`}>
                    <span className="font-semibold text-text">{n.symbol}</span> · {n.category}
                    {n.url && (
                      <>
                        {" "}
                        <a href={n.url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                          filing
                        </a>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* Before you trade */}
        <div className="rounded-md border border-border px-3 py-2">
          <div className="text-[11px] font-medium uppercase tracking-wide text-text-muted">Before you trade</div>
          {b.events.length > 0 && (
            <ul className="mt-1.5 space-y-1 text-[12px] text-stale-text">
              {b.events.map((e) => (
                <li key={e}>⚠ {e}</li>
              ))}
            </ul>
          )}
          <ul className="mt-1.5 space-y-1 text-[12px] text-text-secondary">
            {b.checklist.map((c) => (
              <li key={c} className="flex gap-1.5">
                <span className="text-text-faint">☐</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-2.5 font-mono text-[11px] text-text-faint">
        source: Yahoo Finance (global) · NSE (NIFTY, announcements) · Reddit/YouTube via last30days (filtered) · AI
        summary from those numbers only · GIFT Nifty not shown (no verified free source)
      </div>
    </Card>
  );
}
