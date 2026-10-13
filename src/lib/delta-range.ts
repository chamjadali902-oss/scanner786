/**
 * Range Delta Accumulation / Distribution (pre-breakout)
 * Price ek tight range me phasi hai, lekin har candle ka taker delta
 * (buy - sell) lagataar ek taraf barh raha hai -> breakout se pehle signal.
 */
import type { Candle } from '@/types/scanner';

export interface DeltaRangeOptions {
  lookback: number;        // range candles (default 30)
  maxWidthPct: number;     // max range width % (default 8)
  minDominance: number;    // % candles with delta in signal direction (default 55)
  minCvdR2: number;        // CVD trend consistency 0-1 (default 0.5)
}

export interface DeltaRangeResult {
  detected: boolean;
  side: 'accumulation' | 'distribution' | null;
  rangeHigh: number;
  rangeLow: number;
  widthPct: number;
  cvdChange: number;       // net delta in range (base units)
  cvdChangeRatio: number;  // net delta / avg candle volume
  dominancePct: number;    // % candles positive (accum) or negative (distrib)
  cvdR2: number;
  priceDriftPct: number;   // close move over range
  positionPct: number;     // where price sits in range, 0 = low, 100 = high
  score: number;
}

const EMPTY: DeltaRangeResult = {
  detected: false, side: null, rangeHigh: 0, rangeLow: 0, widthPct: 0, cvdChange: 0,
  cvdChangeRatio: 0, dominancePct: 0, cvdR2: 0, priceDriftPct: 0, positionPct: 0, score: 0,
};

function regression(y: number[]) {
  const n = y.length;
  const mx = (n - 1) / 2;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (i - mx) * (y[i] - my);
    sxx += (i - mx) ** 2;
    syy += (y[i] - my) ** 2;
  }
  const slope = sxx ? sxy / sxx : 0;
  const r2 = sxx && syy ? (sxy * sxy) / (sxx * syy) : 0;
  return { slope, r2 };
}

export function detectDeltaRange(
  candles: Candle[],
  side: 'accumulation' | 'distribution',
  opts: Partial<DeltaRangeOptions> = {},
): DeltaRangeResult {
  const o: DeltaRangeOptions = { lookback: 30, maxWidthPct: 8, minDominance: 55, minCvdR2: 0.5, ...opts };
  if (candles.length < o.lookback + 1) return EMPTY;
  const win = candles.slice(-o.lookback);
  if (win.some(c => c.takerBuyVolume === undefined)) return EMPTY;

  // Range = window excluding the live candle, so a live break is visible
  const body = win.slice(0, -1);
  const rangeHigh = Math.max(...body.map(c => c.high));
  const rangeLow = Math.min(...body.map(c => c.low));
  const last = win[win.length - 1];
  const widthPct = ((rangeHigh - rangeLow) / rangeLow) * 100;

  const deltas = win.map(c => 2 * (c.takerBuyVolume as number) - c.volume);
  const cvd: number[] = [];
  let run = 0;
  for (const d of deltas) { run += d; cvd.push(run); }
  const { slope, r2 } = regression(cvd);
  const avgVol = win.reduce((s, c) => s + c.volume, 0) / win.length || 1;
  const cvdChange = cvd[cvd.length - 1];
  const cvdChangeRatio = cvdChange / avgVol;
  const accum = side === 'accumulation';
  const dominant = deltas.filter(d => (accum ? d > 0 : d < 0)).length;
  const dominancePct = (dominant / deltas.length) * 100;
  const priceDriftPct = ((last.close - win[0].close) / win[0].close) * 100;
  const positionPct = rangeHigh > rangeLow ? ((last.close - rangeLow) / (rangeHigh - rangeLow)) * 100 : 50;

  const inside = last.close <= rangeHigh && last.close >= rangeLow;
  const dirOk = accum ? slope > 0 && cvdChangeRatio > 1 : slope < 0 && cvdChangeRatio < -1;
  // Price should not be trending with the delta (that's a normal move, not absorption)
  const flatPrice = Math.abs(priceDriftPct) <= widthPct * 0.6;

  const detected = inside && widthPct <= o.maxWidthPct && dirOk && dominancePct >= o.minDominance && r2 >= o.minCvdR2 && flatPrice;

  let score = 0;
  if (detected) {
    score = 40;
    score += Math.min(20, (r2 - o.minCvdR2) * 40);
    score += Math.min(15, (dominancePct - o.minDominance) * 0.6);
    score += Math.min(15, Math.abs(cvdChangeRatio) * 1.5);
    score += Math.min(10, (1 - widthPct / o.maxWidthPct) * 10);
    score = Math.round(Math.max(0, Math.min(100, score)));
  }

  return {
    detected, side: detected ? side : null, rangeHigh, rangeLow, widthPct, cvdChange, cvdChangeRatio,
    dominancePct, cvdR2: r2, priceDriftPct, positionPct, score,
  };
}
