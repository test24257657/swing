"use client";

import React from "react";

export function SegmentedControl({
  options = [],
  value,
  onChange,
  size = "sm",
  className = "",
}) {
  const sizeClasses = {
    xs: "h-6 text-[10px] px-2",
    sm: "h-7 text-[11px] px-2.5",
    md: "h-8 text-xs px-3",
  }[size] || "h-7 text-[11px] px-2.5";

  return (
    <div
      className={`inline-flex items-center p-0.5 bg-[#F1F5F9] border border-[#E5EAF2] rounded-[6px] select-none ${className}`}
    >
      {options.map((opt) => {
        const id = opt.id ?? opt;
        const label = opt.label ?? opt;
        const isSelected = value === id;
        return (
          <button
            key={id}
            type="button"
            onClick={(e) => {
              e.preventDefault();
              if (onChange) onChange(id);
            }}
            className={`font-medium rounded-[4px] transition-all flex items-center justify-center cursor-pointer ${sizeClasses} ${
              isSelected
                ? "bg-white text-[#3478F6] font-semibold shadow-xs"
                : "text-[#64748B] hover:text-[#17233B]"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedControl;
