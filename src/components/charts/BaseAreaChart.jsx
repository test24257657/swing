"use client";

import React, { useState, useEffect } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import CHART_THEME from "@/lib/chart-theme";
import ChartTooltip from "./ChartTooltip";

export function BaseAreaChart({
  data = [],
  xKey = "date",
  series = [], // [{ key: 'participation', name: 'Participation', color: '#3478F6', fill: true }]
  height = 160,
  referenceLines = [], // [{ y: 50, color: '#E2E8F0', label: '' }]
  yDomain = [0, 100],
  yUnit = "%",
  tooltipFormatter,
  className = "",
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div style={{ height }} className="w-full bg-[#F8FAFC] rounded-[6px]" />;
  }

  if (!data || !data.length) {
    return (
      <div
        style={{ height }}
        className="w-full flex items-center justify-center text-xs text-[#94A3B8]"
      >
        No chart data available
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height }} className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
          <defs>
            {series.map((s, idx) => (
              <linearGradient
                key={s.key}
                id={`gradient-${s.key}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor={s.color || CHART_THEME.colors.primary}
                  stopOpacity={0.22}
                />
                <stop
                  offset="100%"
                  stopColor={s.color || CHART_THEME.colors.primary}
                  stopOpacity={0.01}
                />
              </linearGradient>
            ))}
          </defs>

          <CartesianGrid {...CHART_THEME.grid} />

          <XAxis
            dataKey={xKey}
            {...CHART_THEME.axis}
            interval="preserveStartEnd"
          />

          <YAxis
            domain={yDomain}
            {...CHART_THEME.axis}
            tickFormatter={(val) => `${val}${yUnit}`}
          />

          <Tooltip
            content={
              <ChartTooltip
                valueSuffix={yUnit}
                formatter={tooltipFormatter}
              />
            }
          />

          {referenceLines.map((r, i) => (
            <ReferenceLine
              key={i}
              y={r.y}
              stroke={r.color || CHART_THEME.referenceLine.stroke}
              strokeDasharray={r.strokeDasharray || CHART_THEME.referenceLine.strokeDasharray}
            />
          ))}

          {series.map((s) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name || s.key}
              stroke={s.color || CHART_THEME.colors.primary}
              strokeWidth={s.strokeWidth || 1.75}
              fill={s.fill ? `url(#gradient-${s.key})` : "none"}
              dot={false}
              activeDot={{
                r: 4,
                stroke: "#FFFFFF",
                strokeWidth: 1.5,
                fill: s.color || CHART_THEME.colors.primary,
              }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BaseLineChart({
  data = [],
  xKey = "date",
  series = [],
  height = 140,
  referenceLines = [],
  yDomain = ["auto", "auto"],
  yUnit = "",
  tooltipFormatter,
  className = "",
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div style={{ height }} className="w-full bg-[#F8FAFC] rounded-[6px]" />;
  }

  return (
    <div style={{ width: "100%", height }} className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
          <CartesianGrid {...CHART_THEME.grid} />
          <XAxis dataKey={xKey} {...CHART_THEME.axis} interval="preserveStartEnd" />
          <YAxis
            domain={yDomain}
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
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name || s.key}
              stroke={s.color || CHART_THEME.colors.primary}
              strokeWidth={s.strokeWidth || 1.75}
              dot={false}
              activeDot={{ r: 4, stroke: "#FFFFFF", strokeWidth: 1.5 }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default BaseAreaChart;

