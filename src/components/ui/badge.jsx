"use client";

import React from "react";

export function StatusBadge({
  status, // 'positive' | 'negative' | 'neutral' | 'warning' | 'info'
  children,
  showDot = false,
  className = "",
}) {
  const styles = {
    positive: "bg-[#E8F8F3] text-[#16A878] border-[#B5ECD9]",
    bullish: "bg-[#E8F8F3] text-[#16A878] border-[#B5ECD9]",
    negative: "bg-[#FEF0F4] text-[#F05283] border-[#FCCEDB]",
    bearish: "bg-[#FEF0F4] text-[#F05283] border-[#FCCEDB]",
    neutral: "bg-[#F1F5F9] text-[#64748B] border-[#E2E8F0]",
    warning: "bg-[#FEF7EC] text-[#E9A23B] border-[#FBDFA9]",
    info: "bg-[#EFF6FF] text-[#3478F6] border-[#BFDBFE]",
  }[status] || "bg-[#F1F5F9] text-[#64748B] border-[#E2E8F0]";

  const dotColors = {
    positive: "bg-[#16A878]",
    bullish: "bg-[#16A878]",
    negative: "bg-[#F05283]",
    bearish: "bg-[#F05283]",
    neutral: "bg-[#94A3B8]",
    warning: "bg-[#E9A23B]",
    info: "bg-[#3478F6]",
  }[status] || "bg-[#94A3B8]";

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] border text-[11px] font-medium leading-tight ${styles} ${className}`}
    >
      {showDot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors}`} />}
      {children}
    </span>
  );
}

export function PillBadge({ children, active = false, onClick, className = "" }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-all ${
        active
          ? "bg-[#3478F6] text-white shadow-xs"
          : "bg-[#F1F5F9] text-[#64748B] hover:text-[#17233B] hover:bg-[#E2E8F0]"
      } ${className}`}
    >
      {children}
    </button>
  );
}

export default StatusBadge;

