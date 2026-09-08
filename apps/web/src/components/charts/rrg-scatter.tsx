import type { RrgPoint } from "@/lib/api/market-types";

/**
 * Relative Rotation Graph. X = RS-ratio (100 = in line with the benchmark),
 * Y = RS-momentum. Four quadrants: Leading (top-right), Weakening (bottom-right),
 * Lagging (bottom-left), Improving (top-left). Tails show the last few weekly readings.
 */
export function RrgScatter({ points }: { points: RrgPoint[] }) {
  const W = 1200;
  const H = 420;
  const pad = 60;

  const xs = points.flatMap((p) => [p.x, ...p.tail.map((t) => t[0])]);
  const ys = points.flatMap((p) => [p.y, ...p.tail.map((t) => t[1])]);
  const xMin = Math.min(96, ...xs);
  const xMax = Math.max(104, ...xs);
  const yMin = Math.min(96, ...ys);
  const yMax = Math.max(104, ...ys);

  const sx = (v: number) => pad + ((v - xMin) / (xMax - xMin || 1)) * (W - 2 * pad);
  const sy = (v: number) => H - pad - ((v - yMin) / (yMax - yMin || 1)) * (H - 2 * pad);
  const cx = sx(100);
  const cy = sy(100);

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      <rect x={cx} y={pad} width={W - pad - cx} height={cy - pad} fill="rgba(22,163,74,0.05)" />
      <rect x={pad} y={pad} width={cx - pad} height={cy - pad} fill="rgba(37,99,235,0.05)" />
      <rect x={pad} y={cy} width={cx - pad} height={H - pad - cy} fill="rgba(220,38,38,0.05)" />
      <rect x={cx} y={cy} width={W - pad - cx} height={H - pad - cy} fill="rgba(217,119,6,0.05)" />
      <line x1={cx} y1={pad} x2={cx} y2={H - pad} stroke="var(--color-border-strong)" />
      <line x1={pad} y1={cy} x2={W - pad} y2={cy} stroke="var(--color-border-strong)" />

      <text x={W - pad} y={pad + 14} textAnchor="end" className="fill-up-text text-[11px] font-medium">LEADING</text>
      <text x={pad} y={pad + 14} className="fill-[var(--color-info-text)] text-[11px] font-medium">IMPROVING</text>
      <text x={pad} y={H - pad - 6} className="fill-down-text text-[11px] font-medium">LAGGING</text>
      <text x={W - pad} y={H - pad - 6} textAnchor="end" className="fill-stale-text text-[11px] font-medium">WEAKENING</text>

      {points.map((p) => {
        const tail = p.tail.map(([x, y]) => `${sx(x).toFixed(0)},${sy(y).toFixed(0)}`).join(" ");
        const color = p.y >= 100 ? "var(--color-up)" : "var(--color-down)";
        return (
          <g key={p.slug}>
            <polyline points={tail} fill="none" stroke={color} strokeWidth={1.25} opacity={0.35} />
            <circle cx={sx(p.x)} cy={sy(p.y)} r={6} fill={color} />
            <text x={sx(p.x) + 10} y={sy(p.y) + 4} className="fill-[var(--color-text)] text-[11px] font-medium">
              {p.name.replace("Nifty ", "")}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
