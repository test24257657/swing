/** Multi-series line chart for index detail (single series) and compare mode. */
export function LineChart({
  series,
  height = 260,
  showZero100 = false,
}: {
  series: { name: string; color: string; values: number[] }[];
  height?: number;
  showZero100?: boolean;
}) {
  const W = 640;
  const pad = 8;
  const all = series.flatMap((s) => s.values);
  if (all.length < 2) return <svg width="100%" height={height} />;
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || 1;
  const n = Math.max(...series.map((s) => s.values.length));

  const path = (vals: number[]) =>
    vals
      .map((v, i) => {
        const x = pad + (i / (n - 1)) * (W - 2 * pad);
        const y = height - pad - ((v - min) / span) * (height - 2 * pad);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");

  const y100 = height - pad - ((100 - min) / span) * (height - 2 * pad);

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none">
      {showZero100 && min < 100 && max > 100 && (
        <line x1={0} y1={y100} x2={W} y2={y100} stroke="var(--color-border-strong)" strokeDasharray="3 3" />
      )}
      {series.map((s) => (
        <path key={s.name} d={path(s.values)} fill="none" stroke={s.color} strokeWidth={1.5} />
      ))}
    </svg>
  );
}
