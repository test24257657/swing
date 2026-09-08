"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";

import { NAV } from "./nav";

/**
 * Left rail. Fixed to the viewport so it never scrolls. Collapsed it is a clean 64px
 * column of centred icons; on hover it expands to 220px and the labels fade in (they are
 * never clipped — text is hidden, not overflowed, while collapsed). Matches the design.
 */
export function IconRail() {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        "group fixed left-0 top-0 z-40 flex h-screen w-(--shell-rail-w) flex-col",
        "border-r border-border bg-bg py-3",
        "transition-[width] duration-200 ease-out hover:w-(--shell-rail-w-expanded)",
        "hover:shadow-[8px_0_24px_rgba(9,9,11,0.06)]",
      )}
    >
      {/* Brand */}
      <div className="flex h-12 items-center gap-3 px-[22px]">
        <div className="h-6 w-6 flex-none rounded-md bg-accent" />
        <span className="overflow-hidden whitespace-nowrap text-[13px] font-semibold tracking-wide opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          SWING<span className="text-text-muted">/NSE</span>
        </span>
      </div>

      {/* Nav */}
      <div className="mt-2 flex flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={cn(
                "flex h-11 flex-none items-center gap-3 border-l-2 px-[22px] transition-colors hover:bg-surface",
                active
                  ? "border-l-accent bg-surface-2 text-text"
                  : "border-l-transparent text-text-secondary",
              )}
            >
              <Icon size={18} strokeWidth={active ? 2.25 : 1.75} className="flex-none" aria-hidden />
              <span className="overflow-hidden whitespace-nowrap text-[13px] font-medium opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Footer hint */}
      <div className="h-8 overflow-hidden whitespace-nowrap px-[22px] pt-2 font-mono text-[11px] text-text-faint opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        hover → labels
      </div>
    </nav>
  );
}
