"use client";

import React, { useState, useEffect } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
} from "recharts";
import CHART_THEME from "@/lib/chart-theme";
import ChartTooltip from "./ChartTooltip";

export function DivergingBarChart({
  data = [],
  xKey = "session",
  dataKey = "val",
  height = 50,
  posColor = "#3478F6",
  negColor = "#F05283",
  showAxis = false,
  tooltipFormatter,
  className = "",
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div style={{ height }} className="w-full bg-[#F8FAFC] rounded-[4px]" />;
  }

  if (!data || !data.length) {
    return (
      <div
        style={{ height }}
        className="w-full flex items-center justify-center text-xs text-[#94A3B8]"
      >
        No session data
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height }} className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 2, right: 0, left: 0, bottom: 0 }}
          barCategoryGap={1.5}
        >
          {showAxis && <CartesianGrid {...CHART_THEME.grid} />}
          {showAxis && (
            <XAxis dataKey={xKey} {...CHART_THEME.axis} interval="preserveStartEnd" />
          )}
          {showAxis && <YAxis {...CHART_THEME.axis} />}

          <ReferenceLine y={0} stroke="#E2E8F0" strokeWidth={1} />

          <Tooltip
            content={<ChartTooltip formatter={tooltipFormatter} />}
            cursor={{ fill: "rgba(148, 163, 184, 0.08)" }}
          />

          <Bar dataKey={dataKey} maxBarSize={14} radius={[1.5, 1.5, 1.5, 1.5]}>
            {data.map((entry, index) => {
              const val = entry[dataKey];
              const isPositive = val >= 0;
              return (
                <Cell
                  key={`cell-${index}`}
                  fill={isPositive ? posColor : negColor}
                />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default DivergingBarChart;

