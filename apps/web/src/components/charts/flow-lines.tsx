"use client";

import { useState } from "react";

import type { FlowPoint } from "@/lib/api/market-types";
import { change } from "@/lib/format";

const FII = "var(--color-info)";
const DII = "var(--color-accent)";
const W = 460;
const PAD = 10;

function path(points: [number, number][]): string {
  return points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
}

/** FII vs DII net, ₹ cr, as two lines around a zero baseline. Lines (rather than the
 * old grouped bars) because the useful read is the *trend* of each side and whether
 * they are crossing — bars showed the same numbers but made that hard to see. */
export function FlowLines({ series, height = 168 }: { series: FlowPoint[]; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  if (series.length === 0) return null;

  const mid = height / 2;
  const max = Math.max(1, ...series.flatMap((p) => [Math.abs(p.fii_net ?? 0), Math.abs(p.dii_net ?? 0)]));
  const step = series.length > 1 ? (W - PAD * 2) / (series.length - 1) : 0;
  const x = (i: number) => PAD + i * step;
  const y = (v: number) => mid - (v / max) * (mid - 10);

  const line = (key: "fii_net" | "dii_net") =>
    path(series.map((p, i) => [x(i), y(p[key] ?? 0)] as [number, number]));

  const h = hover != null ? series[hover] : null;

  return (
    <div className="relative">
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${W} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="FII and DII net flow per session"
        onMouseLeave={() => setHover(null)}
      >
        <line x1={0} y1={mid} x2={W} y2={mid} stroke="var(--color-border-strong)" />
        <path d={line("fii_net")} fill="none" stroke={FII} strokeWidth={1.75} vectorEffect="non-scaling-stroke" />
        <path d={line("dii_net")} fill="none" stroke={DII} strokeWidth={1.75} vectorEffect="non-scaling-stroke" />
        {series.map((p, i) => (
          <g key={p.date} onMouseEnter={() => setHover(i)}>
            <rect x={x(i) - step / 2} y={0} width={Math.max(step, 8)} height={height} fill="transparent" />
            <circle cx={x(i)} cy={y(p.fii_net ?? 0)} r={hover === i ? 3.5 : 2} fill={FII} />
            <circle cx={x(i)} cy={y(p.dii_net ?? 0)} r={hover === i ? 3.5 : 2} fill={DII} />
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
            <span style={{ color: FII }}>FII</span> {change(h.fii_net)} · <span style={{ color: DII }}>DII</span>{" "}
            {change(h.dii_net)}
          </div>
        </div>
      )}
    </div>
  );
}
