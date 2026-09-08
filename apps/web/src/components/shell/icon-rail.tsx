"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";

import { NAV } from "./nav";

/**
 * 64px icon rail, fixed to the viewport so it never scrolls. On hover it expands to
 * 220px and reveals labels, overlaying the content (matches the design). AppShell
 * reserves 64px of left padding so the collapsed rail never covers anything.
 */
export function IconRail() {
  const pathname = usePathname();

  return (
    <nav
      className="group fixed left-0 top-0 z-40 flex h-screen flex-col gap-1 overflow-x-hidden overflow-y-auto border-r border-[var(--color-border)] bg-bg py-4 transition-[width] duration-200 hover:w-[var(--shell-rail-w-expanded)] hover:shadow-[8px_0_24px_rgba(9,9,11,0.06)]"
      style={{ width: "var(--shell-rail-w)" }}
    >
      <div className="flex items-center gap-4 whitespace-nowrap px-5 pb-5">
        <div className="h-6 w-6 flex-none rounded-md bg-accent" />
        <div className="text-[13px] font-semibold tracking-wide">
          SWING<span className="text-[var(--color-text-muted)]">/NSE</span>
        </div>
      </div>

      {NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex h-11 items-center gap-4 whitespace-nowrap border-l-2 px-5 transition-colors hover:bg-surface",
              active
                ? "border-l-[var(--color-accent)] bg-surface-2 text-text"
                : "border-l-transparent text-[var(--color-text-secondary)]",
            )}
          >
            <Icon size={16} strokeWidth={active ? 2.25 : 1.75} className="flex-none" />
            <span className="text-[13px] font-medium">{item.label}</span>
          </Link>
        );
      })}

      <div className="mt-auto whitespace-nowrap px-5 pt-3 font-mono text-[11px] text-[var(--color-text-faint)]">
        hover → labels
      </div>
    </nav>
  );
}
