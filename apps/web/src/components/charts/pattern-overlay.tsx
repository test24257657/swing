"use client";

import type { IChartApi, ISeriesApi, Time } from "lightweight-charts";
import { useLayoutEffect, useRef, useState } from "react";

import type { ChartPattern } from "@/lib/api/market-types";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  stroke: string;
  label?: string;
  labelColor?: string;
}

/**
 * SVG annotation layer over the chart. Redraws VCP contraction zones and the breakout
 * box whenever the visible range or size changes (`tick` prop). Coordinates come from
 * the chart's own price/time scales, so the shapes track pan and zoom.
 */
export function PatternOverlay({
  chart,
  series,
  patterns,
  tick,
}: {
  chart: IChartApi | null;
  series: ISeriesApi<"Candlestick"> | null;
  patterns: ChartPattern[];
  tick: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [rects, setRects] = useState<Rect[]>([]);

  useLayoutEffect(() => {
    if (!chart || !series || !svgRef.current) return;
    const ts = chart.timeScale();
    const width = svgRef.current.clientWidth;
    const x = (t: string | null) => (t ? ts.timeToCoordinate(t as Time) : null);
    const y = (p: number | null) => (p != null ? series.priceToCoordinate(p) : null);

    const next: Rect[] = [];
    for (const pat of patterns) {
      const pivot = pat.pivot;
      const contractions = (pat.meta?.contractions as { depth_pct: number; trough_date?: string }[]) ?? [];
      const startX = x(pat.base_start_date) ?? 0;
      const endX = width;

      contractions.forEach((c, i) => {
        if (pivot == null) return;
        const top = y(pivot);
        const bot = y(pivot * (1 - c.depth_pct / 100));
        if (top == null || bot == null) return;
        next.push({
          x: Math.max(0, startX),
          y: top,
          w: Math.max(20, endX - Math.max(0, startX)),
          h: bot - top,
          fill: "rgba(124,58,237,0.10)",
          stroke: "rgba(124,58,237,0.32)",
          label: `T${i + 1} −${c.depth_pct}%`,
          labelColor: "#7c3aed",
        });
      });

      if (pat.breakout_date) {
        const bx = x(pat.breakout_date);
        const top = y(pivot);
        if (bx != null && top != null) {
          next.push({
            x: bx - 8,
            y: top - 26,
            w: 16,
            h: 26,
            fill: "rgba(22,163,74,0.14)",
            stroke: "#16a34a",
            label: "breakout",
            labelColor: "#15803d",
          });
        }
      }
    }
    setRects(next);
  }, [chart, series, patterns, tick]);

  return (
    <svg ref={svgRef} className="pointer-events-none absolute inset-0 h-full w-full">
      {rects.map((r, i) => (
        <g key={i}>
          <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={r.fill} stroke={r.stroke} strokeWidth={1} />
          {r.label && (
            <text x={r.x + 4} y={r.y + 11} fontSize={9} fontFamily="var(--font-mono)" fill={r.labelColor}>
              {r.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
