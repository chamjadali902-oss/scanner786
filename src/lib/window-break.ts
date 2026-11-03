// Window High/Low Break detector
// Finds coins whose price broke the high (bullish) or low (bearish) of a
// user-selected candle window (2-300 candles). The window is the N candles
// immediately BEFORE the breaking candle, so the breaking candle itself is
// never part of the level.

import { Candle } from '@/types/scanner';

export interface WindowBreakOptions {
  /** Size of the reference window in candles (2-300). Default 20 */
  window: number;
  /** Break may have happened within the last N candles. Default 5 */
  maxAge: number;
  /** Require the breaking candle to CLOSE beyond the level (not just wick). Default false */
  requireClose: boolean;
}

export interface WindowBreakResult {
  detected: boolean;
  side: 'high' | 'low';
  windowSize: number;
  windowHigh: number;
  windowLow: number;
  /** The exact level that was broken (window high or window low) */
  breakLevel: number;
  /** Index of the first candle that broke the level (-1 when not detected) */
  breakCandleIndex: number;
  candlesAgo: number;
  /** Current close beyond the level, in % of level (signed by side) */
  excursionPct: number;
  /** Largest excursion beyond the level since the break, in % */
  maxExcursionPct: number;
  /** Current close is still beyond the broken level */
  stillBeyond: boolean;
  /** Breaking candle closed beyond the level (wick break otherwise) */
  brokeByClose: boolean;
}

export function detectWindowBreak(
  candles: Candle[],
  side: 'high' | 'low',
  opts: Partial<WindowBreakOptions> = {}
): WindowBreakResult {
  const window = Math.max(2, Math.floor(opts.window ?? 20));
  const maxAge = Math.max(0, Math.floor(opts.maxAge ?? 5));
  const requireClose = opts.requireClose ?? false;

  const none: WindowBreakResult = {
    detected: false,
    side,
    windowSize: window,
    windowHigh: NaN,
    windowLow: NaN,
    breakLevel: NaN,
    breakCandleIndex: -1,
    candlesAgo: 0,
    excursionPct: 0,
    maxExcursionPct: 0,
    stillBeyond: false,
    brokeByClose: false,
  };

  const len = candles.length;
  if (len < window + 1) return none;

  // Candidate break start: newest candle first, up to maxAge candles back.
  for (let age = 0; age <= maxAge; age++) {
    const startIdx = len - 1 - age; // first candidate break candle
    const windowStart = startIdx - window;
    if (windowStart < 0) return none; // not enough history for this window

    const windowCandles = candles.slice(windowStart, startIdx);
    let windowHigh = -Infinity;
    let windowLow = Infinity;
    for (const c of windowCandles) {
      if (c.high > windowHigh) windowHigh = c.high;
      if (c.low < windowLow) windowLow = c.low;
    }
    const breakLevel = side === 'high' ? windowHigh : windowLow;

    // Scan from the candidate candle to now: the FIRST candle that breaks the level wins.
    for (let i = startIdx; i < len; i++) {
      const c = candles[i];
      const broke = side === 'high'
        ? (requireClose ? c.close > breakLevel : c.high > breakLevel)
        : (requireClose ? c.close < breakLevel : c.low < breakLevel);
      if (!broke) continue;

      // Confirmed at candle i. Compute excursion stats from i to the latest candle.
      let maxExc = 0;
      for (let j = i; j < len; j++) {
        const cc = candles[j];
        const exc = side === 'high'
          ? (requireClose ? (cc.close - breakLevel) : (cc.high - breakLevel))
          : (requireClose ? (breakLevel - cc.close) : (breakLevel - cc.low));
        if (exc > maxExc) maxExc = exc;
      }
      const lastClose = candles[len - 1].close;
      const curExc = side === 'high' ? lastClose - breakLevel : breakLevel - lastClose;
      const levelPct = breakLevel !== 0 ? Math.abs(breakLevel) : 1;

      return {
        detected: true,
        side,
        windowSize: window,
        windowHigh,
        windowLow,
        breakLevel,
        breakCandleIndex: i,
        candlesAgo: len - 1 - i,
        excursionPct: (curExc / levelPct) * 100,
        maxExcursionPct: (maxExc / levelPct) * 100,
        stillBeyond: curExc > 0,
        brokeByClose: side === 'high' ? c.close > breakLevel : c.close < breakLevel,
      };
    }
  }

  return none;
}
