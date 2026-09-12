"use client";

import { useState } from "react";

import type { FlowPoint } from "@/lib/api/market-types";

/** Grouped FII/DII net bars, ₹ cr, zero line in the middle. */
export function FlowBars({ series, height = 168 }: { series: FlowPoint[]; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const width = 460;
  const mid = height / 2;
  const vals = series.flatMap((p) => [p.fii_net ?? 0, p.dii_net ?? 0]);
  const max = Math.max(1, ...vals.map(Math.abs));
  const step = width / Math.max(series.length, 1);
  const bw = Math.min(14, step / 3);

  const h = hover != null ? series[hover] : null;
  const hx = hover != null ? hover * step + step / 2 : 0;

  return (
    <div className="relative">
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        onMouseLeave={() => setHover(null)}
      >
        <line x1={0} y1={mid} x2={width} y2={mid} stroke="var(--color-border-strong)" />
        {series.map((p, i) => {
          const x = i * step + step / 2;
          const fii = ((p.fii_net ?? 0) / max) * (mid - 8);
          const dii = ((p.dii_net ?? 0) / max) * (mid - 8);
          return (
            <g key={p.date} onMouseEnter={() => setHover(i)} className="cursor-pointer">
              <rect x={x - step / 2} y={0} width={step} height={height} fill="transparent" />
              <rect
                x={x - bw - 1}
                y={fii >= 0 ? mid - fii : mid}
                width={bw}
                height={Math.abs(fii)}
                fill="var(--color-info)"
                opacity={hover === null || hover === i ? 0.85 : 0.35}
                rx={1}
              />
              <rect
                x={x + 1}
                y={dii >= 0 ? mid - dii : mid}
                width={bw}
                height={Math.abs(dii)}
                fill="var(--color-accent)"
                opacity={hover === null || hover === i ? 0.85 : 0.35}
                rx={1}
              />
            </g>
          );
        })}
      </svg>
      {h && (
        <div
          className="tnum pointer-events-none absolute z-50 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-surface px-2 py-1 text-[11px] shadow-lg"
          style={{ left: `${(hx / width) * 100}%`, top: 0 }}
        >
          <div className="font-medium">{h.date}</div>
          <div className="text-[var(--color-info-text)]">FII {h.fii_net?.toLocaleString("en-IN") ?? "—"}</div>
          <div className="text-accent">DII {h.dii_net?.toLocaleString("en-IN") ?? "—"}</div>
        </div>
      )}
    </div>
  );
}
