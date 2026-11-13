/**
 * src/lib/chart-patterns.ts
 *
 * Auto-detects BUY-SIDE (BULLISH) chart patterns:
 * REVERSAL: Double Bottom, Triple Bottom, Inverse Head & Shoulders, Falling Wedge
 * CONTINUATION: Bullish Flag, Bullish Pennant, Bullish Rectangle, Cup & Handle
 * BREAKOUT: Ascending Triangle
 *
 * Provides exact visual path vertices ("image type lines") to draw bold zigzag
 * paths (like the "W" pattern) and key levels directly onto lightweight-charts.
 */

export type PatternCategory = "reversal" | "continuation" | "neutral";
export type PatternBias = "bullish" | "bearish" | "neutral";

export interface DrawPoint {
  time: string;
  price: number;
}

export interface DrawLine {
  type: "segment" | "horizontal" | "trendline" | "path";
  color: string;
  width: number;
  dashed?: boolean;
  p1?: DrawPoint;
  p2?: DrawPoint;
  path?: DrawPoint[];       // multi-vertex zigzag path (e.g. W shape, Head & Shoulders)
  points?: { index?: number; price: number }[];
  title?: string;
}

export interface DetectedPattern {
  name: string;
  category: PatternCategory;
  bias: PatternBias;
  confidence: number;       // 0–100
  startIndex: number;       // bar index where pattern begins
  endIndex: number;         // bar index where pattern ends (latest bar)
  startDate: string;
  endDate: string;
  keyLevels: {
    neckline?: number;      // H&S neckline or Double Bottom peak
    resistance?: number;    // top of pattern
    support?: number;       // bottom of pattern
    target?: number;        // price projection
    stopLoss?: number;
  };
  drawLines: DrawLine[];    // exact lines with start/end time coordinates to draw
  description: string;
}

export interface BarData {
  time: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number;
}

// ─── Utility helpers ──────────────────────────────────────────────────────────

function pct(a: number, b: number) {
  return Math.abs(a - b) / ((a + b) / 2);
}

