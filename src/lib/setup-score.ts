/**
 * Setup Score Engine
 * ------------------
 * Har coin ko 0-100 score deta hai taake trader ko "best se best" setup mile.
 *
 * Weights (total 100):
 *   SMC / ICT confluence ............ 30
 *   HTF trend alignment ............. 25
 *   Volume + volatility expansion ... 20
 *   Futures positioning ............. 15  (data na ho to neutral half)
 *   Trade quality (R:R, location) ... 10
 */

import { Candle, ScanCondition, ScoreFactor, SetupDirection, SetupGrade, SetupScore, TradePlan } from '@/types/scanner';
import {
  calculateADX,
  calculateATR,
  calculateEMA,
  calculateRSI,
  calculateSupertrend,
} from '@/lib/indicators';
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
  detectDowntrend,
  detectLiquiditySweepHigh,
  detectLiquiditySweepLow,
  detectPremiumZone,
  detectUptrend,
} from '@/lib/smc';

export interface FuturesContext {
  fundingRate?: number;      // e.g. 0.0001 = 0.01%
  openInterestChange?: number; // % change over last ~24h
  longShortRatio?: number;   // top trader accounts long/short ratio
}

export interface ScoreInput {
  candles: Candle[];          // primary timeframe (needs 100+)
  htfCandles?: Candle[];      // higher timeframe context
  futures?: FuturesContext;
  livePrice?: number;
  playbook?: string;
  /** Strategy/playbook ki forced direction. Diya jaye to score isi side ka banega. */
  bias?: SetupDirection;
}

/** Bearish/bullish feature keywords se strategy ki direction guess karta hai. */
export function inferDirectionBias(conditions: ScanCondition[]): SetupDirection | undefined {
  const enabled = conditions.filter(c => c.enabled);
  let bull = 0;
  let bear = 0;

  for (const c of enabled) {
    const f = String(c.feature).toLowerCase();
    const w = c.group === 'must' ? 2 : 1;
    const bearish =
      f.includes('bearish') || f.includes('short') || f.includes('downtrend') ||
      f.includes('premium') || f.includes('upthrust') || f.includes('sweep_high') ||
      f.includes('shooting_star') || f.includes('_m_') || f.endsWith('_m');
    const bullish =
      f.includes('bullish') || f.includes('long') || f.includes('uptrend') ||
      f.includes('discount') || f.includes('spring') || f.includes('sweep_low') ||
      f.includes('hammer');

    if (bearish && !bullish) bear += w;
    else if (bullish && !bearish) bull += w;

    // RSI range se bhi hint: low band = long, high band = short
    if (f === 'rsi' && c.mode === 'range' && typeof c.maxValue === 'number') {
      if (c.maxValue <= 50) bull += 1;
      if (typeof c.minValue === 'number' && c.minValue >= 55) bear += 1;
    }
    if (c.mode === 'cross' && c.pricePosition === 'below') bear += 1;
    if (c.mode === 'cross' && c.pricePosition === 'above') bull += 1;
  }

  if (bull === 0 && bear === 0) return undefined;
  if (bull === bear) return undefined;
  return bull > bear ? 'long' : 'short';
}


const last = <T>(a: T[]): T | undefined => a[a.length - 1];

function gradeFor(score: number): SetupGrade {
  if (score >= 85) return 'A+';
  if (score >= 74) return 'A';
  if (score >= 60) return 'B';
  if (score >= 45) return 'C';
  return 'D';
}

function swingLow(candles: Candle[], lookback: number): number {
  const w = candles.slice(-lookback);
  return Math.min(...w.map(c => c.low));
}

function swingHigh(candles: Candle[], lookback: number): number {
  const w = candles.slice(-lookback);
  return Math.max(...w.map(c => c.high));
}

