"use client";

import { useState } from "react";

import type { BreadthPoint } from "@/lib/api/market-types";
import { pctPlain } from "@/lib/format";

const ADVANCING = "var(--color-accent)";
const ABOVE_50 = "var(--color-info)";
const W = 460;
const PAD = 10;

/** Breadth over the last ~30 sessions: the share of stocks rising each day, and the
 * share holding above their 50-day average. A single day's donut says who won today;
 * this says whether participation is improving or thinning, which is the read that
 * changes how you size a trade. 50% is drawn as the neutral line. */
export function BreadthTrend({ series, height = 150 }: { series: BreadthPoint[]; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  if (series.length < 2) return null;

  const step = (W - PAD * 2) / (series.length - 1);
  const x = (i: number) => PAD + i * step;
  const y = (v: number) => height - 8 - (v / 100) * (height - 20);

  const line = (pick: (p: BreadthPoint) => number | null) => {
    const pts = series
      .map((p, i) => [x(i), pick(p)] as [number, number | null])
      .filter((pt): pt is [number, number] => pt[1] != null)
      .map(([px, v]) => [px, y(v)] as [number, number]);
    return pts.map(([px, py], i) => `${i === 0 ? "M" : "L"}${px.toFixed(1)},${py.toFixed(1)}`).join(" ");
  };

  const h = hover != null ? series[hover] : null;

  return (
    <div className="relative">
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${W} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Share of stocks rising and above their 50-day average, last sessions"
        onMouseLeave={() => setHover(null)}
      >
        <line x1={0} y1={y(50)} x2={W} y2={y(50)} stroke="var(--color-border-strong)" strokeDasharray="4 4" />
        <path d={line((p) => p.pct_advancing)} fill="none" stroke={ADVANCING} strokeWidth={1.75} vectorEffect="non-scaling-stroke" />
        <path d={line((p) => p.pct_above_50dma)} fill="none" stroke={ABOVE_50} strokeWidth={1.75} vectorEffect="non-scaling-stroke" />
        {series.map((p, i) => (
          <g key={p.date} onMouseEnter={() => setHover(i)}>
            <rect x={x(i) - step / 2} y={0} width={Math.max(step, 8)} height={height} fill="transparent" />
            {hover === i && <circle cx={x(i)} cy={y(p.pct_advancing)} r={3.5} fill={ADVANCING} />}
            {hover === i && p.pct_above_50dma != null && (
              <circle cx={x(i)} cy={y(p.pct_above_50dma)} r={3.5} fill={ABOVE_50} />
            )}
          </g>
        ))}
        {hover != null && (
          <line x1={x(hover)} y1={0} x2={x(hover)} y2={height} stroke="var(--color-border-strong)" strokeDasharray="3 3" />
        )}
      </svg>
      {h && (
        <div className="pointer-events-none absolute left-0 top-0 rounded-md border border-border bg-surface px-2 py-1 text-[11px] shadow-sm">
          <div className="font-mono text-text-muted">{h.date}</div>
          <div className="tnum">
            <span style={{ color: ADVANCING }}>rising</span> {pctPlain(h.pct_advancing, 0)} ·{" "}
            <span style={{ color: ABOVE_50 }}>above 50 DMA</span> {pctPlain(h.pct_above_50dma, 0)}
          </div>
        </div>
      )}
    </div>
  );
}
