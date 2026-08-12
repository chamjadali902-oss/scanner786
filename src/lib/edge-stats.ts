/**
 * Edge Stats — Rolling Backtest & Statistical Calibration
 * ------------------------------------------------------
 * Idea: score sirf "opinion" na ho. Isi coin ki apni recent history me jab jab
 * yahi setup signature bana, forward result kya raha — win rate, expectancy (R),
 * MFE/MAE — wahi score ko calibrate karta hai.
 *
 * Signal signature = direction-matched SMC/liquidity confluence count >= minConfluence.
 * Forward test = ATR-based stop (buildTradePlan logic) + 2R target, max N bars.
 */

import { Candle, SetupDirection } from '@/types/scanner';
import { calculateATR } from '@/lib/indicators';
import {
  detectBearishChoCH,
  detectBearishFVG,
  detectBearishOrderBlock,
  detectBearishUpthrust,
  detectBullishChoCH,
  detectBullishFVG,
  detectBullishOrderBlock,
  detectBullishSpring,
  detectBearishBOS,
  detectBullishBOS,
  detectDiscountZone,
  detectLiquiditySweepHigh,
  detectLiquiditySweepLow,
  detectPremiumZone,
} from '@/lib/smc';

export interface EdgeTrade {
  index: number;
  time: number;
  entry: number;
  stop: number;
  target: number;
  outcome: 'win' | 'loss' | 'open';
  rMultiple: number;
  mfeR: number;
  maeR: number;
  bars: number;
}

export interface EdgeStats {
  sample: number;
  winRate: number;          // %
  expectancyR: number;      // average R per trade
  profitFactor: number;
  avgMfeR: number;
  avgMaeR: number;
  avgBars: number;
  bestR: number;
  worstR: number;
  /** Wilson lower bound (95%) — small sample ko honest rakhta hai. */
  winRateLow: number;
  /** 0-100 calibrated confidence (sample size + expectancy adjusted). */
  confidence: number;
  reliability: 'high' | 'medium' | 'low' | 'insufficient';
  verdict: string;
  trades: EdgeTrade[];
  confluenceUsed: number;
}

export interface EdgeStatsOptions {
  minConfluence?: number;  // default 2
  rTarget?: number;        // default 2R
  maxBars?: number;        // default 40
  warmup?: number;         // default 60
}

function confluenceCount(slice: Candle[], direction: SetupDirection): number {
  let n = 0;
  if (direction === 'long') {
    if (detectBullishSpring(slice).detected) n += 2;
    else if (detectLiquiditySweepLow(slice)) n += 1;
    if (detectBullishChoCH(slice)) n += 2;
    else if (detectBullishBOS(slice)) n += 1;
    if (detectBullishOrderBlock(slice)) n += 1;
    if (detectBullishFVG(slice)) n += 1;
    if (detectDiscountZone(slice)) n += 1;
  } else {
    if (detectBearishUpthrust(slice).detected) n += 2;
    else if (detectLiquiditySweepHigh(slice)) n += 1;
    if (detectBearishChoCH(slice)) n += 2;
    else if (detectBearishBOS(slice)) n += 1;
    if (detectBearishOrderBlock(slice)) n += 1;
    if (detectBearishFVG(slice)) n += 1;
    if (detectPremiumZone(slice)) n += 1;
  }
  return n;
}

function wilsonLower(wins: number, n: number): number {
  if (n === 0) return 0;
  const z = 1.96;
  const p = wins / n;
  const denom = 1 + (z * z) / n;
  const centre = p + (z * z) / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n);
  return Math.max(0, ((centre - margin) / denom) * 100);
}

