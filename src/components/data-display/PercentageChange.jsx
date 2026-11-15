"use client";

import React from "react";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

export function PercentageChange({
  value,
  showIcon = true,
  showBg = true,
  decimals = 2,
  className = "",
}) {
  if (value === null || value === undefined || isNaN(value)) {
    return <span className="text-[#94A3B8]">—</span>;
  }

  const isPositive = value > 0;
  const isNegative = value < 0;
  const isZero = value === 0;

  const colorStyles = isPositive
    ? "text-[#16A878]"
    : isNegative
    ? "text-[#F05283]"
    : "text-[#94A3B8]";

  const bgStyles = showBg
    ? isPositive
      ? "bg-[#E8F8F3] px-1.5 py-0.5 rounded-[4px]"
      : isNegative
      ? "bg-[#FEF0F4] px-1.5 py-0.5 rounded-[4px]"
      : "bg-[#F1F5F9] px-1.5 py-0.5 rounded-[4px]"
    : "";

  return (
    <span
      className={`inline-flex items-center gap-0.5 font-semibold tabular-nums text-xs ${colorStyles} ${bgStyles} ${className}`}
    >
      {showIcon && isPositive && <ArrowUpRight size={13} strokeWidth={2.2} />}
      {showIcon && isNegative && <ArrowDownRight size={13} strokeWidth={2.2} />}
      {showIcon && isZero && <Minus size={13} />}
      <span>
        {isPositive ? "+" : ""}
        {value.toFixed(decimals)}%
      </span>
    </span>
  );
}

export default PercentageChange;
