"use client";

import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { X } from "lucide-react";

import { IconRail } from "./icon-rail";
import { TopBar } from "./top-bar";
import { NAV } from "./nav";

const BARE_ROUTES = new Set(["/login"]);

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (BARE_ROUTES.has(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen w-full bg-bg text-text antialiased">
      {/* Desktop Sidebar (hidden on screens smaller than md) */}
      <div className="hidden md:block shrink-0">
        <IconRail />
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="w-72 max-w-[85vw] h-full bg-surface border-r border-border p-4 shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header / Brand */}
            <div className="flex items-center justify-between pb-4 mb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="h-6 w-6 rounded-md bg-accent" />
                <span className="text-sm font-bold font-mono tracking-wide">
                  SWING<span className="text-text-muted">/NSE</span>
                </span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-md text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Nav list */}
            <nav className="flex-1 space-y-1 overflow-y-auto">
              {NAV.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(`${item.href}/`));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                      active
                        ? "bg-surface-2 text-accent border-l-2 border-accent font-semibold"
                        : "text-text-secondary hover:bg-surface-2 hover:text-text"
                    }`}
                  >
                    <Icon size={18} className={active ? "text-accent" : "text-text-secondary"} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {/* Main column — fluid responsive */}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col overflow-x-hidden">
        <TopBar onOpenMobileMenu={() => setMobileMenuOpen(true)} />
        <main className="flex-1 p-3 sm:p-5 md:p-6 w-full max-w-7xl mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

export default AppShell;
