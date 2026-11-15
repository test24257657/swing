"use client";

import React from "react";
import { Info } from "lucide-react";

export function PageContainer({ children, className = "" }) {
  return (
    <div className={`w-full max-w-[1600px] mx-auto space-y-4 pb-12 ${className}`}>
      {children}
    </div>
  );
}

export function SectionHeader({
  title,
  subtitle,
  info,
  action,
  className = "",
}) {
  return (
    <div
      className={`flex items-center justify-between pb-2 border-b border-[#E5EAF2] ${className}`}
    >
      <div className="flex items-center gap-2">
        <h2 className="text-[14px] font-semibold text-[#17233B] tracking-tight">
          {title}
        </h2>
        {info && (
          <span
            className="text-[#94A3B8] hover:text-[#64748B] cursor-pointer transition-colors"
            title={info}
          >
            <Info size={14} />
          </span>
        )}
        {subtitle && (
          <span className="text-[12px] text-[#64748B] ml-2 hidden sm:inline">
            {subtitle}
          </span>
        )}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}

export default PageContainer;
