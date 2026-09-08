import { type ReactNode } from "react";

import { IconRail } from "./icon-rail";
import { TopBar } from "./top-bar";

/**
 * Global shell. The icon rail is fixed to the viewport (never scrolls); the content
 * column is offset by the rail's collapsed width so nothing sits under it. Fixed 1440px
 * canvas per the design.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-bg" style={{ minWidth: "var(--canvas-w)" }}>
      <IconRail />
      <div
        className="flex min-h-screen flex-col"
        style={{ marginLeft: "var(--shell-rail-w)" }}
      >
        <TopBar />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
