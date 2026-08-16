/**
 * Breakout Quality Engine — Fake (trap) vs Real (validated) breakouts.
 *
 * Har breakout ko range level ke against measure karta hai:
 *  - Level: lookback window ka highest high / lowest low (breakout window ko chhod kar).
 *  - Event: last `maxAge` candles me level ka break (wick ya close se).
 *  - Classification:
 *      FAKE  → break hua par price wapas range me close ho gaya / volume weak /
 *              lamba rejection wick / follow-through fail. Reverse trade ka signal.
 *      REAL  → strong body close beyond level + volume expansion + follow-through hold
 *              (ya abhi live ho raha hai strong body + volume ke sath).
 */

import { Candle } from '@/types/scanner';

export interface BreakoutOptions {
  lookback?: number;            // range banane ke liye candles (default 60)
  maxAge?: number;              // breakout event kitni candles purana ho sakta (default 6)
  volumeMultiplier?: number;    // real breakout ke liye volume vs avg (default 1.5)
  tolerancePct?: number;        // level ke around noise tolerance % (default 0.05)
  minBodyRatio?: number;        // real breakout candle body/range (default 0.5)
  requireRetestHold?: boolean;  // real ke liye follow-through hold zaroori (default true)
  confirmCandles?: number;      // fake confirm karne ke liye kitni candles dekhein (default 3)
}

export type BreakoutSide = 'up' | 'down';
export type BreakoutKind = 'fake' | 'real' | 'none';

export interface BreakoutResult {
  detected: boolean;
  kind: BreakoutKind;
  side: BreakoutSide;
  level: number;               // toota hua range level
  breakoutIndex: number;
  candlesSince: number;
  inProgress: boolean;         // abhi live break ho raha hai (last candle)
  score: number;               // 0-100 confidence
  volumeRatio: number;         // breakout candle volume / avg volume
  wickRatio: number;           // rejection wick / candle range
  closedBackInside: boolean;   // price range ke andar wapas close hua
  maxExtensionPct: number;     // level se maximum extension %
  entry: number;
  stopLoss: number;
  target: number;
  notes: string[];
}

const empty = (side: BreakoutSide): BreakoutResult => ({
  detected: false, kind: 'none', side, level: 0, breakoutIndex: -1, candlesSince: 0,
  inProgress: false, score: 0, volumeRatio: 0, wickRatio: 0, closedBackInside: false,
  maxExtensionPct: 0, entry: 0, stopLoss: 0, target: 0, notes: [],
});

