"use client";

/** Compact min/max numeric filter. Empty input = no bound. */
export function RangeField({
  label,
  min,
  max,
  onChange,
  step = 1,
  unit,
}: {
  label: string;
  min: number | null;
  max: number | null;
  onChange: (next: { min: number | null; max: number | null }) => void;
  step?: number;
  unit?: string;
}) {
  const parse = (v: string) => (v.trim() === "" ? null : Number(v));

  return (
    <div>
      <div className="mb-1.5 text-[11px] text-text-secondary">{label}</div>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          inputMode="decimal"
          step={step}
          value={min ?? ""}
          placeholder="min"
          onChange={(e) => onChange({ min: parse(e.target.value), max })}
          className="tnum h-7 w-full rounded-md border border-border bg-surface px-2 text-[12px] focus:border-accent focus:outline-none"
        />
        <span className="text-text-faint">–</span>
        <input
          type="number"
          inputMode="decimal"
          step={step}
          value={max ?? ""}
          placeholder="max"
          onChange={(e) => onChange({ min, max: parse(e.target.value) })}
          className="tnum h-7 w-full rounded-md border border-border bg-surface px-2 text-[12px] focus:border-accent focus:outline-none"
        />
        {unit && <span className="text-[11px] text-text-muted">{unit}</span>}
      </div>
    </div>
  );
}
