import { Candle } from '@/types/scanner';

// =====================================================
// CHART PATTERNS LIBRARY
// W/Double Bottom, M/Double Top, H&S, Inverse H&S,
// Triangles (Asc/Desc/Sym), Triple Top/Bottom, Wedges, Flags
//
// Every detector returns:
//   - detected: boolean
//   - swingHigh / swingLow: key levels of the pattern (for Fib linking)
//   - formedAtIndex: index of the candle where the pattern completed
//   - direction: 'bullish' | 'bearish'
// =====================================================

export interface ChartPatternResult {
  detected: boolean;
  swingHigh: number;
  swingLow: number;
  formedAtIndex: number;
  direction: 'bullish' | 'bearish' | 'neutral';
  details?: Record<string, number>;
}

interface SwingPoint {
  index: number;
  price: number;
  type: 'high' | 'low';
}

function findSwingPoints(candles: Candle[], lookback: number = 3): SwingPoint[] {
  const swings: SwingPoint[] = [];
  for (let i = lookback; i < candles.length - lookback; i++) {
    const ch = candles[i].high;
    const cl = candles[i].low;
    let isHigh = true;
    let isLow = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue;
      if (candles[j].high >= ch) isHigh = false;
      if (candles[j].low <= cl) isLow = false;
    }
    if (isHigh) swings.push({ index: i, price: ch, type: 'high' });
    if (isLow) swings.push({ index: i, price: cl, type: 'low' });
  }
  return swings.sort((a, b) => a.index - b.index);
}

function emptyResult(direction: 'bullish' | 'bearish' | 'neutral' = 'neutral'): ChartPatternResult {
  return { detected: false, swingHigh: 0, swingLow: 0, formedAtIndex: -1, direction };
}

const TOLERANCE = 0.02; // 2% price tolerance for "equal" levels

function nearlyEqual(a: number, b: number, tol = TOLERANCE): boolean {
  if (a === 0 && b === 0) return true;
  return Math.abs(a - b) / ((Math.abs(a) + Math.abs(b)) / 2) <= tol;
}

// ---------- W / Double Bottom ----------
export function detectDoubleBottom(candles: Candle[], lookback: number = 80): ChartPatternResult {
  if (candles.length < 20) return emptyResult('bullish');
  const slice = candles.slice(-lookback);
  const offset = candles.length - slice.length;
  const swings = findSwingPoints(slice, 3);
  const lows = swings.filter(s => s.type === 'low');
  const highs = swings.filter(s => s.type === 'high');

  if (lows.length < 2 || highs.length < 1) return emptyResult('bullish');

  // Take last two lows
  const low2 = lows[lows.length - 1];
  const low1 = lows[lows.length - 2];
  if (low2.index - low1.index < 5) return emptyResult('bullish');

  // Highs between the two lows form the neckline
  const between = highs.filter(h => h.index > low1.index && h.index < low2.index);
  if (between.length === 0) return emptyResult('bullish');
  const neckline = Math.max(...between.map(h => h.price));

  // Bottoms must be roughly equal
  if (!nearlyEqual(low1.price, low2.price, 0.03)) return emptyResult('bullish');

  // Confirmation: latest close breaks above neckline
  const lastClose = slice[slice.length - 1].close;
  const detected = lastClose > neckline;

  return {
    detected,
    swingLow: Math.min(low1.price, low2.price),
    swingHigh: neckline,
    formedAtIndex: offset + low2.index,
    direction: 'bullish',
    details: { neckline, low1: low1.price, low2: low2.price },
  };
}

// ---------- M / Double Top ----------
export function detectDoubleTop(candles: Candle[], lookback: number = 80): ChartPatternResult {
  if (candles.length < 20) return emptyResult('bearish');
  const slice = candles.slice(-lookback);
  const offset = candles.length - slice.length;
  const swings = findSwingPoints(slice, 3);
  const highs = swings.filter(s => s.type === 'high');
  const lows = swings.filter(s => s.type === 'low');

  if (highs.length < 2 || lows.length < 1) return emptyResult('bearish');

  const high2 = highs[highs.length - 1];
  const high1 = highs[highs.length - 2];
  if (high2.index - high1.index < 5) return emptyResult('bearish');

  const between = lows.filter(l => l.index > high1.index && l.index < high2.index);
  if (between.length === 0) return emptyResult('bearish');
  const neckline = Math.min(...between.map(l => l.price));

  if (!nearlyEqual(high1.price, high2.price, 0.03)) return emptyResult('bearish');

  const lastClose = slice[slice.length - 1].close;
  const detected = lastClose < neckline;

  return {
    detected,
    swingHigh: Math.max(high1.price, high2.price),
    swingLow: neckline,
    formedAtIndex: offset + high2.index,
    direction: 'bearish',
    details: { neckline, high1: high1.price, high2: high2.price },
  };
}

