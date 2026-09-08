import type { FlowPoint } from "@/lib/api/market-types";

/** Grouped FII/DII net bars, ₹ cr, zero line in the middle. */
export function FlowBars({ series, height = 168 }: { series: FlowPoint[]; height?: number }) {
  const width = 460;
  const mid = height / 2;
  const vals = series.flatMap((p) => [p.fii_net ?? 0, p.dii_net ?? 0]);
  const max = Math.max(1, ...vals.map(Math.abs));
  const step = width / Math.max(series.length, 1);
  const bw = Math.min(14, step / 3);

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <line x1={0} y1={mid} x2={width} y2={mid} stroke="var(--color-border-strong)" />
      {series.map((p, i) => {
        const x = i * step + step / 2;
        const fii = ((p.fii_net ?? 0) / max) * (mid - 8);
        const dii = ((p.dii_net ?? 0) / max) * (mid - 8);
        return (
          <g key={p.date}>
            <rect
              x={x - bw - 1}
              y={fii >= 0 ? mid - fii : mid}
              width={bw}
              height={Math.abs(fii)}
              fill="var(--color-info)"
              opacity={0.85}
              rx={1}
            />
            <rect
              x={x + 1}
              y={dii >= 0 ? mid - dii : mid}
              width={bw}
              height={Math.abs(dii)}
              fill="var(--color-accent)"
              opacity={0.85}
              rx={1}
            />
          </g>
        );
      })}
    </svg>
  );
}