/** Direction decide karta hai: structure + trend + momentum ka vote. */
export function resolveDirection(candles: Candle[], htfCandles?: Candle[]): SetupDirection {
  let bull = 0;
  let bear = 0;

  const ema20 = last(calculateEMA(candles, 20)) ?? 0;
  const ema50 = last(calculateEMA(candles, 50)) ?? 0;
  const price = last(candles)!.close;

  if (price > ema20) bull++; else bear++;
  if (ema20 > ema50) bull++; else bear++;

  const st = calculateSupertrend(candles, 10, 3);
  const dir = last(st.direction) ?? 0;
  if (dir === 1) bull += 2;
  if (dir === -1) bear += 2;

  if (detectUptrend(candles)) bull += 2;
  if (detectDowntrend(candles)) bear += 2;
  if (detectBullishChoCH(candles) || detectBullishBOS(candles)) bull++;
  if (detectBearishChoCH(candles) || detectBearishBOS(candles)) bear++;
  if (detectBullishSpring(candles).detected) bull += 2;
  if (detectBearishUpthrust(candles).detected) bear += 2;

  if (htfCandles && htfCandles.length > 60) {
    const h20 = last(calculateEMA(htfCandles, 20)) ?? 0;
    const h50 = last(calculateEMA(htfCandles, 50)) ?? 0;
    if (h20 > h50) bull++; else bear++;
  }

  return bull >= bear ? 'long' : 'short';
}

function smcFactor(candles: Candle[], direction: SetupDirection, tags: string[]): ScoreFactor {
  const weight = 30;
  let points = 0;
  const hits: string[] = [];

  const add = (p: number, label: string) => { points += p; hits.push(label); tags.push(label); };

  if (direction === 'long') {
    if (detectBullishSpring(candles).detected) add(9, 'Spring reclaim');
    else if (detectLiquiditySweepLow(candles)) add(6, 'Sell-side sweep');
    if (detectBullishChoCH(candles)) add(7, 'Bullish CHoCH');
    else if (detectBullishBOS(candles)) add(5, 'Bullish BOS');
    if (detectBullishOrderBlock(candles)) add(6, 'Bullish OB');
    if (detectBullishFVG(candles)) add(4, 'Bullish FVG');
    if (detectDiscountZone(candles)) add(4, 'Discount zone');
  } else {
    if (detectBearishUpthrust(candles).detected) add(9, 'Upthrust rejection');
    else if (detectLiquiditySweepHigh(candles)) add(6, 'Buy-side sweep');
    if (detectBearishChoCH(candles)) add(7, 'Bearish CHoCH');
    else if (detectBearishBOS(candles)) add(5, 'Bearish BOS');
    if (detectBearishOrderBlock(candles)) add(6, 'Bearish OB');
    if (detectBearishFVG(candles)) add(4, 'Bearish FVG');
    if (detectPremiumZone(candles)) add(4, 'Premium zone');
  }

  points = Math.min(points, weight);
  return {
    key: 'smc',
    label: 'SMC / ICT confluence',
    weight,
    points,
    note: hits.length ? hits.join(', ') : 'Koi liquidity/structure confluence nahi mila',
  };
}

function htfFactor(candles: Candle[], htfCandles: Candle[] | undefined, direction: SetupDirection): ScoreFactor {
  const weight = 25;
  if (!htfCandles || htfCandles.length < 60) {
    return { key: 'htf', label: 'HTF trend alignment', weight, points: 10, note: 'HTF data unavailable — neutral' };
  }

  const price = last(htfCandles)!.close;
  const ema20 = last(calculateEMA(htfCandles, 20)) ?? 0;
  const ema50 = last(calculateEMA(htfCandles, 50)) ?? 0;
  const ema200 = htfCandles.length >= 200 ? (last(calculateEMA(htfCandles, 200)) ?? 0) : 0;
  const adx = last(calculateADX(htfCandles, 14)) ?? 0;

  const bullish = direction === 'long';
  let points = 0;
  const notes: string[] = [];

  if (bullish ? price > ema20 : price < ema20) { points += 6; notes.push('HTF price EMA20 ke sahi side'); }
  if (bullish ? ema20 > ema50 : ema20 < ema50) { points += 7; notes.push('HTF EMA20/50 aligned'); }
  if (ema200 && (bullish ? price > ema200 : price < ema200)) { points += 5; notes.push('HTF macro trend aligned'); }
  if (bullish ? detectUptrend(htfCandles) : detectDowntrend(htfCandles)) { points += 4; notes.push('HTF HH/HL structure'); }
  if (adx >= 20) { points += 3; notes.push(`HTF ADX ${adx.toFixed(0)} (trend strength)`); }

  return {
    key: 'htf',
    label: 'HTF trend alignment',
    weight,
    points: Math.min(points, weight),
    note: notes.length ? notes.join(', ') : 'HTF trend setup ke khilaf hai',
  };
}

