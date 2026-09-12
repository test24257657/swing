"use client";

import { usePathname } from "next/navigation";
import { type ReactNode } from "react";

import { AuthGuard } from "./auth-guard";
import { IconRail } from "./icon-rail";
import { TopBar } from "./top-bar";

const BARE_ROUTES = new Set(["/login"]);

/**
 * Global shell. Sticky non-animating left rail (a hamburger drawer below the `md`
 * breakpoint, via the vendored Aceternity sidebar) + a content column with a sticky top
 * bar. Fluid — no forced desktop-width canvas, so it works down to phone widths.
 * `/login` renders bare (no rail, no top bar).
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (BARE_ROUTES.has(pathname)) {
    return <AuthGuard>{children}</AuthGuard>;
  }

  return (
    <AuthGuard>
      <div className="flex min-h-screen flex-col bg-bg md:flex-row">
        <IconRail />
        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <TopBar />
          <main className="flex-1">{children}</main>
        </div>
      </div>
    </AuthGuard>
  );
}
