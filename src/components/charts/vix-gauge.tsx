"use client";

import React from "react";

const VIX_BANDS = [
  { key: "low", to: 13, color: "#16a34a", label: "Calm (<13)" },
  { key: "moderate", to: 18, color: "#2563eb", label: "Moderate (13-18)" },
  { key: "elevated", to: 24, color: "#d97706", label: "Elevated (18-24)" },
  { key: "high", to: 32, color: "#dc2626", label: "High (>24)" },
] as const;

const VIX_SCALE_MAX = 32;

export function VixGauge({
  value,
  percentile,
}: {
  value: number;
  percentile?: number | null;
}) {
  const markerPct = Math.min(98, Math.max(2, (value / VIX_SCALE_MAX) * 100));
  let from = 0;

  return (
    <div className="mt-3 w-full">
      <div className="relative flex h-2.5 overflow-hidden rounded-full border border-border/40">
        {VIX_BANDS.map((b) => {
          const to = Math.min(b.to, VIX_SCALE_MAX);
          const width = ((to - from) / VIX_SCALE_MAX) * 100;
          from = to;
          return <div key={b.key} style={{ width: `${width}%`, background: b.color }} />;
        })}
        <div
          className="absolute top-1/2 h-4 w-4 -translate-y-1/2 -translate-x-1/2 rounded-full border-2 border-white shadow-md transition-all duration-300"
          style={{ left: `${markerPct}%`, background: "#0f172a" }}
        />
      </div>

      <div className="mt-1.5 flex justify-between text-[11px] font-mono font-medium text-text-muted">
        <span>Calm</span>
        <span>Moderate</span>
        <span>Elevated</span>
        <span>Extreme</span>
      </div>

      {percentile != null && (
        <div className="mt-1.5 text-xs font-mono text-text-secondary">
          {percentile >= 50 ? "Choppier" : "Calmer"} than{" "}
          <span className="font-bold text-text">
            {(percentile >= 50 ? percentile : 100 - percentile).toFixed(0)}%
          </span>{" "}
          of the last 250 sessions
        </div>
      )}
    </div>
  );
}

export default VixGauge;

