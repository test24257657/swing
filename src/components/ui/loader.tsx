"use client";

import React from "react";

interface LoaderProps {
  message?: string;
  subtext?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function Loader({
  message = "Loading Swing Terminal...",
  subtext = "Fetching real-time market data & intelligence",
  size = "md",
  className = "",
}: LoaderProps) {
  if (size === "sm") {
    return (
      <div className={`flex items-center justify-center gap-2.5 py-4 ${className}`}>
        <div className="relative w-5 h-5">
          <div className="w-5 h-5 rounded-full border-2 border-accent/20 border-t-accent animate-spin" />
        </div>
        {message && (
          <span className="text-xs font-mono font-medium text-text-secondary">
            {message}
          </span>
        )}
      </div>
    );
  }

  const spinnerSize = size === "lg" ? "w-12 h-12 border-3" : "w-9 h-9 border-2.5";

  return (
    <div
      className={`flex flex-col items-center justify-center py-16 px-4 text-center min-h-[320px] ${className}`}
    >
      <div className="relative mb-4">
        {/* Glow backdrop */}
        <div className="absolute -inset-1 rounded-full bg-accent/15 blur-sm animate-pulse" />
        {/* Outer subtle ring */}
        <div className="relative flex items-center justify-center">
          <div
            className={`${spinnerSize} rounded-full border-border border-t-accent border-r-accent/60 animate-spin`}
            style={{ animationDuration: "0.85s" }}
          />
          {/* Inner pulsating core */}
          <div className="absolute w-2 h-2 rounded-full bg-accent animate-ping opacity-75" />
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-sm font-mono font-bold text-text tracking-wide">
          {message}
        </p>
        {subtext && (
          <p className="text-xs font-mono text-text-muted max-w-sm">
            {subtext}
          </p>
        )}
      </div>
    </div>
  );
}

export default Loader;

