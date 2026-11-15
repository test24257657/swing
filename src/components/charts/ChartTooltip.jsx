"use client";

import React from "react";
import CHART_THEME from "@/lib/chart-theme";

export function ChartTooltip({
  active,
  payload,
  label,
  valuePrefix = "",
  valueSuffix = "",
  formatter,
}) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div style={CHART_THEME.tooltip.contentStyle}>
      {label && (
        <div className="font-semibold text-[#17233B] text-[11px] mb-1.5 pb-1 border-b border-[#F1F5F9]">
          {label}
        </div>
      )}
      <div className="space-y-1">
        {payload.map((entry, idx) => {
          const val = entry.value;
          const displayVal = formatter
            ? formatter(val, entry.name)
            : typeof val === "number"
            ? `${valuePrefix}${val.toLocaleString("en-IN")}${valueSuffix}`
            : val;

          return (
            <div
              key={`item-${idx}`}
              className="flex items-center justify-between gap-4 text-xs"
            >
              <div className="flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: entry.color || entry.stroke }}
                />
                <span className="text-[#64748B] text-[11px]">{entry.name}:</span>
              </div>
              <span className="font-semibold text-[#17233B] tabular-nums text-[11px]">
                {displayVal}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ChartTooltip;