function avg(...vals: number[]) {
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/** Find local pivot highs: bar[i].high > all neighbors within `w` bars */
function pivotHighs(bars: BarData[], w = 3): number[] {
  const idxs: number[] = [];
  for (let i = w; i < bars.length - w; i++) {
    const h = bars[i].high!;
    let isPivot = true;
    for (let j = i - w; j <= i + w; j++) {
      if (j !== i && bars[j].high! >= h) {
        isPivot = false;
        break;
      }
    }
    if (isPivot) idxs.push(i);
  }
  return idxs;
}

/** Find local pivot lows: bar[i].low < all neighbors within `w` bars */
function pivotLows(bars: BarData[], w = 3): number[] {
  const idxs: number[] = [];
  for (let i = w; i < bars.length - w; i++) {
    const l = bars[i].low!;
    let isPivot = true;
    for (let j = i - w; j <= i + w; j++) {
      if (j !== i && bars[j].low! <= l) {
        isPivot = false;
        break;
      }
    }
    if (isPivot) idxs.push(i);
  }
  return idxs;
}

function b(bars: BarData[], i: number) {
  return bars[i];
}

// ─── 1. Bullish Reversal: Double Bottom ('W' Shape) ──────────────────────────

function detectDoubleBottom(bars: BarData[]): DetectedPattern | null {
  const pl = pivotLows(bars, 4);
  if (pl.length < 2) return null;

  for (let k = pl.length - 1; k >= 1; k--) {
    const i2 = pl[k], i1 = pl[k - 1];
    if (i2 - i1 < 8 || i2 - i1 > 120) continue;
    const l1 = b(bars, i1).low!, l2 = b(bars, i2).low!;
    if (pct(l1, l2) > 0.045) continue;

    // Intermediate peak between i1 and i2
    let peakIdx = i1;
    let peakHigh = -Infinity;
    for (let j = i1; j <= i2; j++) {
      if (b(bars, j).high! > peakHigh) {
        peakHigh = b(bars, j).high!;
        peakIdx = j;
      }
    }
    const neckline = peakHigh;
    const lastIdx = bars.length - 1;
    const currentClose = b(bars, lastIdx).close!;
    const confirmed = currentClose >= neckline * 0.99;
    const bottomPrice = avg(l1, l2);
    const patternH = neckline - bottomPrice;

    // Prior peak before i1 (start of the decline)
    const preWindow = Math.max(0, i1 - 15);
    let startIdx = preWindow;
    let startHigh = -Infinity;
    for (let j = preWindow; j <= i1; j++) {
      if (b(bars, j).high! > startHigh) {
        startHigh = b(bars, j).high!;
        startIdx = j;
      }
    }

    return {
      name: "Double Bottom",
      category: "reversal",
      bias: "bullish",
      confidence: confirmed ? 88 : 65,
      startIndex: startIdx,
      endIndex: lastIdx,
      startDate: bars[startIdx].time,
      endDate: bars[lastIdx].time,
      keyLevels: {
        support: bottomPrice,
        neckline,
        target: neckline + patternH,
        stopLoss: bottomPrice * 0.98,
      },
      drawLines: [
        // Bold continuous W-path: Start Peak -> Trough 1 -> Middle Peak -> Trough 2 -> Breakout
        {
          type: "path",
          color: "#2563eb",
          width: 3,
          path: [
            { time: bars[startIdx].time, price: startHigh },
            { time: bars[i1].time, price: l1 },
            { time: bars[peakIdx].time, price: peakHigh },
            { time: bars[i2].time, price: l2 },
            { time: bars[lastIdx].time, price: currentClose },
          ],
          title: "Double Bottom 'W' Path",
        },
        // Flat Neckline (amber dashed)
        {
          type: "segment",
          color: "#d97706",
          width: 2,
          dashed: true,
          p1: { time: bars[i1].time, price: neckline },
          p2: { time: bars[lastIdx].time, price: neckline },
          title: "Neckline",
        },
        // Flat Support Baseline (green dashed)
        {
          type: "segment",
          color: "#16a34a",
          width: 2,
          dashed: true,
          p1: { time: bars[i1].time, price: bottomPrice },
          p2: { time: bars[lastIdx].time, price: bottomPrice },
          title: "Support Baseline",
        },
      ],
      description: "Two troughs at similar lows forming a 'W'. Strong bullish reversal confirmed when price breaks above the neckline.",
    };
  }
  return null;
}

// ─── 2. Bullish Reversal: Triple Bottom ───────────────────────────────────────

function detectTripleBottom(bars: BarData[]): DetectedPattern | null {
  const pl = pivotLows(bars, 4);
  if (pl.length < 3) return null;

  for (let k = pl.length - 1; k >= 2; k--) {
    const [i1, i2, i3] = [pl[k - 2], pl[k - 1], pl[k]];
    if (i3 - i1 > 160 || i2 - i1 < 8 || i3 - i2 < 8) continue;
    const [l1, l2, l3] = [b(bars, i1).low!, b(bars, i2).low!, b(bars, i3).low!];
    if (pct(l1, l2) > 0.045 || pct(l2, l3) > 0.045) continue;

    // Intermediate peaks
    let peak1Idx = i1, peak1High = -Infinity;
    for (let j = i1; j <= i2; j++) {
      if (b(bars, j).high! > peak1High) {
        peak1High = b(bars, j).high!;
        peak1Idx = j;
      }
    }
    let peak2Idx = i2, peak2High = -Infinity;
    for (let j = i2; j <= i3; j++) {
      if (b(bars, j).high! > peak2High) {
        peak2High = b(bars, j).high!;
        peak2Idx = j;
      }
    }

    const neckline = Math.max(peak1High, peak2High);
    const bottomPrice = avg(l1, l2, l3);
    const patternH = neckline - bottomPrice;

    // Prior peak
    const preWindow = Math.max(0, i1 - 15);
    let startIdx = preWindow, startHigh = -Infinity;
    for (let j = preWindow; j <= i1; j++) {
      if (b(bars, j).high! > startHigh) {
        startHigh = b(bars, j).high!;
        startIdx = j;
      }
    }

    const lastIdx = bars.length - 1;
    const currentClose = b(bars, lastIdx).close!;

    return {
      name: "Triple Bottom",
      category: "reversal",
      bias: "bullish",
      confidence: 84,
      startIndex: startIdx,
      endIndex: lastIdx,
      startDate: bars[startIdx].time,
      endDate: bars[lastIdx].time,
      keyLevels: {
        support: bottomPrice,
        neckline,
        target: neckline + patternH,
        stopLoss: bottomPrice * 0.98,
      },
      drawLines: [
        // Bold continuous Triple Bottom Path
        {
          type: "path",
          color: "#2563eb",
          width: 3,
          path: [
            { time: bars[startIdx].time, price: startHigh },
            { time: bars[i1].time, price: l1 },
            { time: bars[peak1Idx].time, price: peak1High },
            { time: bars[i2].time, price: l2 },
            { time: bars[peak2Idx].time, price: peak2High },
            { time: bars[i3].time, price: l3 },
            { time: bars[lastIdx].time, price: currentClose },
          ],
          title: "Triple Bottom Path",
        },
        {
          type: "segment",
          color: "#d97706",
          width: 2,
          dashed: true,
          p1: { time: bars[i1].time, price: neckline },
          p2: { time: bars[lastIdx].time, price: neckline },
          title: "Neckline",
        },
        {
          type: "segment",
          color: "#16a34a",
          width: 2,
          dashed: true,
          p1: { time: bars[i1].time, price: bottomPrice },
          p2: { time: bars[lastIdx].time, price: bottomPrice },
          title: "Support Baseline",
        },
      ],
      description: "Three troughs at similar lows. Strong bullish reversal — three support tests all held before breakout.",
    };
  }
  return null;
}

// ─── 3. Bullish Reversal: Inverse Head & Shoulders ───────────────────────────

function detectInverseHeadAndShoulders(bars: BarData[]): DetectedPattern | null {
  const pl = pivotLows(bars, 4);
  if (pl.length < 3) return null;

  for (let k = pl.length - 1; k >= 2; k--) {
    const [lSh, head, rSh] = [pl[k - 2], pl[k - 1], pl[k]];
    const [lL, hL, rL] = [b(bars, lSh).low!, b(bars, head).low!, b(bars, rSh).low!];
    if (hL >= lL || hL >= rL) continue; // head must be lowest
    if (pct(lL, rL) > 0.05) continue;
    if (rSh - lSh > 150 || head - lSh < 8 || rSh - head < 8) continue;

    let leftPeakIdx = lSh, leftPeak = -Infinity;
    for (let j = lSh; j <= head; j++) {
      if (b(bars, j).high! > leftPeak) {
        leftPeak = b(bars, j).high!;
        leftPeakIdx = j;
      }
    }
    let rightPeakIdx = head, rightPeak = -Infinity;
    for (let j = head; j <= rSh; j++) {
      if (b(bars, j).high! > rightPeak) {
        rightPeak = b(bars, j).high!;
        rightPeakIdx = j;
      }
    }

    const neckline = avg(leftPeak, rightPeak);
    const patternH = neckline - hL;

    // Prior peak
    const preWindow = Math.max(0, lSh - 15);
    let startIdx = preWindow, startHigh = -Infinity;
    for (let j = preWindow; j <= lSh; j++) {
      if (b(bars, j).high! > startHigh) {
        startHigh = b(bars, j).high!;
        startIdx = j;
      }
    }

    const lastIdx = bars.length - 1;
    const currentClose = b(bars, lastIdx).close!;

    return {
      name: "Inverse H&S",
      category: "reversal",
      bias: "bullish",
      confidence: 86,
      startIndex: startIdx,
      endIndex: lastIdx,
      startDate: bars[startIdx].time,
      endDate: bars[lastIdx].time,
      keyLevels: {
        support: hL,
        neckline,
        target: neckline + patternH,
        stopLoss: hL * 0.99,
      },
      drawLines: [
        // Bold continuous Inverse H&S Path
        {
          type: "path",
          color: "#2563eb",
          width: 3,
          path: [
            { time: bars[startIdx].time, price: startHigh },
            { time: bars[lSh].time, price: lL },
            { time: bars[leftPeakIdx].time, price: leftPeak },
            { time: bars[head].time, price: hL },
            { time: bars[rightPeakIdx].time, price: rightPeak },
            { time: bars[rSh].time, price: rL },
            { time: bars[lastIdx].time, price: currentClose },
          ],
          title: "Inverse H&S Path",
        },
        // Neckline line
        {
          type: "segment",
          color: "#d97706",
          width: 2,
          dashed: true,
          p1: { time: bars[leftPeakIdx].time, price: leftPeak },
          p2: { time: bars[lastIdx].time, price: rightPeak },
          title: "Neckline",
        },
        // Shoulders Support baseline
        {
          type: "segment",
          color: "#16a34a",
          width: 2,
          dashed: true,
          p1: { time: bars[lSh].time, price: avg(lL, rL) },
          p2: { time: bars[rSh].time, price: avg(lL, rL) },
          title: "Shoulders Support",
        },
      ],
      description: "Three troughs where the middle is deepest. Strong bullish reversal — buy on neckline breakout with volume confirmation.",
    };
  }
  return null;
}

// ─── 4. Bullish Reversal: Falling Wedge ──────────────────────────────────────

function detectFallingWedge(bars: BarData[]): DetectedPattern[] {
  const results: DetectedPattern[] = [];
  const ph = pivotHighs(bars, 3);
  const pl = pivotLows(bars, 3);
  if (ph.length < 2 || pl.length < 2) return results;

  const [hi2, hi1] = [ph[ph.length - 1], ph[ph.length - 2]];
  const [lo2, lo1] = [pl[pl.length - 1], pl[pl.length - 2]];
  const [hH2, hH1] = [b(bars, hi2).high!, b(bars, hi1).high!];
  const [lL2, lL1] = [b(bars, lo2).low!, b(bars, lo1).low!];

  const startI = Math.min(hi1, lo1);
  if (bars.length - startI < 10 || bars.length - startI > 100) return results;

  const highsFalling = hH2 < hH1;
  const lowsFalling = lL2 < lL1;

  if (highsFalling && lowsFalling) {
    const highSlope = Math.abs((hH2 - hH1) / (hi2 - hi1));
    const lowSlope = Math.abs((lL2 - lL1) / (lo2 - lo1));
    if (lowSlope > highSlope * 1.05) {
      const lastIdx = bars.length - 1;
      const target = hH1;
      results.push({
        name: "Falling Wedge",
        category: "reversal",
        bias: "bullish",
        confidence: 75,
        startIndex: startI,
        endIndex: lastIdx,
        startDate: bars[startI].time,
        endDate: bars[lastIdx].time,
        keyLevels: {
          resistance: hH2,
          support: lL2,
          target,
          stopLoss: lL2 * 0.98,
        },
        drawLines: [
          // Upper descending resistance trendline
          {
            type: "segment",
            color: "#d97706",
            width: 2,
            p1: { time: bars[hi1].time, price: hH1 },
            p2: { time: bars[lastIdx].time, price: hH2 },
            title: "Falling Resistance",
          },
          // Lower descending support trendline
          {
            type: "segment",
            color: "#16a34a",
            width: 2,
            p1: { time: bars[lo1].time, price: lL1 },
            p2: { time: bars[lastIdx].time, price: lL2 },
            title: "Falling Support",
          },
          // Breakout upward path
          {
            type: "path",
            color: "#2563eb",
            width: 3,
            path: [
              { time: bars[lo2].time, price: lL2 },
              { time: bars[lastIdx].time, price: bars[lastIdx].close! },
            ],
            title: "Breakout",
          },
        ],
        description: "Falling wedge: downward price action converging into an apex. Strong bullish reversal — buy the upside breakout.",
      });
    }
  }
  return results;
}

// ─── 5. Bullish Continuation: Bullish Flag ───────────────────────────────────

function detectBullishFlag(bars: BarData[]): DetectedPattern[] {
  const results: DetectedPattern[] = [];
  if (bars.length < 25) return results;

  for (const poleLen of [15, 20, 30]) {
    const flagLen = Math.min(10, Math.floor(poleLen / 2));
    if (bars.length < poleLen + flagLen) continue;
    const pole = bars.slice(-poleLen - flagLen, -flagLen);
    const flag = bars.slice(-flagLen);
    const poleMove = (pole[pole.length - 1].close! - pole[0].close!) / pole[0].close!;
    if (poleMove < 0.06) continue; // Bull flag pole must surge > 6%

    const flagHigh = Math.max(...flag.map((x) => x.high!));
    const flagLow = Math.min(...flag.map((x) => x.low!));
    const flagRange = (flagHigh - flagLow) / flagLow;
    if (flagRange > 0.08) continue; // flag must be a tight channel

    const offset = bars.length - poleLen - flagLen;
    const lastIdx = bars.length - 1;
    const poleHeight = pole[pole.length - 1].close! - pole[0].close!;
    const target = flagHigh + poleHeight;

    results.push({
      name: "Bullish Flag",
      category: "continuation",
      bias: "bullish",
      confidence: 78,
      startIndex: offset,
      endIndex: lastIdx,
      startDate: bars[offset].time,
      endDate: bars[lastIdx].time,
      keyLevels: {
        resistance: flagHigh,
        support: flagLow,
        target,
        stopLoss: flagLow * 0.98,
      },
      drawLines: [
        // Flagpole + Flag consolidation path
        {
          type: "path",
          color: "#2563eb",
          width: 3,
          path: [
            { time: bars[offset].time, price: pole[0].close! },
            { time: bars[offset + poleLen - 1].time, price: pole[pole.length - 1].close! },
            { time: bars[offset + poleLen].time, price: flagLow },
            { time: bars[lastIdx].time, price: bars[lastIdx].close! },
          ],
          title: "Flagpole & Breakout",
        },
        // Flag upper channel boundary
        {
          type: "segment",
          color: "#d97706",
          width: 2,
          dashed: true,
          p1: { time: bars[offset + poleLen - 1].time, price: flagHigh },
          p2: { time: bars[lastIdx].time, price: flagHigh },
          title: "Flag High",
        },
        // Flag lower channel boundary
        {
          type: "segment",
          color: "#16a34a",
          width: 2,
          dashed: true,
          p1: { time: bars[offset + poleLen].time, price: flagLow },
          p2: { time: bars[lastIdx].time, price: flagLow },
          title: "Flag Low",
        },
      ],
      description: "Sharp up-move (pole) followed by tight consolidation (flag). Strong bullish continuation — buy the breakout.",
    });
    break;
  }
  return results;
}

// ─── 6. Bullish Continuation: Bullish Pennant ────────────────────────────────

function detectBullishPennant(bars: BarData[]): DetectedPattern[] {
  const results: DetectedPattern[] = [];
  if (bars.length < 25) return results;

  for (const poleLen of [15, 20, 25]) {
    const pennantLen = Math.min(12, Math.floor(poleLen / 2));
    if (bars.length < poleLen + pennantLen) continue;
    const pole = bars.slice(-poleLen - pennantLen, -pennantLen);
    const pennant = bars.slice(-pennantLen);
    const poleMove = (pole[pole.length - 1].close! - pole[0].close!) / pole[0].close!;
    if (poleMove < 0.05) continue;

    const pHigh1 = pennant[0].high!, pHigh2 = pennant[pennant.length - 1].high!;
    const pLow1 = pennant[0].low!, pLow2 = pennant[pennant.length - 1].low!;
    const highsConverging = pHigh2 <= pHigh1;
    const lowsConverging = pLow2 >= pLow1;
    if (!highsConverging || !lowsConverging) continue;

    const offset = bars.length - poleLen - pennantLen;
    const lastIdx = bars.length - 1;
    const target = pHigh1 + (pole[pole.length - 1].close! - pole[0].close!);

    results.push({
      name: "Bullish Pennant",
      category: "continuation",
      bias: "bullish",
      confidence: 76,
      startIndex: offset,
      endIndex: lastIdx,
      startDate: bars[offset].time,
      endDate: bars[lastIdx].time,
      keyLevels: {
        resistance: pHigh1,
        support: pLow1,
        target,
        stopLoss: pLow2 * 0.98,
      },
      drawLines: [
        // Flagpole path
        {
          type: "path",
          color: "#2563eb",
          width: 3,
          path: [
            { time: bars[offset].time, price: pole[0].close! },
            { time: bars[offset + poleLen - 1].time, price: pole[pole.length - 1].close! },
            { time: bars[lastIdx].time, price: bars[lastIdx].close! },
          ],
          title: "Pole & Breakout",
        },
        // Converging upper trendline
        {
          type: "segment",
          color: "#d97706",
          width: 2,
          p1: { time: bars[offset + poleLen].time, price: pHigh1 },
          p2: { time: bars[lastIdx].time, price: pHigh2 },
          title: "Pennant Resistance",
        },
        // Converging lower trendline
        {
          type: "segment",
          color: "#16a34a",
          width: 2,
          p1: { time: bars[offset + poleLen].time, price: pLow1 },
          p2: { time: bars[lastIdx].time, price: pLow2 },
          title: "Pennant Support",
        },
      ],
      description: "Up-move followed by symmetrical converging consolidation. Bullish continuation — expect breakout upward.",
    });
    break;
  }
  return results;
}

// ─── 7. Bullish Continuation: Bullish Rectangle ──────────────────────────────

function detectBullishRectangle(bars: BarData[]): DetectedPattern[] {
  const results: DetectedPattern[] = [];
  if (bars.length < 35) return results;

  const window = bars.slice(-60);
  const offset = bars.length - 60;
  const highs = window.map((x) => x.high!);
  const lows = window.map((x) => x.low!);
  const maxH = Math.max(...highs);
  const minL = Math.min(...lows);
  const range = maxH - minL;

  const inBox = window.filter((x) => x.high! <= maxH * 1.015 && x.low! >= minL * 0.985);
  if (inBox.length < window.length * 0.7) return results;

  const trendBars = bars.slice(-90, -60);
  if (trendBars.length < 10) return results;
  const priorClose = trendBars[trendBars.length - 1].close!;
  const priorOpen = trendBars[0].close!;
  if (priorClose < priorOpen * 1.02) return results; // Must have prior uptrend

  const lastIdx = bars.length - 1;

  results.push({
    name: "Bullish Rectangle",
    category: "continuation",
    bias: "bullish",
    confidence: 72,
    startIndex: offset,
    endIndex: lastIdx,
    startDate: bars[offset].time,
    endDate: bars[lastIdx].time,
    keyLevels: {
      resistance: maxH,
      support: minL,
      target: maxH + range,
      stopLoss: minL * 0.98,
    },
    drawLines: [
      {
        type: "segment",
        color: "#d97706",
        width: 2,
        p1: { time: bars[offset].time, price: maxH },
        p2: { time: bars[lastIdx].time, price: maxH },
        title: "Rectangle Ceiling",
      },
      {
        type: "segment",
        color: "#16a34a",
        width: 2,
        p1: { time: bars[offset].time, price: minL },
        p2: { time: bars[lastIdx].time, price: minL },
        title: "Rectangle Floor",
      },
      {
        type: "path",
        color: "#2563eb",
        width: 3,
        path: [
          { time: bars[bars.length - 10].time, price: minL },
          { time: bars[lastIdx].time, price: bars[lastIdx].close! },
        ],
        title: "Breakout",
      },
    ],
    description: "Price consolidates in a horizontal range after an uptrend. Expect breakout above resistance continuing the uptrend.",
  });

  return results;
}

// ─── 8. Bullish Continuation: Cup & Handle ───────────────────────────────────

function detectCupAndHandle(bars: BarData[]): DetectedPattern | null {
  if (bars.length < 60) return null;

  const cupWindow = bars.slice(-90, -15);
  if (cupWindow.length < 20) return null;

  const cupLeft = cupWindow[0].close!;
  const cupRight = cupWindow[cupWindow.length - 1].close!;
  if (pct(cupLeft, cupRight) > 0.05) return null; // rim levels similar
  const cupBottom = Math.min(...cupWindow.map((x) => x.low!));
  const cupDepth = (cupLeft - cupBottom) / cupLeft;
  if (cupDepth < 0.08 || cupDepth > 0.5) return null;

  const handle = bars.slice(-15);
  const handleHigh = Math.max(...handle.map((x) => x.high!));
  const handleLow = Math.min(...handle.map((x) => x.low!));
  if (handleHigh > cupRight * 1.02) return null;
  if ((handleHigh - handleLow) / handleHigh > 0.1) return null;

  const offset = Math.max(0, bars.length - 90);
  const cupBottomIdx = offset + cupWindow.findIndex((x) => x.low === cupBottom);
  const lastIdx = bars.length - 1;
  const target = cupRight + (cupRight - cupBottom);

  return {
    name: "Cup & Handle",
    category: "continuation",
    bias: "bullish",
    confidence: 80,
    startIndex: offset,
    endIndex: lastIdx,
    startDate: bars[offset].time,
    endDate: bars[lastIdx].time,
    keyLevels: {
      resistance: cupRight,
      support: cupBottom,
      target,
      stopLoss: handleLow * 0.98,
    },
    drawLines: [
      // Cup U-shape path + Handle pullback + Breakout
      {
        type: "path",
        color: "#2563eb",
        width: 3,
        path: [
          { time: bars[offset].time, price: cupLeft },
          { time: bars[cupBottomIdx].time, price: cupBottom },
          { time: bars[bars.length - 16].time, price: cupRight },
          { time: bars[bars.length - 8].time, price: handleLow },
          { time: bars[lastIdx].time, price: bars[lastIdx].close! },
        ],
        title: "Cup & Handle Path",
      },
      // Horizontal Cup Rim Resistance
      {
        type: "segment",
        color: "#d97706",
        width: 2,
        dashed: true,
        p1: { time: bars[offset].time, price: cupRight },
        p2: { time: bars[lastIdx].time, price: cupRight },
        title: "Cup Rim",
      },
      // Bottom support
      {
        type: "segment",
        color: "#16a34a",
        width: 1,
        dashed: true,
        p1: { time: bars[cupBottomIdx].time, price: cupBottom },
        p2: { time: bars[lastIdx].time, price: cupBottom },
        title: "Cup Floor",
      },
    ],
    description: "U-shaped cup followed by a brief pullback handle. Bullish continuation — buy the handle breakout above the cup rim.",
  };
}

// ─── 9. Bullish Breakout: Ascending Triangle ─────────────────────────────────

function detectAscendingTriangle(bars: BarData[]): DetectedPattern[] {
  const results: DetectedPattern[] = [];
  const ph = pivotHighs(bars, 3);
  const pl = pivotLows(bars, 3);
  if (ph.length < 2 || pl.length < 2) return results;

  const [hi2, hi1] = [ph[ph.length - 1], ph[ph.length - 2]];
  const [lo2, lo1] = [pl[pl.length - 1], pl[pl.length - 2]];
  const [hH2, hH1] = [b(bars, hi2).high!, b(bars, hi1).high!];
  const [lL2, lL1] = [b(bars, lo2).low!, b(bars, lo1).low!];

  const startI = Math.min(hi1, lo1);
  if (bars.length - startI < 10 || bars.length - startI > 90) return results;

  const highsFlat = pct(hH1, hH2) < 0.025;
  const lowsRising = lL2 > lL1 * 1.02;

  // Ascending Triangle: flat highs, rising lows
  if (highsFlat && lowsRising) {
    const resistance = avg(hH1, hH2);
    const lastIdx = bars.length - 1;
    const target = resistance + (resistance - lL1);

    results.push({
      name: "Ascending Triangle",
      category: "neutral",
      bias: "bullish",
      confidence: 78,
      startIndex: startI,
      endIndex: lastIdx,
      startDate: bars[startI].time,
      endDate: bars[lastIdx].time,
      keyLevels: {
        resistance,
        support: lL2,
        target,
        stopLoss: lL2 * 0.98,
      },
      drawLines: [
        // Flat horizontal resistance ceiling
        {
          type: "segment",
          color: "#d97706",
          width: 2,
          p1: { time: bars[startI].time, price: resistance },
          p2: { time: bars[lastIdx].time, price: resistance },
          title: "Resistance Ceiling",
        },
        // Ascending upward-sloping support trendline
        {
          type: "segment",
          color: "#16a34a",
          width: 2,
          p1: { time: bars[lo1].time, price: lL1 },
          p2: { time: bars[lastIdx].time, price: lL2 },
          title: "Rising Support",
        },
        // Breakout path
        {
          type: "path",
          color: "#2563eb",
          width: 3,
          path: [
            { time: bars[lo2].time, price: lL2 },
            { time: bars[lastIdx].time, price: bars[lastIdx].close! },
          ],
          title: "Breakout",
        },
      ],
      description: "Flat resistance with rising support. Bullish bias — expect breakout above resistance.",
    });
  }

  return results;
}

// ─── Main detector (STRICTLY BUY-SIDE ONLY) ──────────────────────────────────

export function detectAllPatterns(bars: BarData[]): DetectedPattern[] {
  if (bars.length < 20) return [];

  const valid = bars.filter(
    (x) => x.high != null && x.low != null && x.close != null && x.open != null
  );
  if (valid.length < 20) return [];

  const all: DetectedPattern[] = [];
  const push = (p: DetectedPattern | null) => {
    if (p && p.bias === "bullish") all.push(p);
  };

  // Reversal (Bullish)
  push(detectDoubleBottom(valid));
  push(detectTripleBottom(valid));
  push(detectInverseHeadAndShoulders(valid));
  all.push(...detectFallingWedge(valid));

  // Continuation (Bullish)
  all.push(...detectBullishFlag(valid));
  all.push(...detectBullishPennant(valid));
  all.push(...detectBullishRectangle(valid));
  push(detectCupAndHandle(valid));

  // Breakout (Bullish)
  all.push(...detectAscendingTriangle(valid));

  // Sort by confidence desc, deduplicate by name
  const seen = new Set<string>();
  return all
    .sort((a, b) => b.confidence - a.confidence)
    .filter((p) => {
      if (seen.has(p.name)) return false;
      seen.add(p.name);
      return true;
    });
}

// ─── BUY-SIDE PATTERNS CATALOGUE (Strictly Bullish Setups) ───────────────────

export const ALL_PATTERNS_CATALOGUE = [
  // BULLISH REVERSALS
  {
    name: "Double Bottom",
    category: "reversal" as PatternCategory,
    bias: "bullish" as PatternBias,
    description:
      "Two troughs at similar lows forming a 'W'. Strong bullish reversal confirmed when price breaks above the central peak (neckline).",
  },
  {
    name: "Triple Bottom",
    category: "reversal" as PatternCategory,
    bias: "bullish" as PatternBias,
    description:
      "Three troughs at similar lows. Strong bullish reversal — three support tests all held before breakout above neckline.",
  },
  {
    name: "Inverse H&S",
    category: "reversal" as PatternCategory,
    bias: "bullish" as PatternBias,
    description:
      "Three troughs where the middle is deepest. Strong bullish reversal — buy on neckline breakout with volume expansion.",
  },
  {
    name: "Falling Wedge",
    category: "reversal" as PatternCategory,
    bias: "bullish" as PatternBias,
    description:
      "Price moves downward with converging highs and lows. Bullish reversal — expect explosive breakout above upper falling trendline.",
  },

  // BULLISH CONTINUATIONS
  {
    name: "Bullish Flag",
    category: "continuation" as PatternCategory,
    bias: "bullish" as PatternBias,
    description:
      "Vertical pole up followed by a tight parallel channel pullback. Strong bullish continuation — pole height projects as upward target.",
  },
  {
    name: "Bullish Pennant",
    category: "continuation" as PatternCategory,
    bias: "bullish" as PatternBias,
    description:
      "Sharp up-move (pole) followed by small symmetrical triangle consolidation. Bullish continuation — buy the upward breakout.",
  },
  {
    name: "Bullish Rectangle",
    category: "continuation" as PatternCategory,
    bias: "bullish" as PatternBias,
    description:
      "Price consolidates in a horizontal range after an uptrend. Expect breakout above resistance continuing the uptrend.",
  },
  {
    name: "Cup & Handle",
    category: "continuation" as PatternCategory,
    bias: "bullish" as PatternBias,
    description:
      "U-shaped cup followed by a brief pullback handle. High-probability bullish continuation — buy handle breakout above the cup rim.",
  },

  // BULLISH BREAKOUT
  {
    name: "Ascending Triangle",
    category: "neutral" as PatternCategory,
    bias: "bullish" as PatternBias,
    description:
      "Flat horizontal resistance ceiling with ascending higher lows. Strong bullish bias — buyers aggressively stepping in earlier each pullback.",
  },
];