function avg(nums: number[]) {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

interface Core {
  side: BreakoutSide;
  level: number;
  rangeOpposite: number;
  idx: number;
  candlesSince: number;
  inProgress: boolean;
  volumeRatio: number;
  wickRatio: number;
  bodyRatio: number;
  closedBeyond: boolean;
  closedBackInside: boolean;
  maxExtensionPct: number;
  followThroughHold: boolean;
  retestFailed: boolean;
}

/** Range level nikaal kar last N candles me break event dhoondta hai. */
function findBreakout(candles: Candle[], side: BreakoutSide, o: BreakoutOptions): Core | null {
  const lookback = o.lookback ?? 60;
  const maxAge = o.maxAge ?? 6;
  const tol = (o.tolerancePct ?? 0.05) / 100;
  const confirm = o.confirmCandles ?? 3;

  const last = candles.length - 1;
  if (candles.length < Math.max(30, maxAge + 15)) return null;

  const rangeStart = Math.max(0, last - maxAge - lookback);
  const rangeEnd = last - maxAge; // level sirf breakout se pehle ke data se
  if (rangeEnd - rangeStart < 10) return null;

  const window = candles.slice(rangeStart, rangeEnd + 1);
  const level = side === 'up'
    ? Math.max(...window.map(c => c.high))
    : Math.min(...window.map(c => c.low));
  const rangeOpposite = side === 'up'
    ? Math.min(...window.map(c => c.low))
    : Math.max(...window.map(c => c.high));
  if (!isFinite(level) || level <= 0) return null;

  const threshold = side === 'up' ? level * (1 + tol) : level * (1 - tol);

  // pehla break event (oldest → newest within maxAge)
  let idx = -1;
  for (let i = last - maxAge + 1; i <= last; i++) {
    if (i < 1) continue;
    const c = candles[i];
    const broke = side === 'up' ? c.high > threshold : c.low < threshold;
    if (broke) { idx = i; break; }
  }
  if (idx < 0) return null;

  const bc = candles[idx];
  const range = Math.max(bc.high - bc.low, 1e-12);
  const body = Math.abs(bc.close - bc.open);
  const bodyRatio = body / range;
  const wickRatio = side === 'up' ? (bc.high - Math.max(bc.close, bc.open)) / range
                                  : (Math.min(bc.close, bc.open) - bc.low) / range;

  const volWindow = candles.slice(Math.max(0, idx - 20), idx).map(c => c.volume);
  const avgVol = avg(volWindow);
  const volumeRatio = avgVol > 0 ? bc.volume / avgVol : 1;

  const after = candles.slice(idx, last + 1);
  const closedBeyond = side === 'up' ? bc.close > level : bc.close < level;
  const lastClose = candles[last].close;
  const closedBackInside = side === 'up' ? lastClose < level : lastClose > level;

  const extreme = side === 'up' ? Math.max(...after.map(c => c.high)) : Math.min(...after.map(c => c.low));
  const maxExtensionPct = Math.abs((extreme - level) / level) * 100;

  // follow-through: break ke baad candles level ke beyond band rahi?
  const ft = after.slice(1, confirm + 1);
  const followThroughHold = ft.length === 0
    ? closedBeyond
    : ft.every(c => (side === 'up' ? c.close > level * (1 - tol) : c.close < level * (1 + tol)));

  // retest fail: beyond gaya, wapas level cross kar ke andar close hua
  const retestFailed = after.some(c => (side === 'up' ? c.close < level * (1 - tol) : c.close > level * (1 + tol)));

  return {
    side, level, rangeOpposite, idx, candlesSince: last - idx,
    inProgress: idx === last,
    volumeRatio, wickRatio, bodyRatio, closedBeyond, closedBackInside,
    maxExtensionPct, followThroughHold, retestFailed,
  };
}

/**
 * FAKE breakout / trap.
 * side='up'  → upside fake (bull trap) → reverse = SHORT
 * side='down'→ downside fake (bear trap) → reverse = LONG
 */
export function detectFakeBreakout(candles: Candle[], side: BreakoutSide, o: BreakoutOptions = {}): BreakoutResult {
  const core = findBreakout(candles, side, o);
  if (!core) return empty(side);

  const volMult = o.volumeMultiplier ?? 1.5;
  const notes: string[] = [];
  let score = 0;

  // 1) Range me wapas close (sabse strong fake proof)
  if (core.closedBackInside || core.retestFailed) {
    score += 35;
    notes.push(core.closedBackInside
      ? `Price level ${core.level.toPrecision(6)} ke ${side === 'up' ? 'neeche' : 'upar'} wapas close — trap confirm`
      : 'Break ke baad range me wapas reclaim — failed breakout');
  } else if (!core.closedBeyond) {
    score += 25;
    notes.push('Sirf wick ne level toda, body close beyond nahi hui');
  }

  // 2) Volume weak = participation nahi
  if (core.volumeRatio < 1) {
    score += 20;
    notes.push(`Breakout volume weak (${core.volumeRatio.toFixed(2)}x avg) — koi real demand nahi`);
  } else if (core.volumeRatio < volMult) {
    score += 10;
    notes.push(`Volume expansion missing (${core.volumeRatio.toFixed(2)}x avg)`);
  } else {
    notes.push(`Volume ${core.volumeRatio.toFixed(2)}x — sweep par aggressive fills (liquidity grab)`);
    score += 6;
  }

  // 3) Rejection wick
  if (core.wickRatio > 0.5) { score += 20; notes.push(`Rejection wick ${(core.wickRatio * 100).toFixed(0)}% of candle`); }
  else if (core.wickRatio > 0.3) { score += 12; notes.push(`Decent rejection wick ${(core.wickRatio * 100).toFixed(0)}%`); }

  // 4) Follow-through fail
  if (!core.followThroughHold) { score += 15; notes.push('Follow-through candles level hold nahi kar payi'); }

  // 5) Extension shallow = momentum nahi
  if (core.maxExtensionPct < 0.6) { score += 10; notes.push(`Extension sirf ${core.maxExtensionPct.toFixed(2)}% — momentum absent`); }

  if (core.inProgress) notes.push('Breakout abhi live ho raha hai — trap risk high, confirmation candle dekhein');

  score = Math.max(0, Math.min(100, score));
  const detected = score >= 45 && (core.closedBackInside || core.retestFailed || !core.closedBeyond || core.wickRatio > 0.45);

  // Reverse trade plan
  const px = candles[candles.length - 1].close;
  const extreme = side === 'up'
    ? Math.max(...candles.slice(core.idx).map(c => c.high))
    : Math.min(...candles.slice(core.idx).map(c => c.low));
  const entry = px;
  const stopLoss = side === 'up' ? extreme * 1.001 : extreme * 0.999;
  const target = side === 'up'
    ? Math.max(core.rangeOpposite, px - (stopLoss - px) * 2)
    : Math.min(core.rangeOpposite, px + (px - stopLoss) * 2);

  return {
    detected, kind: detected ? 'fake' : 'none', side, level: core.level,
    breakoutIndex: core.idx, candlesSince: core.candlesSince, inProgress: core.inProgress,
    score, volumeRatio: core.volumeRatio, wickRatio: core.wickRatio,
    closedBackInside: core.closedBackInside, maxExtensionPct: core.maxExtensionPct,
    entry, stopLoss, target, notes,
  };
}

/**
 * REAL (validated) breakout.
 * side='up' → LONG continuation, side='down' → SHORT continuation.
 */
export function detectRealBreakout(candles: Candle[], side: BreakoutSide, o: BreakoutOptions = {}): BreakoutResult {
  const core = findBreakout(candles, side, o);
  if (!core) return empty(side);

  const volMult = o.volumeMultiplier ?? 1.5;
  const minBody = o.minBodyRatio ?? 0.5;
  const requireHold = o.requireRetestHold ?? true;
  const notes: string[] = [];
  let score = 0;

  if (core.closedBeyond) { score += 25; notes.push(`Body close level ${core.level.toPrecision(6)} ke ${side === 'up' ? 'upar' : 'neeche'} — structural break`); }
  if (core.bodyRatio >= minBody) { score += 15; notes.push(`Strong body (${(core.bodyRatio * 100).toFixed(0)}% of range)`); }
  if (core.volumeRatio >= volMult) { score += 25; notes.push(`Volume expansion ${core.volumeRatio.toFixed(2)}x avg — real participation`); }
  else if (core.volumeRatio >= 1.1) { score += 12; notes.push(`Volume ${core.volumeRatio.toFixed(2)}x avg`); }
  if (core.followThroughHold) { score += 20; notes.push('Follow-through candles ne level ko support/resistance bana kar hold kiya'); }
  if (!core.closedBackInside && !core.retestFailed) { score += 10; notes.push('Ab tak koi failure reclaim nahi — breakout intact'); }
  if (core.wickRatio < 0.3) { score += 5; notes.push('Rejection wick minimal'); }
  if (core.maxExtensionPct >= 1) { score += 5; notes.push(`Extension ${core.maxExtensionPct.toFixed(2)}% — momentum active`); }

  if (core.inProgress) notes.push('Breakout abhi live hai — close confirm hone par validity badhegi');

  score = Math.max(0, Math.min(100, score));
  const detected =
    score >= 55 &&
    core.closedBeyond &&
    !core.closedBackInside &&
    core.volumeRatio >= Math.min(1.1, volMult) &&
    (!requireHold || core.followThroughHold);

  const px = candles[candles.length - 1].close;
  const entry = px;
  const stopLoss = side === 'up' ? core.level * 0.997 : core.level * 1.003;
  const risk = Math.abs(entry - stopLoss);
  const target = side === 'up' ? entry + risk * 2 : entry - risk * 2;

  return {
    detected, kind: detected ? 'real' : 'none', side, level: core.level,
    breakoutIndex: core.idx, candlesSince: core.candlesSince, inProgress: core.inProgress,
    score, volumeRatio: core.volumeRatio, wickRatio: core.wickRatio,
    closedBackInside: core.closedBackInside, maxExtensionPct: core.maxExtensionPct,
    entry, stopLoss, target, notes,
  };
}