function volumeFactor(candles: Candle[], direction: SetupDirection): ScoreFactor {
  const weight = 20;
  let points = 0;
  const notes: string[] = [];

  const vols = candles.map(c => c.volume);
  const recent = vols.slice(-3);
  const avg20 = vols.slice(-23, -3).reduce((a, b) => a + b, 0) / 20;
  const volRatio = avg20 > 0 ? Math.max(...recent) / avg20 : 1;

  if (volRatio >= 3) { points += 9; notes.push(`Volume ${volRatio.toFixed(1)}x spike`); }
  else if (volRatio >= 2) { points += 7; notes.push(`Volume ${volRatio.toFixed(1)}x average`); }
  else if (volRatio >= 1.3) { points += 4; notes.push(`Volume ${volRatio.toFixed(1)}x average`); }
  else notes.push(`Volume flat (${volRatio.toFixed(1)}x)`);

  // Volatility expansion: current ATR vs 50-candle ATR baseline
  const atrArr = calculateATR(candles, 14);
  const atrNow = last(atrArr) ?? 0;
  const atrPast = atrArr[atrArr.length - 30] ?? atrNow;
  const expansion = atrPast > 0 ? atrNow / atrPast : 1;
  if (expansion >= 1.3) { points += 6; notes.push('Volatility expansion'); }
  else if (expansion >= 1.05) { points += 4; notes.push('Volatility building'); }
  else { points += 1; notes.push('Volatility compressed'); }

  // Directional participation: last 3 candles ka body direction
  const bodies = candles.slice(-3).map(c => c.close - c.open);
  const netBody = bodies.reduce((a, b) => a + b, 0);
  if (direction === 'long' ? netBody > 0 : netBody < 0) { points += 5; notes.push('Recent candles direction ke sath'); }

  return { key: 'volume', label: 'Volume + volatility', weight, points: Math.min(points, weight), note: notes.join(', ') };
}

function futuresFactor(futures: FuturesContext | undefined, direction: SetupDirection): ScoreFactor {
  const weight = 15;
  if (!futures || (futures.fundingRate === undefined && futures.longShortRatio === undefined && futures.openInterestChange === undefined)) {
    return { key: 'futures', label: 'Futures positioning', weight, points: 7, note: 'Futures data unavailable — neutral' };
  }

  let points = 0;
  const notes: string[] = [];
  const long = direction === 'long';

  if (futures.fundingRate !== undefined) {
    const fr = futures.fundingRate * 100; // %
    // Contrarian: long setups ko negative funding pasand hai (shorts trapped)
    if (long ? fr < -0.01 : fr > 0.03) { points += 6; notes.push(`Funding ${fr.toFixed(3)}% — crowd opposite side`); }
    else if (Math.abs(fr) < 0.015) { points += 3; notes.push(`Funding neutral (${fr.toFixed(3)}%)`); }
    else { points += 1; notes.push(`Funding ${fr.toFixed(3)}% — crowd already same side`); }
  }

  if (futures.openInterestChange !== undefined) {
    const oi = futures.openInterestChange;
    if (oi > 5) { points += 5; notes.push(`OI +${oi.toFixed(1)}% — naya positioning`); }
    else if (oi < -5) { points += 3; notes.push(`OI ${oi.toFixed(1)}% — positions flush hui`); }
    else { points += 2; notes.push('OI stable'); }
  }

  if (futures.longShortRatio !== undefined) {
    const ls = futures.longShortRatio;
    if (long ? ls < 0.9 : ls > 1.6) { points += 4; notes.push(`L/S ${ls.toFixed(2)} — squeeze fuel`); }
    else { points += 1; notes.push(`L/S ${ls.toFixed(2)}`); }
  }

  return { key: 'futures', label: 'Futures positioning', weight, points: Math.min(points, weight), note: notes.join(', ') };
}

