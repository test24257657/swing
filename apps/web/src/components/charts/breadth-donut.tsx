export function BreadthDonut({
  advances,
  declines,
  unchanged,
  size = 132,
}: {
  advances: number;
  declines: number;
  unchanged: number;
  size?: number;
}) {
  const total = advances + declines + unchanged || 1;
  const r = size / 2 - 14;
  const c = 2 * Math.PI * r;
  const seg = (n: number) => (n / total) * c;

  const arcs = [
    { v: advances, color: "var(--color-up)" },
    { v: declines, color: "var(--color-down)" },
    { v: unchanged, color: "var(--color-text-faint)" },
  ];
  let offset = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-surface-2)" strokeWidth={14} />
      {arcs.map((a, i) => {
        const dash = seg(a.v);
        const el = (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={a.color}
            strokeWidth={14}
            strokeDasharray={`${dash} ${c - dash}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        );
        offset += dash;
        return el;
      })}
      <text x={size / 2} y={size / 2 - 2} textAnchor="middle" className="fill-[var(--color-text)] text-[20px] font-semibold">
        {advances.toLocaleString("en-IN")}
      </text>
      <text x={size / 2} y={size / 2 + 16} textAnchor="middle" className="fill-[var(--color-text-muted)] text-[11px]">
        advancing
      </text>
    </svg>
  );
}
