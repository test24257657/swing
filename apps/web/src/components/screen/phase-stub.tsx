import { type ReactNode } from "react";

import { Card } from "@/components/ui";

/** Placeholder for screens whose implementation lands in a later phase. Names the phase
 * and lists what it will contain, so the nav is walkable from day one. */
export function PhaseStub({
  phase,
  contents,
  children,
}: {
  phase: string;
  contents: string[];
  children?: ReactNode;
}) {
  return (
    <Card className="p-6">
      <div className="font-mono text-[11px] text-accent">▸ {phase}</div>
      <ul className="mt-3 flex flex-col gap-1.5 text-[13px] text-[var(--color-text-secondary)]">
        {contents.map((c) => (
          <li key={c} className="flex gap-2">
            <span className="text-[var(--color-text-faint)]">·</span>
            {c}
          </li>
        ))}
      </ul>
      {children && <div className="mt-4">{children}</div>}
    </Card>
  );
}
