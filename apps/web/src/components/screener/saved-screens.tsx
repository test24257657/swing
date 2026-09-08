"use client";

import { useDeleteScreen, useSavedScreens } from "@/lib/api/hooks";

export function SavedScreens({ onApply }: { onApply: (filters: Record<string, unknown>) => void }) {
  const { data } = useSavedScreens();
  const del = useDeleteScreen();
  const screens = data?.screens ?? [];

  return (
    <div className="flex flex-col gap-1">
      <div className="font-mono text-[11px] text-text-faint">
        saved screens: {screens.length} · ⌘S
      </div>
      {screens.map((s) => (
        <div key={s.id} className="flex items-center gap-2 text-[12px]">
          <button
            onClick={() => onApply(s.filters)}
            className="min-w-0 flex-1 truncate text-left text-text-secondary hover:text-accent"
          >
            {s.name}
          </button>
          <button
            onClick={() => del.mutate(s.id)}
            className="shrink-0 text-[11px] text-text-faint hover:text-down-text"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
