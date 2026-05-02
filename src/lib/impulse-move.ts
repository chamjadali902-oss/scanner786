import { Candle } from '@/types/scanner';

/**
 * Impulsive Move (Untested) Detector
 *
 * Bullish setup:
 *   - Find a recent RED (bearish) candle
 *   - It is followed by N or more GREEN (bullish) candles
 *   - The combined bullish run breaks ABOVE the red candle's high (impulse)
 *   - After the impulse, price has NOT yet retested (touched/closed back into) the red candle's high
 *
 * Bearish setup (mirror):
 *   - Find a recent GREEN candle
 *   - Followed by N or more RED candles
 *   - Combined bearish run breaks BELOW green candle's low
 *   - Price has NOT retested green candle's low yet
 */

export interface ImpulseMoveResult {
  detected: boolean;
  direction: 'bullish' | 'bearish' | 'none';
  baseCandleIndex: number;     // index of the origin red/green candle
  impulseEndIndex: number;     // index of the last impulse candle
  baseHigh: number;            // for bullish: red candle high (untested level)
  baseLow: number;             // for bearish: green candle low (untested level)
  impulseCandles: number;      // count of consecutive bull/bear candles after base
  candlesSinceImpulse: number; // how many candles ago impulse ended
}

const EMPTY: ImpulseMoveResult = {
  detected: false, direction: 'none',
  baseCandleIndex: -1, impulseEndIndex: -1,
  baseHigh: 0, baseLow: 0, impulseCandles: 0, candlesSinceImpulse: 0,
};

interface Options {
  minImpulseCandles?: number; // min consecutive bull/bear candles after base (default 2)
  lookback?: number;          // how many candles back to scan for setup (default 30)
  retestTolerancePct?: number;// if price came within X% of base level, count as retested (default 0)
  maxAgeCandles?: number;     // impulse must have ended within last N candles (default 10)
  requireBreak?: boolean;     // require impulse close to break base high/low (default true)
}

const isBull = (c: Candle) => c.close > c.open;
const isBear = (c: Candle) => c.close < c.open;

export function detectBullishImpulse(candles: Candle[], opts: Options = {}): ImpulseMoveResult {
  const minImp = Math.max(1, opts.minImpulseCandles ?? 2);
  const lookback = Math.max(minImp + 2, opts.lookback ?? 30);
  const tolPct = Math.max(0, opts.retestTolerancePct ?? 0);
  const maxAge = Math.max(0, opts.maxAgeCandles ?? 10);
  const requireBreak = opts.requireBreak ?? true;

  if (candles.length < minImp + 2) return EMPTY;

  const last = candles.length - 1;
  const start = Math.max(1, last - lookback);

  // Iterate from most recent backward to find the most recent valid setup
  for (let i = last - minImp; i >= start; i--) {
    const base = candles[i];
    if (!isBear(base)) continue;

    // count consecutive bullish candles after base
    let count = 0;
    let j = i + 1;
    while (j <= last && isBull(candles[j])) {
      count++;
      j++;
    }
    if (count < minImp) continue;

    const impulseEnd = i + count; // last bullish candle index

    // require impulse to break base high
    const impulseMaxClose = Math.max(...candles.slice(i + 1, impulseEnd + 1).map(c => c.close));
    if (requireBreak && impulseMaxClose <= base.high) continue;

    // age check
    const candlesSince = last - impulseEnd;
    if (candlesSince > maxAge) continue;

    // retest check: after impulseEnd, has any candle low touched/dipped below base.high (with tolerance)?
    const tolPrice = base.high * (1 - tolPct / 100);
    let retested = false;
    for (let k = impulseEnd + 1; k <= last; k++) {
      if (candles[k].low <= tolPrice) { retested = true; break; }
    }
    if (retested) continue;

    return {
      detected: true,
      direction: 'bullish',
      baseCandleIndex: i,
      impulseEndIndex: impulseEnd,
      baseHigh: base.high,
      baseLow: base.low,
      impulseCandles: count,
      candlesSinceImpulse: candlesSince,
    };
  }

  return EMPTY;
}

export function detectBearishImpulse(candles: Candle[], opts: Options = {}): ImpulseMoveResult {
  const minImp = Math.max(1, opts.minImpulseCandles ?? 2);
  const lookback = Math.max(minImp + 2, opts.lookback ?? 30);
  const tolPct = Math.max(0, opts.retestTolerancePct ?? 0);
  const maxAge = Math.max(0, opts.maxAgeCandles ?? 10);
  const requireBreak = opts.requireBreak ?? true;

  if (candles.length < minImp + 2) return EMPTY;

  const last = candles.length - 1;
  const start = Math.max(1, last - lookback);

  for (let i = last - minImp; i >= start; i--) {
    const base = candles[i];
    if (!isBull(base)) continue;

    let count = 0;
    let j = i + 1;
    while (j <= last && isBear(candles[j])) {
      count++;
      j++;
    }
    if (count < minImp) continue;

    const impulseEnd = i + count;

    const impulseMinClose = Math.min(...candles.slice(i + 1, impulseEnd + 1).map(c => c.close));
    if (requireBreak && impulseMinClose >= base.low) continue;

    const candlesSince = last - impulseEnd;
    if (candlesSince > maxAge) continue;

    // retest: any candle high reached back up to base.low (with tolerance)?
    const tolPrice = base.low * (1 + tolPct / 100);
    let retested = false;
    for (let k = impulseEnd + 1; k <= last; k++) {
      if (candles[k].high >= tolPrice) { retested = true; break; }
    }
    if (retested) continue;

    return {
      detected: true,
      direction: 'bearish',
      baseCandleIndex: i,
      impulseEndIndex: impulseEnd,
      baseHigh: base.high,
      baseLow: base.low,
      impulseCandles: count,
      candlesSinceImpulse: candlesSince,
    };
  }

  return EMPTY;
}
