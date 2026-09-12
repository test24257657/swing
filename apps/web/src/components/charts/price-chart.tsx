"use client";

import {
  type CandlestickData,
  ColorType,
  CrosshairMode,
  type HistogramData,
  type IChartApi,
  type LineData,
  LineStyle,
  type SeriesMarker,
  type Time,
  createChart,
} from "lightweight-charts";
import { useEffect, useMemo, useRef, useState } from "react";

import type { ChartArtifact, ChartBar, PatternMatch } from "@/lib/api/market-types";
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
const PIVOT = "#7c3aed";
const DELIVERY = "#52525b";

interface HoverBar {
  bar: ChartBar;
  ma: Partial<Record<"sma_20" | "sma_50" | "sma_200", number>>;
}

function fmt(n: number | null | undefined, dp = 2) {
  return n == null ? "—" : n.toLocaleString("en-IN", { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

function fmtVol(n: number) {
  if (n >= 1e7) return `${(n / 1e7).toFixed(2)}cr`;
  if (n >= 1e5) return `${(n / 1e5).toFixed(2)}L`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}

/**
 * TradingView Lightweight Charts — candles + a volume pane + 20/50/200-day moving
 * averages. Native magnet crosshair, mouse-wheel zoom, drag to pan. Resizes with its
 * container. `showVolume` off for indices (no traded volume). A legend line above the
 * chart tracks the crosshair (OHLC/volume/MA/delivery), defaulting to the latest bar.
 */
export function PriceChart({
  data,
  height = 460,
  showVolume = true,
  showSr = true,
  showDelivery = false,
  pattern = null,
}: {
  data: ChartArtifact;
  height?: number;
  showVolume?: boolean;
  showSr?: boolean;
  /** Dashed delivery-% line on its own scale. Stocks only — no delivery data for indices. */
  showDelivery?: boolean;
  /** The instrument's top-confidence setup-pattern match, if any (daily timeframe only —
   * base_start_date/breakout_date are daily sessions and won't land on W/M bars). */
  pattern?: PatternMatch | null;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<HoverBar | null>(null);

  const lastMa = useMemo(
    (): HoverBar["ma"] => ({
      sma_20: data.ma.sma_20?.at(-1)?.value,
      sma_50: data.ma.sma_50?.at(-1)?.value,
      sma_200: data.ma.sma_200?.at(-1)?.value,
    }),
    [data.ma],
  );
  const shown: HoverBar | null = hover ?? (data.bars.length ? { bar: data.bars.at(-1)!, ma: lastMa } : null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    setHover(null);

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

    if (pattern) {
      const barTimes = new Set(data.bars.map((b) => b.time));
      const lines: [number | null, string, string][] = [
        [pattern.pivot_price, PIVOT, "Pivot"],
        [pattern.stop_suggestion, DOWN, "Stop"],
        [pattern.target_suggestion, UP, "Target"],
      ];
      for (const [priceVal, color, title] of lines) {
        if (priceVal == null) continue;
        candles.createPriceLine({
          price: priceVal,
          color,
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title,
        });
      }

      const markers: SeriesMarker<Time>[] = [];
      if (pattern.base_start_date && barTimes.has(pattern.base_start_date)) {
        markers.push({
          time: pattern.base_start_date as Time,
          position: "belowBar",
          color: PIVOT,
          shape: "circle",
          text: "Base",
        });
      }
      if (pattern.breakout_date && barTimes.has(pattern.breakout_date)) {
        markers.push({
          time: pattern.breakout_date as Time,
          position: "aboveBar",
          color: UP,
          shape: "arrowUp",
          text: "Breakout",
        });
      }
      if (markers.length) candles.setMarkers(markers.sort((a, b) => (a.time as string).localeCompare(b.time as string)));
    }

    if (showDelivery) {
      const pts = data.bars.filter((b) => b.delivery_pct != null);
      if (pts.length) {
        const deliv = chart.addLineSeries({
          color: DELIVERY,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          priceScaleId: "delivery",
          priceLineVisible: false,
          lastValueVisible: true,
          crosshairMarkerVisible: false,
          title: "Deliv %",
        });
        chart.priceScale("delivery").applyOptions({ scaleMargins: { top: 0.05, bottom: 0.35 }, visible: false });
        deliv.setData(pts.map((b): LineData => ({ time: b.time as Time, value: b.delivery_pct as number })));
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

    // Legend line above the chart tracks whatever bar the crosshair is over.
    const barsByTime = new Map(data.bars.map((b) => [b.time, b]));
    const maByTime = {
      sma_20: new Map((data.ma.sma_20 ?? []).map((p) => [p.time, p.value])),
      sma_50: new Map((data.ma.sma_50 ?? []).map((p) => [p.time, p.value])),
      sma_200: new Map((data.ma.sma_200 ?? []).map((p) => [p.time, p.value])),
    };
    chart.subscribeCrosshairMove((param) => {
      const t = param.time as string | undefined;
      const bar = t ? barsByTime.get(t) : undefined;
      if (!bar) {
        setHover(null);
        return;
      }
      setHover({
        bar,
        ma: {
          sma_20: maByTime.sma_20.get(t as string),
          sma_50: maByTime.sma_50.get(t as string),
          sma_200: maByTime.sma_200.get(t as string),
        },
      });
    });

    const ro = new ResizeObserver(() => chart.applyOptions({ width: el.clientWidth }));
    ro.observe(el);
    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, [data, height, showVolume, showSr, showDelivery, pattern]);

  return (
    <div className="w-full">
      <ChartLegend shown={shown} showVolume={showVolume} showDelivery={showDelivery} />
      <div ref={wrapRef} style={{ height }} className="w-full" />
    </div>
  );
}

function ChartLegend({
  shown,
  showVolume,
  showDelivery,
}: {
  shown: HoverBar | null;
  showVolume: boolean;
  showDelivery: boolean;
}) {
  if (!shown) return <div className="mb-1 h-4" />;
  const { bar, ma } = shown;
  const up = bar.close != null && bar.open != null ? bar.close >= bar.open : true;
  const priceColor = up ? "text-up-text" : "text-down-text";

  return (
    <div className="tnum mb-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-text-secondary">
      <span className="text-text-faint">{bar.time}</span>
      <span>
        O <span className={priceColor}>{fmt(bar.open)}</span>
      </span>
      <span>
        H <span className={priceColor}>{fmt(bar.high)}</span>
      </span>
      <span>
        L <span className={priceColor}>{fmt(bar.low)}</span>
      </span>
      <span>
        C <span className={priceColor}>{fmt(bar.close)}</span>
      </span>
      {showVolume && <span>Vol {fmtVol(bar.volume)}</span>}
      {showDelivery && bar.delivery_pct != null && <span>Deliv {bar.delivery_pct.toFixed(1)}%</span>}
      {ma.sma_20 != null && <span style={{ color: MA_COLOR.sma_20 }}>20D {fmt(ma.sma_20)}</span>}
      {ma.sma_50 != null && <span style={{ color: MA_COLOR.sma_50 }}>50D {fmt(ma.sma_50)}</span>}
      {ma.sma_200 != null && <span style={{ color: MA_COLOR.sma_200 }}>200D {fmt(ma.sma_200)}</span>}
    </div>
  );
}