/** Ek hi direction ke liye poora rolling backtest. Sirf closed history use hoti hai. */
export function computeEdgeStats(
  candles: Candle[],
  direction: SetupDirection,
  options: EdgeStatsOptions = {}
): EdgeStats {
  const minConfluence = options.minConfluence ?? 2;
  const rTarget = options.rTarget ?? 2;
  const maxBars = options.maxBars ?? 40;
  const warmup = options.warmup ?? 60;

  const atrArr = calculateATR(candles, 14);
  const trades: EdgeTrade[] = [];
  let cooldownUntil = -1;

  for (let i = warmup; i < candles.length - 5; i++) {
    if (i < cooldownUntil) continue;
    const slice = candles.slice(0, i + 1);
    if (confluenceCount(slice, direction) < minConfluence) continue;

    const entry = candles[i].close;
    const atr = atrArr[i] || entry * 0.01;
    const lookback = slice.slice(-12);
    const swingLow = Math.min(...lookback.map(c => c.low));
    const swingHigh = Math.max(...lookback.map(c => c.high));

    const stop =
      direction === 'long'
        ? Math.min(Math.min(swingLow, entry - 1.2 * atr), entry - 0.4 * atr)
        : Math.max(Math.max(swingHigh, entry + 1.2 * atr), entry + 0.4 * atr);

    const risk = Math.abs(entry - stop);
    if (risk <= 0) continue;
    const sign = direction === 'long' ? 1 : -1;
    const target = entry + sign * risk * rTarget;

    let outcome: EdgeTrade['outcome'] = 'open';
    let rMultiple = 0;
    let mfeR = 0;
    let maeR = 0;
    let bars = 0;

    for (let j = i + 1; j < Math.min(candles.length, i + 1 + maxBars); j++) {
      bars = j - i;
      const c = candles[j];
      const fav = direction === 'long' ? (c.high - entry) / risk : (entry - c.low) / risk;
      const adv = direction === 'long' ? (entry - c.low) / risk : (c.high - entry) / risk;
      mfeR = Math.max(mfeR, fav);
      maeR = Math.max(maeR, adv);

      const hitStop = direction === 'long' ? c.low <= stop : c.high >= stop;
      const hitTarget = direction === 'long' ? c.high >= target : c.low <= target;

      // Conservative: agar ek hi candle me dono touch huay to stop pehle maana jaye
      if (hitStop) { outcome = 'loss'; rMultiple = -1; break; }
      if (hitTarget) { outcome = 'win'; rMultiple = rTarget; break; }
    }

    if (outcome === 'open') {
      const lastClose = candles[Math.min(candles.length - 1, i + maxBars)].close;
      rMultiple = ((direction === 'long' ? lastClose - entry : entry - lastClose) / risk);
      // Unresolved trades ko bhi count karo lekin outcome open hi rahe
    }

    trades.push({
      index: i,
      time: candles[i].closeTime,
      entry,
      stop,
      target,
      outcome,
      rMultiple,
      mfeR,
      maeR,
      bars,
    });

    cooldownUntil = i + Math.max(3, bars);
  }

  const resolved = trades.filter(t => t.outcome !== 'open');
  const sample = resolved.length;
  const wins = resolved.filter(t => t.outcome === 'win').length;
  const winRate = sample ? (wins / sample) * 100 : 0;
  const rs = resolved.map(t => t.rMultiple);
  const expectancyR = sample ? rs.reduce((s, r) => s + r, 0) / sample : 0;
  const grossWin = rs.filter(r => r > 0).reduce((s, r) => s + r, 0);
  const grossLoss = Math.abs(rs.filter(r => r <= 0).reduce((s, r) => s + r, 0));
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? 99 : 0;
  const avg = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);

  const winRateLow = wilsonLower(wins, sample);
  const reliability: EdgeStats['reliability'] =
    sample < 5 ? 'insufficient' : sample < 12 ? 'low' : sample < 25 ? 'medium' : 'high';

  // Confidence = Wilson lower bound + expectancy bonus, sample-size ke hisaab se damp
  const sampleFactor = Math.min(1, sample / 20);
  const expectancyBonus = Math.max(-15, Math.min(15, expectancyR * 20));
  const confidence = Math.round(
    Math.max(0, Math.min(100, (winRateLow + expectancyBonus) * sampleFactor + (1 - sampleFactor) * 45))
  );

  let verdict: string;
  if (sample < 5) verdict = 'Sample bohot chhota — is coin par ye setup historically test nahi hua, size chhoti rakhein.';
  else if (expectancyR >= 0.4 && winRateLow >= 40) verdict = `Statistically strong: ${sample} occurrences me expectancy +${expectancyR.toFixed(2)}R.`;
  else if (expectancyR > 0) verdict = `Mild positive edge: ${sample} occurrences, expectancy +${expectancyR.toFixed(2)}R — selective rahein.`;
  else verdict = `Historically negative: ${sample} occurrences me expectancy ${expectancyR.toFixed(2)}R — ye setup is coin par kaam nahi kar raha.`;

  return {
    sample,
    winRate,
    expectancyR,
    profitFactor,
    avgMfeR: avg(resolved.map(t => t.mfeR)),
    avgMaeR: avg(resolved.map(t => t.maeR)),
    avgBars: avg(resolved.map(t => t.bars)),
    bestR: rs.length ? Math.max(...rs) : 0,
    worstR: rs.length ? Math.min(...rs) : 0,
    winRateLow,
    confidence,
    reliability,
    verdict,
    trades: trades.slice(-40),
    confluenceUsed: minConfluence,
  };
}

/** Raw setup score ko historical stats + flow ke sath blend karta hai. */
export function calibrateScore(rawScore: number, stats: EdgeStats, flowAdjust = 0): number {
  const weight = stats.reliability === 'high' ? 0.45 : stats.reliability === 'medium' ? 0.3 : stats.reliability === 'low' ? 0.15 : 0;
  const blended = rawScore * (1 - weight) + stats.confidence * weight;
  return Math.max(0, Math.min(100, Math.round(blended + flowAdjust)));
}
