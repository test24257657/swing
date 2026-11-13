"use client";

import { usePathname } from "next/navigation";

import { Sidebar, SidebarBody, SidebarLink } from "@/components/aceternity/sidebar";
import { NAV } from "./nav";

function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * Left navigation rail — fixed 240px wide, labels always visible (animate={false}).
 * Active item shows a left accent border + surface-2 highlight, violet icon.
 */
export function IconRail() {
  const pathname = usePathname();

  return (
    <Sidebar animate={false}>
      <div className="sticky top-0 h-screen shrink-0">
        <SidebarBody
          className="h-full gap-1 border-r !px-0 !py-3"
          style={{
            borderColor: "var(--color-border)",
            backgroundColor: "var(--color-surface)",
          }}
        >
          {/* Brand */}
          <div className="mb-4 flex items-center gap-3 px-5 pt-1">
            <div
              className="h-7 w-7 flex-none rounded-lg flex items-center justify-center font-bold text-white text-xs shadow-xs"
              style={{ backgroundColor: "var(--color-accent)" }}
            >
              S
            </div>
            <span
              className="text-sm font-bold tracking-wide"
              style={{ color: "var(--color-text)" }}
            >
              SWING
              <span className="text-accent font-bold">/NSE</span>
            </span>
          </div>

          {/* Nav items */}
          <div className="flex flex-1 flex-col gap-1">
            {NAV.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(`${item.href}/`));
              const Icon = item.icon;
              return (
                <SidebarLink
                  key={item.href}
                  link={{
                    href: item.href,
                    label: item.label,
                    icon: (
                      <Icon
                        size={19}
                        strokeWidth={active ? 2.5 : 2}
                        className="flex-none"
                        style={{
                          color: active
                            ? "var(--color-accent)"
                            : "var(--color-text-secondary)",
                        }}
                        aria-hidden
                      />
                    ),
                  }}
                  className={cn(
                    "h-11 border-l-[3px] px-4 !py-0 transition-all rounded-r-lg mr-2",
                    active
                      ? "border-l-[var(--color-accent)] bg-[var(--color-accent-tint)] text-accent font-bold shadow-2xs"
                      : "border-l-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] font-medium",
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

