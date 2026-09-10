"use client";

import {
  type CandlestickData,
  ColorType,
  CrosshairMode,
  type HistogramData,
  type IChartApi,
  type LineData,
  LineStyle,
  type Time,
  createChart,
} from "lightweight-charts";
import { useEffect, useRef } from "react";

import type { ChartArtifact } from "@/lib/api/market-types";
import { supportResistance } from "@/lib/support-resistance";

const UP = "#16a34a";
const DOWN = "#dc2626";
const GRID = "rgba(9,9,11,0.06)";
const AXIS = "#8b8b93";
const MA_COLOR: Record<string, string> = {
  sma_20: "#2563eb",
  sma_50: "#d97706",
  sma_200: "#7c3aed",
};
// Deliberately distinct from the candle up/down colors so S/R levels don't blend
// into the wicks — dark amber for resistance (a ceiling), dark blue for support (a floor).
const RESISTANCE = "#9a3412";
const SUPPORT = "#1e3a8a";

/**
 * TradingView Lightweight Charts — candles + a volume pane + 20/50/200-day moving
 * averages. Native magnet crosshair, mouse-wheel zoom, drag to pan. Resizes with its
 * container. `showVolume` off for indices (no traded volume).
 */
export function PriceChart({
  data,
  height = 460,
  showVolume = true,
  showSr = true,
}: {
  data: ChartArtifact;
  height?: number;
  showVolume?: boolean;
  showSr?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const chart: IChartApi = createChart(el, {
      width: el.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: AXIS,
        fontSize: 11,
        fontFamily: "var(--font-jetbrains), monospace",
      },
      grid: { vertLines: { color: GRID }, horzLines: { color: GRID } },
      crosshair: { mode: CrosshairMode.Magnet },
      rightPriceScale: { borderColor: GRID },
      timeScale: { borderColor: GRID, rightOffset: 4, minBarSpacing: 2 },
    });

    const candles = chart.addCandlestickSeries({
      upColor: UP,
      downColor: DOWN,
      wickUpColor: UP,
      wickDownColor: DOWN,
      borderVisible: false,
    });
    candles.setData(
      data.bars
        .filter((b) => b.open != null && b.close != null)
        .map(
          (b): CandlestickData => ({
            time: b.time as Time,
            open: b.open as number,
            high: b.high as number,
            low: b.low as number,
            close: b.close as number,
          }),
        ),
    );

    if (showVolume) {
      const vol = chart.addHistogramSeries({
        priceFormat: { type: "volume" },
        priceScaleId: "vol",
      });
      chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      vol.setData(
        data.bars.map(
          (b): HistogramData => ({
            time: b.time as Time,
            value: b.volume,
            color: (b.close ?? 0) >= (b.open ?? 0) ? "rgba(22,163,74,0.35)" : "rgba(220,38,38,0.35)",
          }),
        ),
      );
    }

    if (showSr) {
      for (const level of supportResistance(data.bars)) {
        candles.createPriceLine({
          price: level.price,
          color: level.type === "resistance" ? RESISTANCE : SUPPORT,
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: `${level.type === "resistance" ? "R" : "S"} · ${level.touches}×`,
        });
      }
    }

    for (const key of ["sma_200", "sma_50", "sma_20"] as const) {
      const pts = data.ma[key];
      if (!pts?.length) continue;
      const line = chart.addLineSeries({
        color: MA_COLOR[key],
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      line.setData(pts.map((p): LineData => ({ time: p.time as Time, value: p.value })));
    }

    chart.timeScale().fitContent();

    const ro = new ResizeObserver(() => chart.applyOptions({ width: el.clientWidth }));
    ro.observe(el);
    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, [data, height, showVolume, showSr]);

  return <div ref={wrapRef} style={{ height }} className="w-full" />;
}
