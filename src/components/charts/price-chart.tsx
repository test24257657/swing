"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  createChart,
  createSeriesMarkers,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type SeriesMarker,
} from "lightweight-charts";
import { ExternalLink, Layers, RefreshCw } from "lucide-react";
import { supportResistance } from "@/lib/support-resistance";
import { type DetectedPattern } from "@/lib/chart-patterns";

export interface BarData {
  time: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number;
  sma20?: number | null;
  sma50?: number | null;
  sma200?: number | null;
}

export type Timeframe = "D" | "W" | "M";

interface PriceChartProps {
  symbol: string;
  exchange?: string;
  height?: number | string;
  timeframe?: Timeframe;
  onTimeframeChange?: (tf: Timeframe) => void;
  pattern?: {
    pivotPrice?: number | null;
    stopLossPrice?: number | null;
    setupType?: string | null;
  } | null;
  activePattern?: DetectedPattern | null;
  onOpenTradingView?: () => void;
}

const UP_COLOR = "#15803d";
const DOWN_COLOR = "#b91c1c";
const GRID_COLOR = "rgba(15, 23, 42, 0.08)";
const TEXT_COLOR = "#334155";
const RESISTANCE_COLOR = "#9a3412"; // Dark amber resistance (ceiling)
const SUPPORT_COLOR = "#1e3a8a";    // Dark blue support (floor)

// Helper: find Monday of the week for weekly candle grouping
function getMonday(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = date.getUTCDay();
  const diff = date.getUTCDate() - day + (day === 0 ? -6 : 1);
  date.setUTCDate(diff);
  return date.toISOString().split("T")[0];
}

// Helper: Calculate Simple Moving Average
function computeSMA(closes: (number | null)[], period: number): (number | null)[] {
  return closes.map((_, i) => {
    if (i < period - 1) return null;
    const win = closes.slice(i - period + 1, i + 1);
    if (win.some((v) => v == null)) return null;
    const sum = win.reduce((acc, v) => acc! + v!, 0);
    return Number((sum! / period).toFixed(2));
  });
}

// Helper: Calculate Exponential Moving Average
function computeEMA(closes: (number | null)[], period: number): (number | null)[] {
  const k = 2 / (period + 1);
  let ema: number | null = null;
  return closes.map((val, i) => {
    if (val == null) return null;
    if (i < period - 1) return null;
    if (i === period - 1) {
      const win = closes.slice(0, period);
      if (win.some((v) => v == null)) return null;
      const sum = win.reduce((acc, v) => acc! + v!, 0);
      ema = sum! / period;
      return Number(ema.toFixed(2));
    }
    if (ema != null) {
      ema = val * k + ema * (1 - k);
      return Number(ema.toFixed(2));
    }
    return null;
  });
}

// Helper: Interpolate line segments between vertices across continuous daily bars
function buildInterpolatedSeriesData(
  vertices: { time: string; price: number }[],
  bars: BarData[]
): { time: Time; value: number }[] {
  if (!vertices || vertices.length < 2) return [];

  const timeToIndex = new Map<string, number>();
  bars.forEach((b, idx) => timeToIndex.set(b.time, idx));

  const result: { time: Time; value: number }[] = [];
  const addedTimes = new Set<string>();

  for (let k = 0; k < vertices.length - 1; k++) {
    const v1 = vertices[k];
    const v2 = vertices[k + 1];
    const idx1 = timeToIndex.get(v1.time);
    const idx2 = timeToIndex.get(v2.time);

    if (idx1 === undefined || idx2 === undefined || idx2 <= idx1) {
      if (!addedTimes.has(v1.time)) {
        result.push({ time: v1.time as Time, value: Number(v1.price.toFixed(2)) });
        addedTimes.add(v1.time);
      }
      if (!addedTimes.has(v2.time)) {
        result.push({ time: v2.time as Time, value: Number(v2.price.toFixed(2)) });
        addedTimes.add(v2.time);
      }
      continue;
    }

    const span = idx2 - idx1;
    for (let i = idx1; i <= idx2; i++) {
      const bTime = bars[i].time;
      if (addedTimes.has(bTime) && i !== idx2) continue;
      const t = (i - idx1) / span;
      const val = Number((v1.price + t * (v2.price - v1.price)).toFixed(2));
      result.push({ time: bTime as Time, value: val });
      addedTimes.add(bTime);
    }
  }

  return result;
}

