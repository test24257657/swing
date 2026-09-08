import { Tooltip } from "@/components/ui";
import { cn } from "@/lib/cn";

/** Composite-score cell: number + verdict + a proportional bar. Colour tracks the band. */
export function ScoreCell({
  score,
  verdict,
  inputsPresent,
  compact = false,
}: {
  score: number | null;
  verdict: string | null;
  inputsPresent?: number | null;
  compact?: boolean;
}) {
  if (score == null) {
    return <span className="text-text-faint">—</span>;
  }
  const tone =
    score >= 80 ? "var(--color-up)" : score >= 60 ? "var(--color-up-text)" : score >= 45 ? "var(--color-stale)" : "var(--color-down)";

  return (
    <div className={cn(compact && "flex items-center gap-2")}>
      <div className="flex items-baseline gap-1.5">
        <span className="tnum text-[15px] font-semibold" style={{ color: tone }}>
          {score.toFixed(0)}
        </span>
        <span className="text-[11px] text-text-muted">{verdict}</span>
        {inputsPresent != null && inputsPresent < 4 && (
          <Tooltip content={`Only ${inputsPresent} of 4 inputs had data (earnings trend needs quarterly fundamentals).`}>
            <span className="text-[10px] text-stale-text">{inputsPresent}/4</span>
          </Tooltip>
        )}
      </div>
      {!compact && (
        <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-inset">
          <div
            className="h-1 rounded-full"
            style={{ width: `${Math.min(100, Math.max(0, score))}%`, background: tone }}
          />
        </div>
      )}
    </div>
  );
}
