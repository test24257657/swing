import { istStamp } from "@/lib/format";
import type { Meta } from "@/lib/api/types";
import { cn } from "@/lib/cn";

/** The monospace provenance line under every data panel. Turns amber when stale. */
export function DataSourceFooter({ meta, className }: { meta: Meta; className?: string }) {
  return (
    <div
      className={cn(
        "font-mono text-[11px]",
        meta.stale ? "text-stale-text" : "text-[var(--color-text-faint)]",
        className,
      )}
    >
      {meta.stale ? "stale · " : "source: "}
      {meta.source}
      {meta.as_of ? ` · ${istStamp(meta.as_of)}` : ""}
    </div>
  );
}