export function PriceChart({
  symbol,
  exchange = "NSE",
  height = 560,
  timeframe: externalTf,
  onTimeframeChange,
  pattern,
  activePattern,
  onOpenTradingView,
}: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const [internalTf, setInternalTf] = useState<Timeframe>("D");
  const activeTf = externalTf ?? internalTf;

  const handleTimeframeSelect = (tf: Timeframe) => {
    setInternalTf(tf);
    onTimeframeChange?.(tf);
  };

  const [bars, setBars] = useState<BarData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredBar, setHoveredBar] = useState<BarData | null>(null);
  const [showSr, setShowSr] = useState(true);
  const [visibleMAs, setVisibleMAs] = useState({
    sma50: true,
    sma200: true,
  });

  // Fetch real OHLCV data from our local API (re-fetch when timeframe changes)
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setBars([]);

    async function loadBars() {
      try {
        const res = await fetch(`/api/stock/${symbol}/bars?tf=${activeTf}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          if (Array.isArray(data.bars) && data.bars.length > 0) {
            setBars(data.bars);
          } else {
            setBars([]);
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error("Failed to load bars:", err);
          setError("No historical bars found in database");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadBars();
    return () => {
      cancelled = true;
    };
  }, [symbol, activeTf]);

  // Aggregate daily bars to Weekly or Monthly based on active timeframe
  const aggregatedBars = useMemo<BarData[]>(() => {
    if (!bars.length) return [];

    if (activeTf === "D") {
      return bars;
    }

    if (activeTf === "W") {
      // Group daily bars by Monday of each week
      const weeksMap = new Map<string, BarData[]>();
      for (const b of bars) {
        const mon = getMonday(b.time);
        if (!weeksMap.has(mon)) weeksMap.set(mon, []);
        weeksMap.get(mon)!.push(b);
      }

      const weekly: BarData[] = [];
      for (const [wTime, list] of weeksMap.entries()) {
        const validOpens = list.map((b) => b.open).filter((v): v is number => v != null);
        const validHighs = list.map((b) => b.high).filter((v): v is number => v != null);
        const validLows = list.map((b) => b.low).filter((v): v is number => v != null);
        const validCloses = list.map((b) => b.close).filter((v): v is number => v != null);

        if (!validCloses.length) continue;

        weekly.push({
          time: wTime,
          open: validOpens[0] ?? validCloses[0],
          high: validHighs.length ? Math.max(...validHighs) : validCloses[0],
          low: validLows.length ? Math.min(...validLows) : validCloses[0],
          close: validCloses[validCloses.length - 1],
          volume: list.reduce((sum, b) => sum + (b.volume || 0), 0),
        });
      }

      // Compute moving averages on weekly closes
      const closes = weekly.map((b) => b.close);
      const sma50 = computeSMA(closes, 50);
      const sma200 = computeSMA(closes, 200);

      return weekly.map((b, i) => ({
        ...b,
        sma50: sma50[i],
        sma200: sma200[i],
      }));
    }

    if (activeTf === "M") {
      // Group daily bars by Month (YYYY-MM-01)
      const monthsMap = new Map<string, BarData[]>();
      for (const b of bars) {
        const mKey = b.time.slice(0, 7) + "-01";
        if (!monthsMap.has(mKey)) monthsMap.set(mKey, []);
        monthsMap.get(mKey)!.push(b);
      }

      const monthly: BarData[] = [];
      for (const [mTime, list] of monthsMap.entries()) {
        const validOpens = list.map((b) => b.open).filter((v): v is number => v != null);
        const validHighs = list.map((b) => b.high).filter((v): v is number => v != null);
        const validLows = list.map((b) => b.low).filter((v): v is number => v != null);
        const validCloses = list.map((b) => b.close).filter((v): v is number => v != null);

        if (!validCloses.length) continue;

        monthly.push({
          time: mTime,
          open: validOpens[0] ?? validCloses[0],
          high: validHighs.length ? Math.max(...validHighs) : validCloses[0],
          low: validLows.length ? Math.min(...validLows) : validCloses[0],
          close: validCloses[validCloses.length - 1],
          volume: list.reduce((sum, b) => sum + (b.volume || 0), 0),
        });
      }

      // Compute moving averages on monthly closes (20 SMA)
      const closes = monthly.map((b) => b.close);
      const sma20 = computeSMA(closes, 20);

      return monthly.map((b, i) => ({
        ...b,
        sma50: sma20[i], // maps to medium MA line
        sma200: null,
      }));
    }

    return bars;
  }, [bars, activeTf]);

  // All bars directly displayed (no zoom truncation)
  const filteredBars = aggregatedBars;

  // Current or hovered bar for data HUD
  const activeBar = hoveredBar || (aggregatedBars.length > 0 ? aggregatedBars[aggregatedBars.length - 1] : null);

  const changePct = useMemo(() => {
    if (!activeBar || activeBar.open == null || activeBar.close == null) return 0;
    return ((activeBar.close - activeBar.open) / activeBar.open) * 100;
  }, [activeBar]);

  // Mount and update Lightweight Chart
  useEffect(() => {
    const el = containerRef.current;
    if (!el || filteredBars.length === 0) return;

    el.innerHTML = "";

    const initialHeight =
      el.clientHeight > 200
        ? el.clientHeight
        : typeof height === "number"
        ? Math.max(380, height - 120)
        : 520;

    const chart = createChart(el, {
      width: el.clientWidth || 800,
      height: initialHeight,
      layout: {
        background: { type: ColorType.Solid, color: "#ffffff" },
        textColor: TEXT_COLOR,
        fontSize: 12,
        fontFamily: "'JetBrains Mono', monospace",
      },
      grid: {
        vertLines: { color: GRID_COLOR },
        horzLines: { color: GRID_COLOR },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: GRID_COLOR,
        scaleMargins: { top: 0.08, bottom: 0.22 },
      },
      timeScale: {
        borderColor: GRID_COLOR,
        rightOffset: 8,
        barSpacing: activeTf === "D" ? 9 : activeTf === "W" ? 14 : 20,
        timeVisible: true,
        visible: true,
      },
    });

    chartRef.current = chart;

    // 1. Candlestick series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: UP_COLOR,
      downColor: DOWN_COLOR,
      wickUpColor: UP_COLOR,
      wickDownColor: DOWN_COLOR,
      borderVisible: false,
    });

    const candleData = filteredBars
      .filter((b) => b.open != null && b.high != null && b.low != null && b.close != null)
      .map((b) => ({
        time: b.time as Time,
        open: b.open!,
        high: b.high!,
        low: b.low!,
        close: b.close!,
      }));
    candleSeries.setData(candleData);

    // 1b. Support & Resistance lines (Auto drawn from swing highs & lows)
    if (showSr) {
      const srLevels = supportResistance(filteredBars);
      for (const level of srLevels) {
        candleSeries.createPriceLine({
          price: level.price,
          color: level.type === "resistance" ? RESISTANCE_COLOR : SUPPORT_COLOR,
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: `${level.type === "resistance" ? "R" : "S"} · ${level.touches}×`,
        });
      }
    }

    // 1c. Pattern levels (Pivot & Stop Loss) if available
    if (pattern?.pivotPrice) {
      candleSeries.createPriceLine({
        price: pattern.pivotPrice,
        color: "#7c3aed",
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `Pivot · ₹${pattern.pivotPrice}`,
      });
    }
    if (pattern?.stopLossPrice) {
      candleSeries.createPriceLine({
        price: pattern.stopLossPrice,
        color: "#dc2626",
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `Stop · ₹${pattern.stopLossPrice}`,
      });
    }

    // 1d. Auto-drawn Chart Pattern overlay lines (from PDF detected pattern)
    if (activePattern) {
      if (activePattern.keyLevels?.resistance) {
        candleSeries.createPriceLine({
          price: activePattern.keyLevels.resistance,
          color: "#dc2626",
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: `${activePattern.name} Res · ₹${activePattern.keyLevels.resistance.toFixed(2)}`,
        });
      }
      if (activePattern.keyLevels?.support) {
        candleSeries.createPriceLine({
          price: activePattern.keyLevels.support,
          color: "#16a34a",
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: `${activePattern.name} Sup · ₹${activePattern.keyLevels.support.toFixed(2)}`,
        });
      }
      if (activePattern.keyLevels?.neckline) {
        candleSeries.createPriceLine({
          price: activePattern.keyLevels.neckline,
          color: "#d97706",
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `Neckline · ₹${activePattern.keyLevels.neckline.toFixed(2)}`,
        });
      }
      if (activePattern.keyLevels?.target) {
        candleSeries.createPriceLine({
          price: activePattern.keyLevels.target,
          color: "#7c3aed",
          lineWidth: 2,
          lineStyle: LineStyle.LargeDashed,
          axisLabelVisible: true,
          title: `Target · ₹${activePattern.keyLevels.target.toFixed(2)}`,
        });
      }
      if (activePattern.keyLevels?.stopLoss) {
        candleSeries.createPriceLine({
          price: activePattern.keyLevels.stopLoss,
          color: "#b91c1c",
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: `SL · ₹${activePattern.keyLevels.stopLoss.toFixed(2)}`,
        });
      }

      // Clearly mark the pattern formation visually on the candles with markers
      if (filteredBars.length > 0) {
        const markers: SeriesMarker<Time>[] = [];
        const lastBar = filteredBars[filteredBars.length - 1];

        // Start marker if startDate matches
        if (activePattern.startDate) {
          const startBar = filteredBars.find((b) => b.time === activePattern.startDate);
          if (startBar) {
            markers.push({
              time: startBar.time as Time,
              position: "belowBar",
              color: "#7c3aed",
              shape: "circle",
              text: "Start",
            });
          }
        }

        // Active trigger / breakout marker on the latest bar
        markers.push({
          time: lastBar.time as Time,
          position: "belowBar",
          color: "#16a34a",
          shape: "arrowUp",
          text: "Breakout",
        });

        createSeriesMarkers(candleSeries, markers);
      }

      // Draw exact line segments and continuous zigzag paths
      if (activePattern.drawLines && activePattern.drawLines.length > 0) {
        for (const dl of activePattern.drawLines) {
          const vertices: { time: string; price: number }[] = [];
          if (dl.path && dl.path.length >= 2) {
            vertices.push(...dl.path);
          } else if (dl.p1 && dl.p2) {
            vertices.push(dl.p1, dl.p2);
          }

          if (vertices.length >= 2) {
            const interpolated = buildInterpolatedSeriesData(vertices, filteredBars);
            if (interpolated.length > 0) {
              const segSeries = chart.addSeries(LineSeries, {
                color: dl.color || "#2563eb",
                lineWidth: (dl.width === 1 ? 1 : dl.width === 3 ? 3 : dl.width === 4 ? 4 : 2),
                lineStyle: dl.dashed ? LineStyle.Dashed : LineStyle.Solid,
                priceLineVisible: false,
                lastValueVisible: false,
                crosshairMarkerVisible: false,
              });
              segSeries.setData(interpolated);
            }
          }
        }
      }
    }

    // 2. Volume series in bottom 18% with clean spacing above time scale
    const volSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });
    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.82, bottom: 0.02 },
    });

    const volData = filteredBars.map((b) => ({
      time: b.time as Time,
      value: b.volume,
      color:
        (b.close ?? 0) >= (b.open ?? 0)
          ? "rgba(21, 128, 61, 0.35)"
          : "rgba(185, 28, 28, 0.35)",
    }));
    volSeries.setData(volData);

    // 3. Simple Moving Averages (50 SMA, 200 SMA)
    if (visibleMAs.sma50) {
      const sma50Series = chart.addSeries(LineSeries, {
        color: "#d97706",
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      sma50Series.setData(
        filteredBars
          .filter((b) => b.sma50 != null)
          .map((b) => ({ time: b.time as Time, value: b.sma50! }))
      );
    }

    if (visibleMAs.sma200 && activeTf !== "M") {
      const sma200Series = chart.addSeries(LineSeries, {
        color: "#2563eb",
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      sma200Series.setData(
        filteredBars
          .filter((b) => b.sma200 != null)
          .map((b) => ({ time: b.time as Time, value: b.sma200! }))
      );
    }

    // Subscribe to crosshair move for HUD
    const timeToBar = new Map(filteredBars.map((b) => [b.time, b]));
    chart.subscribeCrosshairMove((param) => {
      if (!param.time) {
        setHoveredBar(null);
        return;
      }
      const bar = timeToBar.get(param.time as string);
      if (bar) {
        setHoveredBar(bar);
      }
    });

    // Focus view on recent 80–120 bars so candles are clearly visible and legible
    const totalBars = filteredBars.length;
    if (totalBars > 0) {
      if (activePattern && activePattern.startDate) {
        // Find pattern start and fit from start to now
        const startIdx = filteredBars.findIndex((b) => b.time === activePattern.startDate);
        const fromIdx = Math.max(0, startIdx > -1 ? startIdx - 15 : totalBars - 90);
        chart.timeScale().setVisibleLogicalRange({
          from: fromIdx,
          to: totalBars + 5,
        });
      } else {
        const fromIdx = Math.max(0, totalBars - 100);
        chart.timeScale().setVisibleLogicalRange({
          from: fromIdx,
          to: totalBars + 5,
        });
      }
    }

    // Resize observer dynamically adjusts both width and height to fit container without clipping
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry && chartRef.current) {
        const { width, height: rectHeight } = entry.contentRect;
        if (width > 0 && rectHeight > 0) {
          chartRef.current.applyOptions({
            width,
            height: rectHeight,
          });
        }
      }
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [filteredBars, height, visibleMAs, activeTf, showSr, pattern, activePattern]);

  const tvLink = `https://www.tradingview.com/chart/?symbol=${exchange}:${symbol}&interval=${activeTf}`;

  // Formatted HUD date label
  const formattedTime = useMemo(() => {
    if (!activeBar) return "—";
    if (activeTf === "W") return `Week of ${activeBar.time}`;
    if (activeTf === "M") {
      const [y, m] = activeBar.time.split("-");
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `${monthNames[Number(m) - 1]} ${y}`;
    }
    return activeBar.time;
  }, [activeBar, activeTf]);

  // Nearest support and resistance
  const activeSr = useMemo(() => {
    if (!showSr || !filteredBars.length) return { nearestS: null, nearestR: null };
    const levels = supportResistance(filteredBars);
    const r = levels.find((l) => l.type === "resistance");
    const s = levels.find((l) => l.type === "support");
    return { nearestS: s, nearestR: r };
  }, [showSr, filteredBars]);

  // Indicator names adapt to active timeframe
  const maLabels = useMemo(() => {
    if (activeTf === "W") {
      return { mid: "50 WMA", slow: "200 WMA" };
    }
    if (activeTf === "M") {
      return { mid: "20 MMA", slow: "" };
    }
    return { mid: "50 SMA", slow: "200 SMA" };
  }, [activeTf]);

  return (
    <div className="flex flex-col h-full w-full bg-surface select-none">
      {/* Top Controls: D / W / M + Indicators + TV link */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3 px-3 sm:px-4 pt-2 bg-surface">
        {/* Left: Symbol & D, W, M Timeframe Selector */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <span className="font-mono font-extrabold text-base text-text tracking-wide flex items-center gap-2">
            <span>{symbol}</span>
            <span className="text-xs font-bold text-text-muted px-2 py-0.5 rounded bg-surface-2 border border-border">
              {exchange}
            </span>
          </span>

          {/* D, W, M Timeframe Buttons */}
          <div className="flex items-center rounded-lg border border-border bg-surface-2 p-0.5 text-xs font-mono font-bold shadow-2xs">
            {(["D", "W", "M"] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => handleTimeframeSelect(tf)}
                className={`px-3 py-1 rounded-md transition-all ${
                  activeTf === tf
                    ? "bg-accent text-white font-extrabold shadow-xs"
                    : "text-text-secondary hover:text-text hover:bg-surface"
                }`}
                title={
                  tf === "D"
                    ? "Daily Candlesticks (1D)"
                    : tf === "W"
                    ? "Weekly Candlesticks (1W)"
                    : "Monthly Candlesticks (1M)"
                }
              >
                {tf}
              </button>
            ))}
          </div>

          {/* Indicator toggles */}
          <div className="hidden sm:flex items-center gap-2 text-xs font-mono font-semibold">
            <button
              onClick={() => setVisibleMAs((p) => ({ ...p, sma50: !p.sma50 }))}
              className={`px-2.5 py-1 rounded-md border transition-all ${
                visibleMAs.sma50
                  ? "bg-amber-100 text-amber-950 border-amber-400 font-bold shadow-2xs"
                  : "bg-surface text-text-muted border-border line-through"
              }`}
            >
              {maLabels.mid}
            </button>
            {maLabels.slow && (
              <button
                onClick={() => setVisibleMAs((p) => ({ ...p, sma200: !p.sma200 }))}
                className={`px-2.5 py-1 rounded-md border transition-all ${
                  visibleMAs.sma200
                    ? "bg-blue-100 text-blue-950 border-blue-400 font-bold shadow-2xs"
                    : "bg-surface text-text-muted border-border line-through"
                }`}
              >
                {maLabels.slow}
              </button>
            )}

            {/* S/R Lines toggle button */}
            <button
              onClick={() => setShowSr((prev) => !prev)}
              className={`px-2.5 py-1 rounded-md border transition-all ${
                showSr
                  ? "bg-slate-100 text-slate-900 border-slate-400 font-extrabold shadow-2xs"
                  : "bg-surface text-text-muted border-border line-through"
              }`}
              title="Toggle Auto Support (blue) & Resistance (amber) swing levels"
            >
              S/R Levels
            </button>
          </div>
        </div>

        {/* Right: External links */}
        <div className="flex items-center gap-2">
          <a
            href={tvLink}
            target="_blank"
            rel="noopener noreferrer"
            title="Open full interactive chart directly on TradingView.com"
            className="flex items-center gap-1.5 text-xs font-mono font-bold text-accent border border-accent-border bg-accent-tint/40 hover:bg-accent-tint px-3 py-1.5 rounded-lg transition-colors shadow-2xs"
          >
            <span>TradingView.com</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Crosshair Values HUD */}
      {activeBar && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs sm:text-sm font-mono py-2 px-3 sm:px-4 bg-surface-2 border-b border-border text-text-secondary font-medium">
          <span className="text-text font-bold bg-surface px-2.5 py-0.5 rounded border border-border flex items-center gap-1.5">
            <span className="text-accent font-extrabold">{activeTf}:</span>
            <span>{formattedTime}</span>
          </span>
          <span>
            O: <b className="text-text font-bold">₹{activeBar.open?.toFixed(2) ?? "—"}</b>
          </span>
          <span>
            H: <b className="text-text font-bold">₹{activeBar.high?.toFixed(2) ?? "—"}</b>
          </span>
          <span>
            L: <b className="text-text font-bold">₹{activeBar.low?.toFixed(2) ?? "—"}</b>
          </span>
          <span>
            C: <b className="text-text font-bold">₹{activeBar.close?.toFixed(2) ?? "—"}</b>
          </span>
          <span
            className={`font-bold px-1.5 py-0.5 rounded ${
              changePct >= 0
                ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                : "bg-rose-100 text-rose-800 border border-rose-300"
            }`}
          >
            {changePct >= 0 ? "+" : ""}
            {changePct.toFixed(2)}%
          </span>
          <span>
            Vol:{" "}
            <b className="text-text font-bold">
              {activeBar.volume > 10000000
                ? `${(activeBar.volume / 10000000).toFixed(2)} Cr`
                : activeBar.volume > 100000
                ? `${(activeBar.volume / 100000).toFixed(2)} L`
                : activeBar.volume.toLocaleString("en-IN")}
            </b>
          </span>

          {activeSr.nearestS && (
            <span className="hidden lg:inline bg-blue-50 text-blue-900 border border-blue-200 px-2 py-0.5 rounded text-xs font-bold">
              S: ₹{activeSr.nearestS.price} ({activeSr.nearestS.touches}×)
            </span>
          )}

          {activeSr.nearestR && (
            <span className="hidden lg:inline bg-amber-50 text-amber-950 border border-amber-300 px-2 py-0.5 rounded text-xs font-bold">
              R: ₹{activeSr.nearestR.price} ({activeSr.nearestR.touches}×)
            </span>
          )}
        </div>
      )}

      {/* Chart Canvas Area */}
      <div className="relative flex-1 w-full min-h-0 overflow-hidden">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface/80 backdrop-blur-xs z-10 text-xs sm:text-sm font-mono text-text-muted">
            <RefreshCw className="w-4 h-4 animate-spin mr-2 text-accent" />
            Loading complete historical candles...
          </div>
        )}

        {error && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface z-10 text-xs sm:text-sm font-mono text-text-muted p-4 text-center">
            <p className="mb-2 text-text font-bold text-sm sm:text-base">{error}</p>
            <a
              href={tvLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline flex items-center gap-1.5 font-bold"
            >
              <span>View chart on TradingView.com</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        )}

        <div ref={containerRef} className="w-full h-full" />
      </div>
    </div>
  );
}

export default PriceChart;
