"use client";

import {
  type CandlestickData,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  LineStyle,
  type Time,
  createChart,
} from "lightweight-charts";
import { useEffect, useMemo, useRef, useState } from "react";

import type { SymbolChart } from "@/lib/api/market-types";

import { PatternOverlay } from "./pattern-overlay";

const UP = "#16a34a";
const DOWN = "#dc2626";
const GRID = "rgba(9,9,11,0.06)";
const TEXT = "#8b8b93";

const MA_STYLE: Record<string, string> = {
  sma_20: "#2563eb",
  sma_50: "#d97706",
  sma_200: "#7c3aed",
};

interface Props {
  data: SymbolChart;
  height?: number;
  compact?: boolean;
  showVolume?: boolean;
  showOverlay?: boolean;
}

/**
 * TradingView Lightweight Charts wrapper. Candles + volume pane + 20/50/200 DMA,
 * support/resistance and pattern pivot/stop/target as price lines, native crosshair,
 * mouse-wheel zoom and drag-pan. An SVG layer draws the pattern annotation shapes
 * (VCP contraction zones, breakout box) synced to the chart's coordinate system.
 */
export function PriceChart({
  data,
  height = 440,
  compact = false,
  showVolume = true,
  showOverlay = true,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [tick, setTick] = useState(0); // bumps to make the overlay recompute

  const candles = useMemo<CandlestickData[]>(
    () =>
      data.bars.map((b) => ({
        time: b.time as Time,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
      })),
    [data.bars],
  );

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const chart = createChart(el, {
      width: el.clientWidth,
      height,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: TEXT, fontSize: 10 },
      grid: { vertLines: { color: GRID }, horzLines: { color: GRID } },
      crosshair: { mode: CrosshairMode.Magnet },
      rightPriceScale: { borderColor: GRID, visible: !compact },
      timeScale: { borderColor: GRID, timeVisible: false, rightOffset: 3, visible: !compact },
      handleScroll: true,
      handleScale: true,
    });
    chartRef.current = chart;

    const candle = chart.addCandlestickSeries({
      upColor: UP,
      downColor: DOWN,
      wickUpColor: UP,
      wickDownColor: DOWN,
      borderVisible: false,
      priceLineVisible: false,
      lastValueVisible: !compact,
    });
    candle.setData(candles);
    candleRef.current = candle;

    if (showVolume && !compact) {
      const vol = chart.addHistogramSeries({
        priceFormat: { type: "volume" },
        priceScaleId: "vol",
        color: "rgba(139,139,147,0.4)",
      });
      chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      vol.setData(
        data.bars.map((b) => ({
          time: b.time as Time,
          value: b.volume,
          color: b.close >= b.open ? "rgba(22,163,74,0.35)" : "rgba(220,38,38,0.35)",
        })),
      );
    }

    for (const key of ["sma_200", "sma_50", "sma_20"] as const) {
      const pts = data.mas[key];
      if (!pts?.length) continue;
      const line = chart.addLineSeries({
        color: MA_STYLE[key],
        lineWidth: compact ? 1 : 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      line.setData(pts.map((p) => ({ time: p.time as Time, value: p.value })));
    }

    // S/R + pattern levels as price lines
    for (const s of data.sr) {
      candle.createPriceLine({
        price: s.price,
        color: s.kind === "support" ? "rgba(22,163,74,0.7)" : "rgba(220,38,38,0.7)",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: !compact,
        title: compact ? "" : `${s.kind === "support" ? "S" : "R"} ${s.price}`,
      });
    }
    for (const p of data.patterns) {
      const lines: [number | null, string, string][] = [
        [p.pivot, "#7c3aed", "PIVOT"],
        [p.stop, "#dc2626", "STOP"],
        [p.target, "#16a34a", "TGT"],
      ];
      for (const [price, color, label] of lines) {
        if (price == null) continue;
        candle.createPriceLine({
          price,
          color,
          lineWidth: label === "PIVOT" ? 2 : 1,
          lineStyle: label === "PIVOT" ? LineStyle.Solid : LineStyle.Dotted,
          axisLabelVisible: !compact,
          title: compact ? "" : `${label} ${price}`,
        });
      }
    }

    chart.timeScale().fitContent();

    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: el.clientWidth, height });
      setTick((t) => t + 1);
    });
    ro.observe(el);
    const onRange = () => setTick((t) => t + 1);
    chart.timeScale().subscribeVisibleLogicalRangeChange(onRange);

    return () => {
      ro.disconnect();
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRange);
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, height, compact, showVolume]);

  return (
    <div className="relative" style={{ height }}>
      <div ref={wrapRef} className="h-full w-full" />
      {showOverlay && data.patterns.length > 0 && (
        <PatternOverlay
          chart={chartRef.current}
          series={candleRef.current}
          patterns={data.patterns}
          tick={tick}
        />
      )}
    </div>
  );
}
