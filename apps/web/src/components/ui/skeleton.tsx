import { type HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

/** Shimmer placeholder. Compose these to match the shape of the panel that is loading —
 * the design uses skeletons, never spinners. */
export function Skeleton({ className, style, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded bg-surface-2", className)}
      style={{ animation: "shimmer 1.4s ease-in-out infinite", ...style }}
      {...props}
    />
  );
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-[11px]"
          style={{
            width: `${90 - i * 12}%`,
            animationDelay: `${i * 0.1}s`,
          }}
        />
      ))}
    </div>
  );
}
