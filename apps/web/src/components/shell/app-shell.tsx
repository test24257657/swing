import { type ReactNode } from "react";

import { IconRail } from "./icon-rail";
import { TopBar } from "./top-bar";

/**
 * Global shell. Sticky non-animating left rail + a content column with a sticky top bar.
 * Fixed 1440px canvas per the design.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-bg" style={{ minWidth: "var(--canvas-w)" }}>
      <IconRail />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
