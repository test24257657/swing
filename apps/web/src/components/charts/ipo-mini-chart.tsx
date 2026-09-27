"use client";

import { type CandlestickData, ColorType, type HistogramData, LineStyle, type Time, createChart } from "lightweight-charts";
import { useEffect, useRef } from "react";

import type { IpoBar } from "@/lib/api/market-types";

const UP = "#16a34a";
const DOWN = "#dc2626";
const IPO_LINE = "#ea580c"; // issue price — the allottee's cost
const LISTING_LINE = "#2563eb"; // listing-day close — the cost of buying on day one

/** Post-listing candles with the two lines an IPO screen is really about: what the
 * issue was priced at, and where it closed on listing day. No axes clutter, no
 * moving averages — this is a thumbnail meant to be scanned 10 at a time. */
export function IpoMiniChart({
  bars,
  issuePrice,
  listingClose,
  height = 200,
}: {
  bars: IpoBar[];
  issuePrice: number | null;
  listingClose: number | null;
  height?: number;
}) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el || bars.length === 0) return;

    const chart = createChart(el, {
      width: el.clientWidth,
      height,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#8b8b93", fontSize: 10 },
      grid: { vertLines: { visible: false }, horzLines: { color: "rgba(9,9,11,0.05)" } },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.12, bottom: 0.28 } },
      timeScale: { borderVisible: false, fixLeftEdge: true, fixRightEdge: true },
      crosshair: { horzLine: { visible: false }, vertLine: { labelVisible: false } },
      handleScroll: false,
      handleScale: false,
    });

    const candles = chart.addCandlestickSeries({
      upColor: UP,
      downColor: DOWN,
      borderUpColor: UP,
      borderDownColor: DOWN,
      wickUpColor: UP,
      wickDownColor: DOWN,
      priceLineVisible: false,
      lastValueVisible: true,
    });
    candles.setData(
      bars
        .filter((b) => b.open != null && b.high != null && b.low != null && b.close != null)
        .map((b) => ({ time: b.time as Time, open: b.open!, high: b.high!, low: b.low!, close: b.close! }) as CandlestickData),
    );

    const vol = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
      color: "rgba(139,139,147,0.4)",
    });
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    vol.setData(
      bars.map(
        (b) =>
          ({
            time: b.time as Time,
            value: b.volume,
            color: (b.close ?? 0) >= (b.open ?? 0) ? "rgba(22,163,74,0.35)" : "rgba(220,38,38,0.35)",
          }) as HistogramData,
      ),
    );

    if (issuePrice != null) {
      candles.createPriceLine({
        price: issuePrice,
        color: IPO_LINE,
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: "IPO",
      });
    }
    if (listingClose != null) {
      candles.createPriceLine({
        price: listingClose,
        color: LISTING_LINE,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: "List",
      });
    }

    chart.timeScale().fitContent();
    const ro = new ResizeObserver(([entry]) => chart.applyOptions({ width: entry.contentRect.width }));
    ro.observe(el);
    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, [bars, issuePrice, listingClose, height]);

  return <div ref={box} className="w-full" style={{ height }} />;
}