// ---------- Triple Bottom ----------
export function detectTripleBottom(candles: Candle[], lookback: number = 100): ChartPatternResult {
  if (candles.length < 30) return emptyResult('bullish');
  const slice = candles.slice(-lookback);
  const offset = candles.length - slice.length;
  const swings = findSwingPoints(slice, 3);
  const lows = swings.filter(s => s.type === 'low');
  const highs = swings.filter(s => s.type === 'high');

  if (lows.length < 3 || highs.length < 2) return emptyResult('bullish');

  const last3 = lows.slice(-3);
  if (!nearlyEqual(last3[0].price, last3[1].price, 0.03)) return emptyResult('bullish');
  if (!nearlyEqual(last3[1].price, last3[2].price, 0.03)) return emptyResult('bullish');

  const between = highs.filter(h => h.index > last3[0].index && h.index < last3[2].index);
  if (between.length < 2) return emptyResult('bullish');
  const neckline = Math.max(...between.map(h => h.price));

  const lastClose = slice[slice.length - 1].close;
  const detected = lastClose > neckline;

  return {
    detected,
    swingLow: Math.min(...last3.map(l => l.price)),
    swingHigh: neckline,
    formedAtIndex: offset + last3[2].index,
    direction: 'bullish',
    details: { neckline },
  };
}

// ---------- Triple Top ----------
export function detectTripleTop(candles: Candle[], lookback: number = 100): ChartPatternResult {
  if (candles.length < 30) return emptyResult('bearish');
  const slice = candles.slice(-lookback);
  const offset = candles.length - slice.length;
  const swings = findSwingPoints(slice, 3);
  const highs = swings.filter(s => s.type === 'high');
  const lows = swings.filter(s => s.type === 'low');

  if (highs.length < 3 || lows.length < 2) return emptyResult('bearish');

  const last3 = highs.slice(-3);
  if (!nearlyEqual(last3[0].price, last3[1].price, 0.03)) return emptyResult('bearish');
  if (!nearlyEqual(last3[1].price, last3[2].price, 0.03)) return emptyResult('bearish');

  const between = lows.filter(l => l.index > last3[0].index && l.index < last3[2].index);
  if (between.length < 2) return emptyResult('bearish');
  const neckline = Math.min(...between.map(l => l.price));

  const lastClose = slice[slice.length - 1].close;
  const detected = lastClose < neckline;

  return {
    detected,
    swingHigh: Math.max(...last3.map(h => h.price)),
    swingLow: neckline,
    formedAtIndex: offset + last3[2].index,
    direction: 'bearish',
    details: { neckline },
  };
}

// ---------- Head & Shoulders (Bearish) ----------
export function detectHeadAndShoulders(candles: Candle[], lookback: number = 100): ChartPatternResult {
  if (candles.length < 30) return emptyResult('bearish');
  const slice = candles.slice(-lookback);
  const offset = candles.length - slice.length;
  const swings = findSwingPoints(slice, 3);
  const highs = swings.filter(s => s.type === 'high');
  const lows = swings.filter(s => s.type === 'low');

  if (highs.length < 3 || lows.length < 2) return emptyResult('bearish');

  // Take last 3 highs as left shoulder, head, right shoulder
  const [LS, H, RS] = highs.slice(-3);
  if (H.price <= LS.price || H.price <= RS.price) return emptyResult('bearish');
  if (!nearlyEqual(LS.price, RS.price, 0.05)) return emptyResult('bearish');

  // Neckline: lows between LS-H and H-RS
  const lowsLeft = lows.filter(l => l.index > LS.index && l.index < H.index);
  const lowsRight = lows.filter(l => l.index > H.index && l.index < RS.index);
  if (lowsLeft.length === 0 || lowsRight.length === 0) return emptyResult('bearish');
  const neckline = (Math.min(...lowsLeft.map(l => l.price)) + Math.min(...lowsRight.map(l => l.price))) / 2;

  const lastClose = slice[slice.length - 1].close;
  const detected = lastClose < neckline;

  return {
    detected,
    swingHigh: H.price,
    swingLow: neckline,
    formedAtIndex: offset + RS.index,
    direction: 'bearish',
    details: { neckline, head: H.price, leftShoulder: LS.price, rightShoulder: RS.price },
  };
}

