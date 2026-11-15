"use client";

import React from "react";
import { ChevronDown, Search } from "lucide-react";

export function Select({
  options = [],
  value,
  onChange,
  className = "",
  size = "sm",
  ...props
}) {
  const sizeStyles = {
    sm: "h-7 text-xs pl-2.5 pr-7",
    md: "h-8 text-xs pl-3 pr-8",
  }[size] || "h-8 text-xs pl-3 pr-8";

  return (
    <div className={`relative inline-block ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange && onChange(e.target.value)}
        className={`appearance-none bg-white border border-[#E5EAF2] rounded-[6px] text-[#17233B] font-medium hover:border-[#CBD5E1] focus:outline-none focus:border-[#3478F6] focus:ring-1 focus:ring-[#3478F6] transition-all cursor-pointer ${sizeStyles}`}
        {...props}
      >
        {options.map((opt) => {
          const val = opt.id ?? opt.value ?? opt;
          const label = opt.label ?? opt.name ?? opt;
          return (
            <option key={val} value={val}>
              {label}
            </option>
          );
        })}
      </select>
      <ChevronDown
        size={14}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none"
      />
    </div>
  );
}

export function Input({
  value,
  onChange,
  placeholder,
  className = "",
  icon: Icon,
  ...props
}) {
  return (
    <div className={`relative flex items-center ${className}`}>
      {Icon && (
        <Icon size={14} className="absolute left-2.5 text-[#94A3B8] pointer-events-none" />
      )}
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full h-8 bg-white border border-[#E5EAF2] rounded-[6px] text-xs text-[#17233B] placeholder-[#94A3B8] hover:border-[#CBD5E1] focus:outline-none focus:border-[#3478F6] focus:ring-1 focus:ring-[#3478F6] transition-all ${
          Icon ? "pl-8 pr-3" : "px-3"
        }`}
        {...props}
      />
    </div>
  );
}

export function SearchInput(props) {
  return <Input icon={Search} placeholder="Search..." {...props} />;
}

