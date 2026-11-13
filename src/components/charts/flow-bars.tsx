"use client";

import React, { useState } from "react";

export interface FlowPoint {
  date: string;
  fii_net?: number | null;
  dii_net?: number | null;
}

export function FlowBars({
  series,
  height = 140,
}: {
  series: FlowPoint[];
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);

  if (!series || !series.length) {
    return (
      <div className="flex items-center justify-center h-28 text-xs font-mono text-text-muted">
        No recent FII / DII flow data
      </div>
    );
  }

  const width = 420;
  const mid = height / 2;
  const vals = series.flatMap((p) => [p.fii_net ?? 0, p.dii_net ?? 0]);
  const max = Math.max(100, ...vals.map(Math.abs));
  const step = width / Math.max(series.length, 1);
  const bw = Math.min(12, Math.max(4, step / 3));

  const h = hover != null ? series[hover] : null;
  const hx = hover != null ? hover * step + step / 2 : 0;

  return (
    <div className="relative w-full">
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        onMouseLeave={() => setHover(null)}
        className="overflow-visible"
      >
        {/* Zero baseline */}
        <line
          x1={0}
          y1={mid}
          x2={width}
          y2={mid}
          stroke="#cbd5e1"
          strokeDasharray="3 3"
        />

        {series.map((p, i) => {
          const x = i * step + step / 2;
          const fii = ((p.fii_net ?? 0) / max) * (mid - 10);
          const dii = ((p.dii_net ?? 0) / max) * (mid - 10);

          return (
            <g
              key={p.date || i}
              onMouseEnter={() => setHover(i)}
              className="cursor-pointer"
            >
              <rect
                x={x - step / 2}
                y={0}
                width={step}
                height={height}
                fill="transparent"
              />
              {/* FII bar (Blue #2563eb) */}
              <rect
                x={x - bw - 1}
                y={fii >= 0 ? mid - fii : mid}
                width={bw}
                height={Math.max(2, Math.abs(fii))}
                fill="#2563eb"
                opacity={hover === null || hover === i ? 0.9 : 0.35}
                rx={1.5}
              />
              {/* DII bar (Violet #7c3aed) */}
              <rect
                x={x + 1}
                y={dii >= 0 ? mid - dii : mid}
                width={bw}
                height={Math.max(2, Math.abs(dii))}
                fill="#7c3aed"
                opacity={hover === null || hover === i ? 0.9 : 0.35}
                rx={1.5}
              />
            </g>
          );
        })}
      </svg>

      {h && (
        <div
          className="pointer-events-none absolute z-20 -translate-x-1/2 whitespace-nowrap rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-mono shadow-md"
          style={{ left: `${(hx / width) * 100}%`, top: -10 }}
        >
          <div className="font-bold text-text mb-0.5">{h.date}</div>
          <div className="text-blue-600 font-semibold">
            FII: {h.fii_net != null ? `${h.fii_net >= 0 ? "+" : ""}${Math.round(h.fii_net).toLocaleString("en-IN")} Cr` : "—"}
          </div>
          <div className="text-accent font-semibold">
            DII: {h.dii_net != null ? `${h.dii_net >= 0 ? "+" : ""}${Math.round(h.dii_net).toLocaleString("en-IN")} Cr` : "—"}
          </div>
        </div>
      )}
    </div>
  );
}

export default FlowBars;

