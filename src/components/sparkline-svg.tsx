import React from "react";

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}

export function SparklineSvg({
  data,
  width = 100,
  height = 24,
  color,
  className = "",
}: SparklineProps) {
  if (!data || data.length < 2) {
    return <div style={{ width, height }} className="bg-slate-800/20 rounded" />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  // Determine color based on start vs end if color not provided
  const isUp = data[data.length - 1] >= data[0];
  const strokeColor = color || (isUp ? "#00d084" : "#ff4d6a");

  const points = data
    .map((val, idx) => {
      const x = (idx / (data.length - 1)) * (width - 4) + 2;
      const y = height - 2 - ((val - min) / range) * (height - 6);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={`overflow-visible ${className}`}
    >
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}
export default SparklineSvg;