// ---------- Inverse Head & Shoulders (Bullish) ----------
export function detectInverseHeadAndShoulders(candles: Candle[], lookback: number = 100): ChartPatternResult {
  if (candles.length < 30) return emptyResult('bullish');
  const slice = candles.slice(-lookback);
  const offset = candles.length - slice.length;
  const swings = findSwingPoints(slice, 3);
  const lows = swings.filter(s => s.type === 'low');
  const highs = swings.filter(s => s.type === 'high');

  if (lows.length < 3 || highs.length < 2) return emptyResult('bullish');

  const [LS, H, RS] = lows.slice(-3);
  if (H.price >= LS.price || H.price >= RS.price) return emptyResult('bullish');
  if (!nearlyEqual(LS.price, RS.price, 0.05)) return emptyResult('bullish');

  const highsLeft = highs.filter(h => h.index > LS.index && h.index < H.index);
  const highsRight = highs.filter(h => h.index > H.index && h.index < RS.index);
  if (highsLeft.length === 0 || highsRight.length === 0) return emptyResult('bullish');
  const neckline = (Math.max(...highsLeft.map(h => h.price)) + Math.max(...highsRight.map(h => h.price))) / 2;

  const lastClose = slice[slice.length - 1].close;
  const detected = lastClose > neckline;

  return {
    detected,
    swingLow: H.price,
    swingHigh: neckline,
    formedAtIndex: offset + RS.index,
    direction: 'bullish',
    details: { neckline, head: H.price, leftShoulder: LS.price, rightShoulder: RS.price },
  };
}

// ---------- Triangles ----------
function linearTrendSlope(points: SwingPoint[]): number {
  if (points.length < 2) return 0;
  const n = points.length;
  const sumX = points.reduce((s, p) => s + p.index, 0);
  const sumY = points.reduce((s, p) => s + p.price, 0);
  const sumXY = points.reduce((s, p) => s + p.index * p.price, 0);
  const sumX2 = points.reduce((s, p) => s + p.index * p.index, 0);
  const denom = n * sumX2 - sumX * sumX;
  return denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
}

interface TriangleData {
  highSlope: number;
  lowSlope: number;
  swingHigh: number;
  swingLow: number;
  lastIndex: number;
  highs: SwingPoint[];
  lows: SwingPoint[];
}

function getTriangleData(candles: Candle[], lookback: number): TriangleData | null {
  if (candles.length < 20) return null;
  const slice = candles.slice(-lookback);
  const swings = findSwingPoints(slice, 3);
  const highs = swings.filter(s => s.type === 'high').slice(-4);
  const lows = swings.filter(s => s.type === 'low').slice(-4);
  if (highs.length < 2 || lows.length < 2) return null;

  // Normalize slope by avg price for relative comparison
  const avgPrice = slice.reduce((s, c) => s + c.close, 0) / slice.length;
  const highSlopeRaw = linearTrendSlope(highs);
  const lowSlopeRaw = linearTrendSlope(lows);
  const highSlope = highSlopeRaw / avgPrice;
  const lowSlope = lowSlopeRaw / avgPrice;

  return {
    highSlope,
    lowSlope,
    swingHigh: Math.max(...highs.map(h => h.price)),
    swingLow: Math.min(...lows.map(l => l.price)),
    lastIndex: candles.length - 1,
    highs,
    lows,
  };
}

const FLAT = 0.0005; // ~0.05% per candle => essentially flat
const SLOPING = 0.001;

export function detectAscendingTriangle(candles: Candle[], lookback: number = 60): ChartPatternResult {
  const t = getTriangleData(candles, lookback);
  if (!t) return emptyResult('bullish');
  // Highs flat, lows rising
  if (Math.abs(t.highSlope) > FLAT || t.lowSlope < SLOPING) return emptyResult('bullish');
  const lastClose = candles[candles.length - 1].close;
  const detected = lastClose > t.swingHigh; // breakout
  return {
    detected,
    swingHigh: t.swingHigh,
    swingLow: t.swingLow,
    formedAtIndex: t.lastIndex,
    direction: 'bullish',
    details: { highSlope: t.highSlope, lowSlope: t.lowSlope },
  };
}

export function detectDescendingTriangle(candles: Candle[], lookback: number = 60): ChartPatternResult {
  const t = getTriangleData(candles, lookback);
  if (!t) return emptyResult('bearish');
  // Lows flat, highs falling
  if (Math.abs(t.lowSlope) > FLAT || t.highSlope > -SLOPING) return emptyResult('bearish');
  const lastClose = candles[candles.length - 1].close;
  const detected = lastClose < t.swingLow;
  return {
    detected,
    swingHigh: t.swingHigh,
    swingLow: t.swingLow,
    formedAtIndex: t.lastIndex,
    direction: 'bearish',
    details: { highSlope: t.highSlope, lowSlope: t.lowSlope },
  };
}

