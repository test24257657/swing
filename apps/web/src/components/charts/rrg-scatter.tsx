"use client";

import { useState } from "react";

import type { SectorRow } from "@/lib/api/market-types";
import { cn } from "@/lib/cn";

const COLORS = [
  "#7c3aed", "#2563eb", "#16a34a", "#d97706", "#dc2626", "#0ea5e9",
  "#db2777", "#65a30d", "#ea580c", "#0d9488", "#9333ea", "#4338ca",
];

export function shortName(name: string): string {
  return name.replace(/^NIFTY /, "").replace(/ INDEX$/, "");
}

/** Simplified relative-rotation graph: X = 30-session relative-strength ratio vs the
 * benchmark (rebased to 100), Y = that ratio's 10-week rate of change. Quadrants read
 * the same way the classic RRG does — Leading (top-right) is where you want to already
 * be; Improving (top-left) is where momentum is turning up before price catches on.
 *
 * With 12 sectors and 6-point tails, drawing every name inline overlaps badly — labels
 * only show for the hovered/selected sector; the rest are identified via the legend
 * (hover a legend row to highlight its line on the chart, and vice versa). */
export function RrgScatter({ sectors, height = 430 }: { sectors: SectorRow[]; height?: number }) {
  const [hover, setHover] = useState<string | null>(null);
  const width = 780;
  const withTail = sectors.filter((s) => s.rs_tail.length > 0);
  if (withTail.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-[13px] text-text-muted">
        Not enough history yet to plot the rotation graph.
      </div>
    );
  }

  const allPoints = withTail.flatMap((s) => s.rs_tail);
  const xs = allPoints.map((p) => p.x);
  const ys = allPoints.map((p) => p.y);
  const xMin = Math.min(100, ...xs) - 1;
  const xMax = Math.max(100, ...xs) + 1;
  const yMin = Math.min(0, ...ys) - 1;
  const yMax = Math.max(0, ...ys) + 1;
  const xScale = (x: number) => ((x - xMin) / (xMax - xMin)) * width;
  const yScale = (y: number) => height - ((y - yMin) / (yMax - yMin)) * height;
  const midX = xScale(100);
  const midY = yScale(0);

  return (
    <div className="flex flex-col gap-3 lg:flex-row">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        className="min-w-0 flex-1 overflow-visible"
        onMouseLeave={() => setHover(null)}
      >
        <rect x={0} y={0} width={midX} height={midY} fill="rgba(37,99,235,0.05)" />
        <rect x={midX} y={0} width={width - midX} height={midY} fill="rgba(22,163,74,0.05)" />
        <rect x={0} y={midY} width={midX} height={height - midY} fill="rgba(220,38,38,0.05)" />
        <rect x={midX} y={midY} width={width - midX} height={height - midY} fill="rgba(217,119,6,0.05)" />
        <line x1={midX} y1={0} x2={midX} y2={height} stroke="rgba(9,9,11,0.14)" />
        <line x1={0} y1={midY} x2={width} y2={midY} stroke="rgba(9,9,11,0.14)" />

        <text x={midX - 8} y={16} textAnchor="end" fill="#2563eb" fontSize={11} fontWeight={500} opacity={0.9}>
          IMPROVING
        </text>
        <text x={width - 8} y={16} textAnchor="end" fill="#16a34a" fontSize={11} fontWeight={500} opacity={0.9}>
          LEADING
        </text>
        <text x={midX - 8} y={height - 10} textAnchor="end" fill="#dc2626" fontSize={11} fontWeight={500} opacity={0.9}>
          LAGGING
        </text>
        <text x={width - 8} y={height - 10} textAnchor="end" fill="#d97706" fontSize={11} fontWeight={500} opacity={0.9}>
          WEAKENING
        </text>

        {withTail.map((s, i) => {
          const c = COLORS[i % COLORS.length];
          const isHover = hover === s.name;
          const dim = hover !== null && !isHover;
          const pts = s.rs_tail.map((p) => `${xScale(p.x)},${yScale(p.y)}`).join(" ");
          const last = s.rs_tail.at(-1)!;
          const lx = xScale(last.x);
          const ly = yScale(last.y);
          return (
            <g
              key={s.name}
              opacity={dim ? 0.15 : 1}
              className="cursor-pointer transition-opacity"
              onMouseEnter={() => setHover(s.name)}
            >
              <polyline points={pts} fill="none" stroke={c} strokeWidth={isHover ? 2 : 1} opacity={isHover ? 0.8 : 0.4} />
              <circle cx={lx} cy={ly} r={isHover ? 7 : 5} fill={c} stroke="#fff" strokeWidth={isHover ? 1.5 : 0} />
              {isHover && (
                <text x={lx + 10} y={ly + 4} fontSize={12} fontWeight={600} fill="var(--color-text)">
                  {shortName(s.name)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div className="flex flex-wrap gap-x-3 gap-y-1 lg:w-36 lg:shrink-0 lg:flex-col lg:flex-nowrap">
        {withTail.map((s, i) => (
          <button
            key={s.name}
            onMouseEnter={() => setHover(s.name)}
            onMouseLeave={() => setHover(null)}
            className={cn(
              "flex items-center gap-1.5 rounded px-1.5 py-1 text-left text-[11px]",
              hover === s.name ? "bg-surface-2 font-medium text-text" : "text-text-secondary",
            )}
          >
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
            <span className="truncate">{shortName(s.name)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
