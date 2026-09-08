import { type ReactNode } from "react";

import { IconRail } from "./icon-rail";
import { TopBar } from "./top-bar";

/** Global shell: fixed 1440px canvas, icon rail + sticky top bar, screen content below. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-bg" style={{ minWidth: "var(--canvas-w)" }}>
      <IconRail />
      <div className="min-w-0 flex-1">
        <TopBar />
        <main>{children}</main>
      </div>
    </div>
  );
}
