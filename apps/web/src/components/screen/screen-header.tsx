import { type ReactNode } from "react";

export function ScreenHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[18px] font-semibold tracking-tight sm:text-[20px]">{title}</h1>
        {subtitle && (
          <div className="mt-1 text-[13px] text-[var(--color-text-secondary)]">{subtitle}</div>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Screen({ children }: { children: ReactNode }) {
  return <div className="px-3 pb-14 pt-4 sm:px-6 sm:pt-6">{children}</div>;
}
