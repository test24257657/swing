"use client";

import React from "react";

export function Button({
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  className = "",
  children,
  onClick,
  ...props
}) {
  const baseStyles =
    "inline-flex items-center justify-center font-medium transition-colors select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:opacity-50 disabled:pointer-events-none rounded-[6px]";

  const sizeStyles = {
    sm: "px-2.5 py-1 text-xs gap-1.5 h-7",
    md: "px-3.5 py-1.5 text-xs gap-2 h-8",
    lg: "px-4 py-2 text-sm gap-2 h-9",
    icon: "h-8 w-8 p-0 shrink-0",
    "icon-sm": "h-7 w-7 p-0 shrink-0",
  }[size] || "px-3.5 py-1.5 text-xs gap-2 h-8";

  const variantStyles = {
    primary:
      "bg-[#3478F6] text-white hover:bg-[#2563EB] active:bg-[#1D4ED8] shadow-xs",
    secondary:
      "bg-[#F1F5F9] text-[#17233B] hover:bg-[#E2E8F0] active:bg-[#CBD5E1]",
    outline:
      "border border-[#E5EAF2] bg-white text-[#17233B] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] active:bg-[#F1F5F9]",
    ghost:
      "text-[#64748B] hover:text-[#17233B] hover:bg-[#F1F5F9] active:bg-[#E2E8F0]",
    destructive:
      "bg-[#F05283] text-white hover:bg-[#E11D48] active:bg-[#BE123C]",
    subtle:
      "bg-[#EFF6FF] text-[#3478F6] hover:bg-[#DBEAFE] border border-[#BFDBFE]",
  }[variant] || "bg-[#3478F6] text-white";

  return (
    <button
      disabled={disabled || loading}
      onClick={onClick}
      className={`${baseStyles} ${sizeStyles} ${variantStyles} ${className}`}
      {...props}
    >
      {loading && (
        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
      )}
      {children}
    </button>
  );
}

export function PrimaryButton(props) {
  return <Button variant="primary" {...props} />;
}

export function SecondaryButton(props) {
  return <Button variant="secondary" {...props} />;
}

export function OutlineButton(props) {
  return <Button variant="outline" {...props} />;
}

export function GhostButton(props) {
  return <Button variant="ghost" {...props} />;
}

export function DestructiveButton(props) {
  return <Button variant="destructive" {...props} />;
}

export function IconButton({ icon: Icon, size = "icon", ...props }) {
  return (
    <Button size={size} variant="ghost" {...props}>
      {Icon && <Icon size={16} />}
    </Button>
  );
}

export default Button;

