"use client";

import React from "react";
import { Info } from "lucide-react";

export function BaseCard({
  children,
  className = "",
  padding = "p-4",
  border = "border border-[#E5EAF2]",
  bg = "bg-white",
  rounded = "rounded-[8px]",
  ...props
}) {
  return (
    <div
      className={`${bg} ${border} ${rounded} ${padding} shadow-[0_1px_2px_0_rgba(15,23,42,0.04)] ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function SectionCard({
  title,
  subtitle,
  action,
  info,
  children,
  className = "",
  headerBorder = true,
  ...props
}) {
  return (
    <BaseCard className={className} padding="p-0" {...props}>
      {(title || action) && (
        <div
          className={`flex items-center justify-between px-4 py-3 ${
            headerBorder ? "border-b border-[#E5EAF2]" : ""
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <h3 className="text-[13px] font-semibold text-[#17233B] tracking-tight truncate">
              {title}
            </h3>
            {info && (
              <span
                className="text-[#94A3B8] hover:text-[#64748B] cursor-pointer transition-colors"
                title={info}
              >
                <Info size={13} />
              </span>
            )}
            {subtitle && (
              <span className="text-[11px] text-[#64748B] ml-1.5 hidden sm:inline truncate">
                {subtitle}
              </span>
            )}
          </div>
          {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
        </div>
      )}
      <div className="p-4">{children}</div>
    </BaseCard>
  );
}

export function ChartCard({
  title,
  subtitle,
  action,
  legend,
  info,
  children,
  className = "",
}) {
  return (
    <SectionCard
      title={title}
      subtitle={subtitle}
      action={action}
      info={info}
      className={className}
    >
      {legend && <div className="mb-3 flex items-center gap-4 text-xs">{legend}</div>}
      <div className="w-full">{children}</div>
    </SectionCard>
  );
}

export function MetricCard({
  label,
  value,
  subvalue,
  trend, // { value: "+2.4%", isPositive: true }
  action,
  className = "",
}) {
  return (
    <BaseCard className={`flex flex-col justify-between ${className}`} padding="p-3.5">
      <div className="flex items-center justify-between text-[11px] text-[#64748B] font-medium uppercase tracking-wider mb-1.5">
        <span>{label}</span>
        {action}
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[20px] font-bold text-[#17233B] tabular-nums tracking-tight">
          {value}
        </span>
        {trend && (
          <span
            className={`text-[11px] font-semibold tabular-nums px-1.5 py-0.5 rounded-[4px] ${
              trend.isPositive
                ? "bg-[#E8F8F3] text-[#16A878]"
                : "bg-[#FEF0F4] text-[#F05283]"
            }`}
          >
            {trend.value}
          </span>
        )}
      </div>
      {subvalue && (
        <div className="text-[11px] text-[#94A3B8] mt-1 tabular-nums truncate">
          {subvalue}
        </div>
      )}
    </BaseCard>
  );
}

export function StatCard({ label, value, note, children, className = "" }) {
  return (
    <BaseCard className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-[11px] font-medium uppercase tracking-wider text-[#64748B]">
        {label}
      </span>
      <div className="text-[20px] font-bold text-[#17233B] tabular-nums">{value}</div>
      {note && <div className="text-[11px] text-[#94A3B8]">{note}</div>}
      {children}
    </BaseCard>
  );
}

export function InformationCard({ title, message, tone = "info", className = "" }) {
  const tones = {
    info: "bg-[#EFF6FF] border-[#BFDBFE] text-[#1E40AF]",
    warning: "bg-[#FEF7EC] border-[#FBDFA9] text-[#B45309]",
    success: "bg-[#E8F8F3] border-[#B5ECD9] text-[#0E7C58]",
    error: "bg-[#FEF0F4] border-[#FCCEDB] text-[#BE185D]",
  }[tone] || "bg-[#EFF6FF] border-[#BFDBFE] text-[#1E40AF]";

  return (
    <div className={`p-3.5 border rounded-[8px] text-xs leading-relaxed ${tones} ${className}`}>
      {title && <div className="font-semibold mb-1">{title}</div>}
      <div>{message}</div>
    </div>
  );
}

export default BaseCard;
