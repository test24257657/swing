"use client";

import React, { useState } from "react";

const LABELS = ["Rising", "Falling", "Flat"] as const;

export function BreadthDonut({
  advances,
  declines,
  unchanged,
  size = 132,
}: {
  advances: number;
  declines: number;
  unchanged: number;
  size?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const total = advances + declines + unchanged || 1;
  const r = size / 2 - 14;
  const c = 2 * Math.PI * r;
  const seg = (n: number) => (n / total) * c;

  const values = [advances, declines, unchanged];
  const arcs = [
    { v: advances, color: "#16a34a" }, // UP (green)
    { v: declines, color: "#dc2626" }, // DOWN (red)
    { v: unchanged, color: "#94a3b8" }, // FLAT (slate)
  ];
  let offset = 0;

  const centerLabel = hover != null ? LABELS[hover] : "rising";
  const centerValue = hover != null ? values[hover] : advances;
  const centerPct = hover != null ? Math.round((values[hover] / total) * 100) : Math.round((advances / total) * 100);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0 overflow-visible"
      onMouseLeave={() => setHover(null)}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#e2e8f0"
        strokeWidth={14}
      />
      {arcs.map((a, i) => {
        const dash = seg(a.v);
        const isHover = hover === i;
        const el = (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={a.color}
            strokeWidth={isHover ? 17 : 14}
            strokeDasharray={`${dash} ${c - dash}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            className="cursor-pointer transition-all duration-200"
            onMouseEnter={() => setHover(i)}
            onClick={() => setHover((h) => (h === i ? null : i))}
          />
        );
        offset += dash;
        return el;
      })}
      <text
        x={size / 2}
        y={size / 2 - 2}
        textAnchor="middle"
        className="font-mono text-xl font-bold fill-text tabular-nums"
      >
        {centerValue.toLocaleString("en-IN")}
      </text>
      <text
        x={size / 2}
        y={size / 2 + 16}
        textAnchor="middle"
        className="font-mono text-[11px] font-medium fill-text-muted"
      >
        {`${centerLabel.toLowerCase()} · ${centerPct}%`}
      </text>
    </svg>
  );
}

export default BreadthDonut;

