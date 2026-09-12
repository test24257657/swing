import { type HTMLAttributes, forwardRef } from "react";

import { cn } from "@/lib/cn";

export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("min-w-0 rounded-lg border border-[var(--color-border)] bg-surface", className)}
      {...props}
    />
  ),
);
Card.displayName = "Card";

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center justify-between p-4", className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("text-[13px] font-semibold", className)} {...props} />;
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4 pt-0", className)} {...props} />;
}
