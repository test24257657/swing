"use client";

import { type CandlestickData, ColorType, type HistogramData, LineStyle, type Time, createChart } from "lightweight-charts";
import { useEffect, useRef } from "react";

import type { IpoBar } from "@/lib/api/market-types";

const UP = "#16a34a";
const DOWN = "#dc2626";
const IPO_LINE = "#ea580c"; // issue price — the allottee's cost
const LISTING_LINE = "#2563eb"; // listing-day close — the cost of buying on day one
const VISIBLE_BARS = 90; // sessions shown by default; older bars are a drag away

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
      // A card can be laid out at zero width on first paint (grid + lazy content);
      // creating the chart at 0 leaves it blank until something forces a redraw, so
      // start at a sane width and let the ResizeObserver below correct it.
      width: el.clientWidth || 320,
      height,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#8b8b93", fontSize: 10 },
      grid: { vertLines: { visible: false }, horzLines: { color: "rgba(9,9,11,0.05)" } },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.12, bottom: 0.28 } },
      timeScale: {
        borderVisible: false,
        // A freshly listed IPO has ~8 bars; without a minimum spacing they render as a
        // hairline in the corner of a 460px card.
        barSpacing: bars.length < 30 ? 9 : 5,
        minBarSpacing: 2,
        rightOffset: 2,
      },
      crosshair: { horzLine: { visible: false }, vertLine: { labelVisible: false } },
      // Drag to pan and pinch to zoom, but **no wheel zoom**: with ten charts on a page
      // the wheel has to keep scrolling the page, or the screen traps the cursor.
      handleScroll: { mouseWheel: false, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { mouseWheel: false, pinch: true, axisPressedMouseMove: true, axisDoubleClickReset: true },
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

    // Show the recent stretch at a readable candle width rather than squeezing the
    // whole listing history into 450px — 247 sessions at full fit renders as a hairline
    // smear. Drag left to see the rest; double-click the axis resets.
    const fit = () => {
      if (bars.length > VISIBLE_BARS) {
        chart.timeScale().setVisibleLogicalRange({ from: bars.length - VISIBLE_BARS, to: bars.length + 2 });
      } else {
        chart.timeScale().fitContent();
      }
    };
    fit();
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      if (w > 0) {
        chart.applyOptions({ width: w });
        fit();
      }
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, [bars, issuePrice, listingClose, height]);

  return <div ref={box} className="w-full" style={{ height }} />;
}
