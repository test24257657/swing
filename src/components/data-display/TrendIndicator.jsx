"use client";

import React from "react";

export function TrendIndicator({ tone = "positive", label, text, className = "" }) {
  const dotColor = {
    positive: "bg-[#16A878]",
    negative: "bg-[#F05283]",
    neutral: "bg-[#94A3B8]",
    warning: "bg-[#E9A23B]",
  }[tone] || "bg-[#94A3B8]";

  const textColor = {
    positive: "text-[#16A878]",
    negative: "text-[#F05283]",
    neutral: "text-[#64748B]",
    warning: "text-[#E9A23B]",
  }[tone] || "text-[#64748B]";

  return (
    <div className={`flex items-start gap-2.5 ${className}`}>
      <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${dotColor}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-[#17233B]">{label}</span>
          <span className={`font-semibold ${textColor}`}>{text}</span>
        </div>
      </div>
    </div>
  );
}

export function LoadingSkeleton({ height = 120, className = "" }) {
  return (
    <div
      style={{ height }}
      className={`w-full bg-[#F1F5F9] rounded-[6px] animate-pulse flex items-center justify-center text-xs text-[#94A3B8] font-medium ${className}`}
    >
      Loading analytics...
    </div>
  );
}

export function EmptyState({ title = "No data available", message, action, className = "" }) {
  return (
    <div className={`py-8 text-center flex flex-col items-center justify-center ${className}`}>
      <div className="w-10 h-10 rounded-full bg-[#F1F5F9] flex items-center justify-center text-[#94A3B8] mb-2">
        📊
      </div>
      <div className="text-xs font-semibold text-[#17233B]">{title}</div>
      {message && <div className="text-[11px] text-[#64748B] mt-0.5">{message}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
