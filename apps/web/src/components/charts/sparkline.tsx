"use client";

import { useEffect, useRef, useState } from "react";

/**
 * `width` is a maximum, not a fixed size — the sparkline measures its actual container
 * and shrinks to fit (a fixed pixel width here was overflowing 2-column mobile tiles;
 * see docs/phase-6.md-adjacent UX pass). Point math is redone against the real
 * measured width so the line and the hover hit-test both stay accurate at any size.
 */
export function Sparkline({
  data,
  width = 96,
  height = 34,
  stroke,
}: {
  data: number[];
  width?: number;
  height?: number;
  stroke: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setMeasured(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const w = measured ?? width;

  if (data.length < 2) {
    return <div ref={containerRef} className="min-w-0 flex-1" style={{ maxWidth: width, height }} />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const points = data.map((v, i) => ({
    x: (i / (data.length - 1)) * w,
    y: height - 2 - ((v - min) / span) * (height - 4),
    v,
  }));
  const pts = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  function pick(clientX: number, rect: DOMRect) {
    const relX = ((clientX - rect.left) / rect.width) * w;
    let nearest = 0;
    let best = Infinity;
    for (let i = 0; i < points.length; i++) {
      const d = Math.abs(points[i].x - relX);
      if (d < best) {
        best = d;
        nearest = i;
      }
    }
    setHover(nearest);
  }

  const h = hover != null ? points[hover] : null;
  const sessionsAgo = hover != null ? points.length - 1 - hover : 0;

  return (
    <div ref={containerRef} className="relative min-w-0 flex-1" style={{ maxWidth: width, height }}>
      <svg
        width={w}
        height={height}
        className="overflow-visible"
        onMouseMove={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect())}
        onMouseLeave={() => setHover(null)}
      >
        <polyline points={pts} fill="none" stroke={stroke} strokeWidth={1.25} />
        {h && (
          <>
            <line x1={h.x} y1={0} x2={h.x} y2={height} stroke={stroke} strokeWidth={0.75} opacity={0.35} />
            <circle cx={h.x} cy={h.y} r={2.5} fill={stroke} />
          </>
        )}
      </svg>
      {h && (
        <div
          className="tnum pointer-events-none absolute z-50 -translate-x-1/2 whitespace-nowrap rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] shadow-sm"
          style={{ left: h.x, top: -22 }}
        >
          {h.v.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
          <span className="ml-1 text-text-faint">
            {sessionsAgo === 0 ? "latest" : `-${sessionsAgo}d`}
          </span>
        </div>
      )}
    </div>
  );
}
