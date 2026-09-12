"use client";

import { useQueries } from "@tanstack/react-query";
import { ColorType, type IChartApi, type LineData, type Time, createChart } from "lightweight-charts";
import { useEffect, useRef } from "react";

import { apiGet } from "@/lib/api/client";
import type { ChartArtifact } from "@/lib/api/market-types";
import type { Envelope } from "@/lib/api/types";

const GRID = "rgba(9,9,11,0.06)";
const AXIS = "#8b8b93";
const COLORS = [
  "#7c3aed", "#2563eb", "#16a34a", "#d97706", "#dc2626", "#0ea5e9", "#db2777", "#65a30d",
];

/** Overlays several indices on one chart, each rebased to 100 at the start of the
 * common window — so "which one's up more" is a visual comparison, not a mental
 * percentage calculation. */
export function IndexCompareChart({ slugs, height = 380 }: { slugs: string[]; height?: number }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const results = useQueries({
    queries: slugs.map((slug) => ({
      queryKey: ["chart", slug],
      queryFn: () => apiGet<Envelope<ChartArtifact>>(`/chart/${slug}`),
      staleTime: 5 * 60_000,
    })),
  });

  const loaded = results.every((r) => r.isSuccess);
  const artifacts = results.map((r) => r.data?.data).filter((d): d is ChartArtifact => Boolean(d));

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || !loaded || artifacts.length === 0) return;

    const chart: IChartApi = createChart(el, {
      width: el.clientWidth,
      height,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: AXIS, fontSize: 11 },
      grid: { vertLines: { color: GRID }, horzLines: { color: GRID } },
      rightPriceScale: { borderColor: GRID },
      timeScale: { borderColor: GRID, rightOffset: 4 },
    });

    // Common date range across all selected indices, so the rebase-to-100 start point
    // is the same session for every line.
    const commonTimes = artifacts
      .map((a) => new Set(a.bars.map((b) => b.time)))
      .reduce((acc, s) => new Set([...acc].filter((t) => s.has(t))));
    const sortedCommon = [...commonTimes].sort();
    const startTime = sortedCommon[0];

    for (const [i, artifact] of artifacts.entries()) {
      const bars = artifact.bars.filter((b) => b.time >= startTime && b.close != null);
      const base = bars[0]?.close;
      if (!base) continue;
      const line = chart.addLineSeries({
        color: COLORS[i % COLORS.length],
        lineWidth: 2,
        priceLineVisible: false,
        title: artifact.symbol,
      });
      line.setData(bars.map((b): LineData => ({ time: b.time as Time, value: ((b.close as number) / base) * 100 })));
    }

    chart.timeScale().fitContent();
    const ro = new ResizeObserver(() => chart.applyOptions({ width: el.clientWidth }));
    ro.observe(el);
    return () => {
      ro.disconnect();
      chart.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `artifacts` is derived from `results` each render; keying on `loaded` + slugs avoids re-diffing array identity every render
  }, [loaded, slugs.join(","), height]);

  if (!loaded) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-[13px] text-text-muted">
        Loading…
      </div>
    );
  }
  if (artifacts.length === 0) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-[13px] text-text-muted">
        Select indices to compare.
      </div>
    );
  }
  return <div ref={wrapRef} style={{ height }} className="w-full" />;
}
