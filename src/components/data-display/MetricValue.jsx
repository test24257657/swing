"use client";

import React from "react";
import { formatINR } from "@/lib/formatters";

export function MetricValue({
  value,
  prefix = "",
  suffix = "",
  decimals = 2,
  size = "md",
  className = "",
}) {
  const sizeClass = {
    sm: "text-xs",
    md: "text-sm font-semibold",
    lg: "text-lg font-bold",
    xl: "text-2xl font-bold tracking-tight",
  }[size] || "text-sm font-semibold";

  const formatted =
    typeof value === "number" ? formatINR(value, decimals) : value ?? "—";

  return (
    <span className={`tabular-nums text-[#17233B] ${sizeClass} ${className}`}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

export default MetricValue;