function qualityFactor(plan: TradePlan, candles: Candle[], direction: SetupDirection): ScoreFactor {
  const weight = 10;
  let points = 0;
  const notes: string[] = [];

  if (plan.riskReward >= 3) { points += 6; notes.push(`R:R ${plan.riskReward.toFixed(1)} (excellent)`); }
  else if (plan.riskReward >= 2) { points += 4; notes.push(`R:R ${plan.riskReward.toFixed(1)} (good)`); }
  else { points += 1; notes.push(`R:R ${plan.riskReward.toFixed(1)} (tight)`); }

  const rsi = last(calculateRSI(candles, 14)) ?? 50;
  const healthy = direction === 'long' ? rsi > 35 && rsi < 68 : rsi < 65 && rsi > 32;
  if (healthy) { points += 2; notes.push(`RSI ${rsi.toFixed(0)} healthy`); }
  else notes.push(`RSI ${rsi.toFixed(0)} extended`);

  if (plan.riskPercent <= 3) { points += 2; notes.push(`Stop tight (${plan.riskPercent.toFixed(1)}%)`); }

  return { key: 'quality', label: 'Trade quality', weight, points: Math.min(points, weight), note: notes.join(', ') };
}

/** ATR + structure based trade plan. */
export function buildTradePlan(candles: Candle[], direction: SetupDirection, livePrice?: number): TradePlan {
  const price = livePrice ?? last(candles)!.close;
  const atr = last(calculateATR(candles, 14)) || price * 0.01;

  let stopLoss: number;
  if (direction === 'long') {
    const sl = Math.min(swingLow(candles, 12), price - 1.2 * atr);
    stopLoss = Math.min(sl, price - 0.4 * atr);
  } else {
    const sl = Math.max(swingHigh(candles, 12), price + 1.2 * atr);
    stopLoss = Math.max(sl, price + 0.4 * atr);
  }

  const risk = Math.abs(price - stopLoss) || price * 0.01;
  const sign = direction === 'long' ? 1 : -1;

  const structureTarget = direction === 'long' ? swingHigh(candles, 60) : swingLow(candles, 60);
  const tp1 = price + sign * risk * 1.5;
  const tp2 = price + sign * risk * 2.5;
  let tp3 = price + sign * risk * 4;
  // Agar structure target aage hai to TP3 usko use kare
  if (direction === 'long' && structureTarget > tp3) tp3 = structureTarget;
  if (direction === 'short' && structureTarget < tp3) tp3 = structureTarget;

  return {
    direction,
    entry: price,
    stopLoss,
    tp1,
    tp2,
    tp3,
    riskPercent: (risk / price) * 100,
    riskReward: Math.abs(tp2 - price) / risk,
    invalidation:
      direction === 'long'
        ? `Candle close ${stopLoss.toPrecision(6)} ke neeche = setup invalid`
        : `Candle close ${stopLoss.toPrecision(6)} ke upar = setup invalid`,
  };
}

export function computeSetupScore(input: ScoreInput): SetupScore | null {
  const { candles, htfCandles, futures, livePrice, playbook } = input;
  if (!candles || candles.length < 60) return null;

  const direction = resolveDirection(candles, htfCandles);
  const tags: string[] = [];

  const plan = buildTradePlan(candles, direction, livePrice);

  const factors: ScoreFactor[] = [
    smcFactor(candles, direction, tags),
    htfFactor(candles, htfCandles, direction),
    volumeFactor(candles, direction),
    futuresFactor(futures, direction),
    qualityFactor(plan, candles, direction),
  ];

  const score = Math.round(factors.reduce((sum, f) => sum + f.points, 0));

  return {
    score: Math.max(0, Math.min(100, score)),
    grade: gradeFor(score),
    direction,
    factors,
    plan,
    tags: tags.slice(0, 6),
    playbook,
  };
}

/** Primary timeframe se ek sensible higher timeframe nikaalta hai. */
export function higherTimeframeFor(tf: string): string {
  const m = /^(\d+)(m|h|d|w|M)$/.exec(tf);
  if (!m) return '4h';
  const n = parseInt(m[1], 10);
  const unit = m[2];
  const minutes = unit === 'm' ? n : unit === 'h' ? n * 60 : unit === 'd' ? n * 1440 : unit === 'w' ? n * 10080 : n * 43200;
  if (minutes <= 5) return '1h';
  if (minutes <= 30) return '4h';
  if (minutes <= 120) return '12h';
  if (minutes <= 480) return '1d';
  if (minutes <= 1440) return '1w';
  return '1M';
}