export function detectSymmetricalTriangle(candles: Candle[], lookback: number = 60): ChartPatternResult {
  const t = getTriangleData(candles, lookback);
  if (!t) return emptyResult('neutral');
  // Highs falling, lows rising
  if (t.highSlope > -SLOPING || t.lowSlope < SLOPING) return emptyResult('neutral');
  const lastClose = candles[candles.length - 1].close;
  const detected = lastClose > t.swingHigh || lastClose < t.swingLow;
  const direction: 'bullish' | 'bearish' | 'neutral' =
    lastClose > t.swingHigh ? 'bullish' : lastClose < t.swingLow ? 'bearish' : 'neutral';
  return {
    detected,
    swingHigh: t.swingHigh,
    swingLow: t.swingLow,
    formedAtIndex: t.lastIndex,
    direction,
    details: { highSlope: t.highSlope, lowSlope: t.lowSlope },
  };
}

// ---------- Wedges ----------
export function detectRisingWedge(candles: Candle[], lookback: number = 60): ChartPatternResult {
  const t = getTriangleData(candles, lookback);
  if (!t) return emptyResult('bearish');
  // Both rising, but highs slope < lows slope (converging upward)
  if (t.highSlope < SLOPING || t.lowSlope < SLOPING) return emptyResult('bearish');
  if (t.lowSlope <= t.highSlope) return emptyResult('bearish');
  const lastClose = candles[candles.length - 1].close;
  const detected = lastClose < t.swingLow; // breakdown
  return {
    detected,
    swingHigh: t.swingHigh,
    swingLow: t.swingLow,
    formedAtIndex: t.lastIndex,
    direction: 'bearish',
  };
}

export function detectFallingWedge(candles: Candle[], lookback: number = 60): ChartPatternResult {
  const t = getTriangleData(candles, lookback);
  if (!t) return emptyResult('bullish');
  // Both falling, highs slope < lows slope (converging downward)
  if (t.highSlope > -SLOPING || t.lowSlope > -SLOPING) return emptyResult('bullish');
  if (t.highSlope >= t.lowSlope) return emptyResult('bullish');
  const lastClose = candles[candles.length - 1].close;
  const detected = lastClose > t.swingHigh; // breakout
  return {
    detected,
    swingHigh: t.swingHigh,
    swingLow: t.swingLow,
    formedAtIndex: t.lastIndex,
    direction: 'bullish',
  };
}

// ---------- Rectangle / Channel breakout ----------
export function detectRectangleBreakoutBullish(candles: Candle[], lookback: number = 60): ChartPatternResult {
  const t = getTriangleData(candles, lookback);
  if (!t) return emptyResult('bullish');
  if (Math.abs(t.highSlope) > FLAT || Math.abs(t.lowSlope) > FLAT) return emptyResult('bullish');
  const lastClose = candles[candles.length - 1].close;
  const detected = lastClose > t.swingHigh;
  return {
    detected,
    swingHigh: t.swingHigh,
    swingLow: t.swingLow,
    formedAtIndex: t.lastIndex,
    direction: 'bullish',
  };
}

export function detectRectangleBreakoutBearish(candles: Candle[], lookback: number = 60): ChartPatternResult {
  const t = getTriangleData(candles, lookback);
  if (!t) return emptyResult('bearish');
  if (Math.abs(t.highSlope) > FLAT || Math.abs(t.lowSlope) > FLAT) return emptyResult('bearish');
  const lastClose = candles[candles.length - 1].close;
  const detected = lastClose < t.swingLow;
  return {
    detected,
    swingHigh: t.swingHigh,
    swingLow: t.swingLow,
    formedAtIndex: t.lastIndex,
    direction: 'bearish',
  };
}

// ---------- Master registry ----------
export const CHART_PATTERN_DETECTORS: Record<string, (candles: Candle[], lookback?: number) => ChartPatternResult> = {
  cp_double_bottom: detectDoubleBottom,
  cp_double_top: detectDoubleTop,
  cp_triple_bottom: detectTripleBottom,
  cp_triple_top: detectTripleTop,
  cp_head_shoulders: detectHeadAndShoulders,
  cp_inverse_head_shoulders: detectInverseHeadAndShoulders,
  cp_ascending_triangle: detectAscendingTriangle,
  cp_descending_triangle: detectDescendingTriangle,
  cp_symmetrical_triangle: detectSymmetricalTriangle,
  cp_rising_wedge: detectRisingWedge,
  cp_falling_wedge: detectFallingWedge,
  cp_rectangle_breakout_bull: detectRectangleBreakoutBullish,
  cp_rectangle_breakout_bear: detectRectangleBreakoutBearish,
};

// Compute pattern result with lookback most recently — used to also link Fib
export function detectChartPattern(
  patternId: string,
  candles: Candle[],
  lookback?: number
): ChartPatternResult {
  const fn = CHART_PATTERN_DETECTORS[patternId];
  if (!fn) return emptyResult('neutral');
  return fn(candles, lookback);
}
