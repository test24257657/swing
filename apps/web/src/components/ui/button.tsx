import { type ButtonHTMLAttributes, forwardRef } from "react";

import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-hover",
  secondary:
    "border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-text hover:border-[var(--color-border-strong)] bg-surface",
  ghost: "text-[var(--color-text-secondary)] hover:bg-surface-2",
};
const sizes: Record<Size, string> = {
  sm: "h-7 px-2.5 text-[11px]",
  md: "h-9 px-3.5 text-[13px]",
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ variant = "primary", size = "md", className, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
