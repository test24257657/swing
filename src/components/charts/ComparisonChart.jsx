"use client";

import React, { useState, useEffect } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import CHART_THEME from "@/lib/chart-theme";
import ChartTooltip from "./ChartTooltip";

export function ComparisonChart({
  data = [],
  xKey = "date",
  lines = [],
  height = 120,
  referenceLines = [{ y: 0, color: "#E2E8F0" }],
  yUnit = "%",
  tooltipFormatter,
  className = "",
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        style={{ width: "100%", height, minHeight: height }}
        className="w-full bg-[#F8FAFC] rounded-[4px] animate-pulse"
      />
    );
  }

  return (
    <div
      style={{ width: "100%", height, minHeight: height }}
      className={`w-full min-w-0 relative ${className}`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 6, right: 8, left: -16, bottom: 0 }}
        >
          <CartesianGrid {...CHART_THEME.grid} />
          <XAxis dataKey={xKey} {...CHART_THEME.axis} interval="preserveStartEnd" />
          <YAxis
            domain={["auto", "auto"]}
            {...CHART_THEME.axis}
            tickFormatter={(val) => `${val}${yUnit}`}
          />
          <Tooltip
            content={<ChartTooltip valueSuffix={yUnit} formatter={tooltipFormatter} />}
          />
          {referenceLines.map((r, i) => (
            <ReferenceLine
              key={i}
              y={r.y}
              stroke={r.color || CHART_THEME.referenceLine.stroke}
              strokeDasharray={r.strokeDasharray || CHART_THEME.referenceLine.strokeDasharray}
            />
          ))}
          {lines.map((l) => (
            <Line
              key={l.key}
              type="monotone"
              dataKey={l.key}
              name={l.name || l.key}
              stroke={l.color || CHART_THEME.colors.primary}
              strokeWidth={l.strokeWidth || 1.75}
              dot={false}
              activeDot={{ r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default ComparisonChart;
