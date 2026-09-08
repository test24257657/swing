import { type ReactNode } from "react";

import { cn } from "@/lib/cn";

interface Props {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/** Every screen has explicit empty states, and per the design they route to the next
 * action rather than being a dead end. */
export function EmptyState({ title, description, actions, className }: Props) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-lg border border-[var(--color-border)] bg-surface px-6 py-16 text-center",
        className,
      )}
    >
      <div className="text-[15px] font-semibold">{title}</div>
      {description && (
        <div className="mt-1.5 max-w-md text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
          {description}
        </div>
      )}
      {actions && <div className="mt-4 flex gap-2">{actions}</div>}
    </div>
  );
}
