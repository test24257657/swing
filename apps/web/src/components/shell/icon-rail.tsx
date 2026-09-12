"use client";

import { usePathname } from "next/navigation";

import { Sidebar, SidebarBody, SidebarLink } from "@/components/aceternity/sidebar";
import { cn } from "@/lib/cn";

import { NAV } from "./nav";

/**
 * Left navigation, built on the Aceternity UI Sidebar with `animate={false}` — the rail
 * stays a fixed 240px with labels always visible, no expand/collapse animation. Sticky to
 * the viewport so it never scrolls with the page.
 */
export function IconRail() {
  const pathname = usePathname();

  return (
    <Sidebar animate={false}>
      <div className="top-0 z-40 shrink-0 md:sticky md:h-screen">
        <SidebarBody className="h-full gap-1 border-r border-border bg-bg! px-0! py-3!">
          <div className="mb-2 flex items-center gap-3 px-5">
            <div className="h-6 w-6 flex-none rounded-md bg-accent" />
            <span className="text-[13px] font-semibold tracking-wide">
              SWING<span className="text-text-muted">/NSE</span>
            </span>
          </div>

          <div className="flex flex-1 flex-col gap-0.5">
            {NAV.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <SidebarLink
                  key={item.href}
                  link={{
                    href: item.href,
                    label: item.label,
                    icon: (
                      <Icon
                        size={18}
                        strokeWidth={active ? 2.25 : 1.75}
                        className="flex-none"
                        aria-hidden
                      />
                    ),
                  }}
                  className={cn(
                    "h-11 border-l-2 px-[18px] py-0! transition-colors hover:bg-surface",
                    active
                      ? "border-l-accent bg-surface-2 text-text [&_span]:font-medium [&_span]:text-text!"
                      : "border-l-transparent text-text-secondary",
                  )}
                />
              );
            })}
          </div>
        </SidebarBody>
      </div>
    </Sidebar>
  );
}
