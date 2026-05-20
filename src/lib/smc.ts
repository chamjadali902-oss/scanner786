import { Candle } from '@/types/scanner';

// Smart Money Concepts Detection

interface SwingPoint {
  index: number;
  price: number;
  type: 'high' | 'low';
}

function findSwingPoints(candles: Candle[], lookback: number = 5): SwingPoint[] {
  const swingPoints: SwingPoint[] = [];
  
  for (let i = lookback; i < candles.length - lookback; i++) {
    const currentHigh = candles[i].high;
    const currentLow = candles[i].low;
    
    let isSwingHigh = true;
    let isSwingLow = true;
    
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j !== i) {
        if (candles[j].high >= currentHigh) isSwingHigh = false;
        if (candles[j].low <= currentLow) isSwingLow = false;
      }
    }
    
    if (isSwingHigh) {
      swingPoints.push({ index: i, price: currentHigh, type: 'high' });
    }
    if (isSwingLow) {
      swingPoints.push({ index: i, price: currentLow, type: 'low' });
    }
  }
  
  return swingPoints;
}

// Break of Structure (BOS) - Bullish
export function detectBullishBOS(candles: Candle[]): boolean {
  if (candles.length < 10) return false;
  
  const swingPoints = findSwingPoints(candles.slice(0, -1), 3);
  const swingHighs = swingPoints.filter(p => p.type === 'high').slice(-3);
  
  if (swingHighs.length < 1) return false;
  
  const lastSwingHigh = swingHighs[swingHighs.length - 1];
  const currentCandle = candles[candles.length - 1];
  
  // Current price breaks above the last swing high
  return currentCandle.close > lastSwingHigh.price;
}

// Break of Structure (BOS) - Bearish
export function detectBearishBOS(candles: Candle[]): boolean {
  if (candles.length < 10) return false;
  
  const swingPoints = findSwingPoints(candles.slice(0, -1), 3);
  const swingLows = swingPoints.filter(p => p.type === 'low').slice(-3);
  
  if (swingLows.length < 1) return false;
  
  const lastSwingLow = swingLows[swingLows.length - 1];
  const currentCandle = candles[candles.length - 1];
  
  // Current price breaks below the last swing low
  return currentCandle.close < lastSwingLow.price;
}

// Change of Character (ChoCH) - Bullish
export function detectBullishChoCH(candles: Candle[]): boolean {
  if (candles.length < 15) return false;
  
  const swingPoints = findSwingPoints(candles.slice(0, -1), 3);
  const recentSwings = swingPoints.slice(-6);
  
  // Look for lower highs followed by a break above
  const swingHighs = recentSwings.filter(p => p.type === 'high');
  
  if (swingHighs.length < 2) return false;
  
  const prevHigh = swingHighs[swingHighs.length - 2];
  const lastHigh = swingHighs[swingHighs.length - 1];
  const currentCandle = candles[candles.length - 1];
  
  // Was making lower highs but now breaks above
  return lastHigh.price < prevHigh.price && currentCandle.close > lastHigh.price;
}

// Change of Character (ChoCH) - Bearish
export function detectBearishChoCH(candles: Candle[]): boolean {
  if (candles.length < 15) return false;
  
  const swingPoints = findSwingPoints(candles.slice(0, -1), 3);
  const recentSwings = swingPoints.slice(-6);
  
  const swingLows = recentSwings.filter(p => p.type === 'low');
  
  if (swingLows.length < 2) return false;
  
  const prevLow = swingLows[swingLows.length - 2];
  const lastLow = swingLows[swingLows.length - 1];
  const currentCandle = candles[candles.length - 1];
  
  // Was making higher lows but now breaks below
  return lastLow.price > prevLow.price && currentCandle.close < lastLow.price;
}

// Bullish Order Block
export function detectBullishOrderBlock(candles: Candle[]): boolean {
  if (candles.length < 5) return false;
  
  // Look for a bearish candle followed by strong bullish move
  for (let i = candles.length - 4; i >= Math.max(0, candles.length - 10); i--) {
    const potentialOB = candles[i];
    const nextCandles = candles.slice(i + 1);
    
    // Bearish candle
    if (potentialOB.close < potentialOB.open) {
      // Followed by strong bullish move that breaks above
      const strongMove = nextCandles.some(c => c.close > potentialOB.high);
      const currentPrice = candles[candles.length - 1].close;
      
      // Price is near or at the order block
      if (strongMove && currentPrice >= potentialOB.low && currentPrice <= potentialOB.high) {
        return true;
      }
    }
  }
  
  return false;
}

// Bearish Order Block
export function detectBearishOrderBlock(candles: Candle[]): boolean {
  if (candles.length < 5) return false;
  
  for (let i = candles.length - 4; i >= Math.max(0, candles.length - 10); i--) {
    const potentialOB = candles[i];
    const nextCandles = candles.slice(i + 1);
    
    // Bullish candle
    if (potentialOB.close > potentialOB.open) {
      const strongMove = nextCandles.some(c => c.close < potentialOB.low);
      const currentPrice = candles[candles.length - 1].close;
      
      if (strongMove && currentPrice >= potentialOB.low && currentPrice <= potentialOB.high) {
        return true;
      }
    }
  }
  
  return false;
}

// Bullish Fair Value Gap (FVG)
export function detectBullishFVG(candles: Candle[]): boolean {
  if (candles.length < 3) return false;
  
  // Check for FVG in recent candles
  for (let i = candles.length - 1; i >= Math.max(2, candles.length - 5); i--) {
    const first = candles[i - 2];
    const middle = candles[i - 1];
    const third = candles[i];
    
    // Gap between first candle's high and third candle's low (bullish)
    if (third.low > first.high && middle.close > middle.open) {
      const currentPrice = candles[candles.length - 1].close;
      // Price is within or near the gap
      if (currentPrice >= first.high && currentPrice <= third.low) {
        return true;
      }
      // Gap exists
      if (i === candles.length - 1) return true;
    }
  }
  
  return false;
}

// Bearish Fair Value Gap (FVG)
export function detectBearishFVG(candles: Candle[]): boolean {
  if (candles.length < 3) return false;
  
  for (let i = candles.length - 1; i >= Math.max(2, candles.length - 5); i--) {
    const first = candles[i - 2];
    const middle = candles[i - 1];
    const third = candles[i];
    
    // Gap between first candle's low and third candle's high (bearish)
    if (third.high < first.low && middle.close < middle.open) {
      const currentPrice = candles[candles.length - 1].close;
      if (currentPrice <= first.low && currentPrice >= third.high) {
        return true;
      }
      if (i === candles.length - 1) return true;
    }
  }
  
  return false;
}

// Liquidity Sweep (High)
export function detectLiquiditySweepHigh(candles: Candle[]): boolean {
  if (candles.length < 10) return false;
  
  const lookback = Math.min(20, candles.length - 1);
  const recentCandles = candles.slice(-lookback - 1, -1);
  const currentCandle = candles[candles.length - 1];
  
  const previousHigh = Math.max(...recentCandles.map(c => c.high));
  
  // Wick above previous high but close below
  return currentCandle.high > previousHigh && currentCandle.close < previousHigh;
}

// Liquidity Sweep (Low)
export function detectLiquiditySweepLow(candles: Candle[]): boolean {
  if (candles.length < 10) return false;
  
  const lookback = Math.min(20, candles.length - 1);
  const recentCandles = candles.slice(-lookback - 1, -1);
  const currentCandle = candles[candles.length - 1];
  
  const previousLow = Math.min(...recentCandles.map(c => c.low));
  
  // Wick below previous low but close above
  return currentCandle.low < previousLow && currentCandle.close > previousLow;
}

// Equal Highs (EQH)
export function detectEqualHighs(candles: Candle[]): boolean {
  if (candles.length < 10) return false;
  
  const tolerance = 0.001; // 0.1% tolerance
  const swingPoints = findSwingPoints(candles, 3);
  const swingHighs = swingPoints.filter(p => p.type === 'high').slice(-5);
  
  for (let i = 0; i < swingHighs.length - 1; i++) {
    for (let j = i + 1; j < swingHighs.length; j++) {
      const diff = Math.abs(swingHighs[i].price - swingHighs[j].price) / swingHighs[i].price;
      if (diff < tolerance) {
        return true;
      }
    }
  }
  
  return false;
}

// Equal Lows (EQL)
export function detectEqualLows(candles: Candle[]): boolean {
  if (candles.length < 10) return false;
  
  const tolerance = 0.001;
  const swingPoints = findSwingPoints(candles, 3);
  const swingLows = swingPoints.filter(p => p.type === 'low').slice(-5);
  
  for (let i = 0; i < swingLows.length - 1; i++) {
    for (let j = i + 1; j < swingLows.length; j++) {
      const diff = Math.abs(swingLows[i].price - swingLows[j].price) / swingLows[i].price;
      if (diff < tolerance) {
        return true;
      }
    }
  }
  
  return false;
}

// Premium Zone (Price > 0.5 Fib)
export function detectPremiumZone(candles: Candle[]): boolean {
  if (candles.length < 20) return false;
  
  const lookback = Math.min(50, candles.length);
  const recentCandles = candles.slice(-lookback);
  
  const high = Math.max(...recentCandles.map(c => c.high));
  const low = Math.min(...recentCandles.map(c => c.low));
  const midpoint = (high + low) / 2;
  
  const currentPrice = candles[candles.length - 1].close;
  
  return currentPrice > midpoint;
}

// Discount Zone (Price < 0.5 Fib)
export function detectDiscountZone(candles: Candle[]): boolean {
  if (candles.length < 20) return false;
  
  const lookback = Math.min(50, candles.length);
  const recentCandles = candles.slice(-lookback);
  
  const high = Math.max(...recentCandles.map(c => c.high));
  const low = Math.min(...recentCandles.map(c => c.low));
  const midpoint = (high + low) / 2;
  
  const currentPrice = candles[candles.length - 1].close;
  
  return currentPrice < midpoint;
}

// Breaker Block
export function detectBreakerBlock(candles: Candle[]): boolean {
  if (candles.length < 10) return false;
  
  // Look for failed order block scenario
  for (let i = candles.length - 5; i >= Math.max(0, candles.length - 15); i--) {
    const potentialOB = candles[i];
    const subsequent = candles.slice(i + 1);
    
    // Bullish OB that got broken
    if (potentialOB.close > potentialOB.open) {
      const wasRespected = subsequent.some(c => c.low <= potentialOB.high && c.close > potentialOB.low);
      const wasBroken = subsequent.some(c => c.close < potentialOB.low);
      
      if (wasRespected && wasBroken) {
        const currentPrice = candles[candles.length - 1].close;
        // Now price is back at the broken OB (now breaker)
        if (currentPrice >= potentialOB.low && currentPrice <= potentialOB.high) {
          return true;
        }
      }
    }
  }
  
  return false;
}

// Volume Spike - Current volume significantly higher than average
export function detectVolumeSpike(candles: Candle[], multiplier: number = 2): boolean {
  if (candles.length < 20) return false;
  
  const lookback = Math.min(20, candles.length - 1);
  const previousCandles = candles.slice(-lookback - 1, -1);
  const currentCandle = candles[candles.length - 1];
  
  if (!currentCandle.volume || currentCandle.volume === 0) return false;
  
  const volumes = previousCandles.map(c => c.volume || 0).filter(v => v > 0);
  if (volumes.length < 5) return false;
  
  const avgVolume = volumes.reduce((sum, v) => sum + v, 0) / volumes.length;
  
  return currentCandle.volume >= avgVolume * multiplier;
}

// Trend detail result
export interface TrendDetail {
  detected: boolean;
  swingHighs: { price: number; index: number }[];
  swingLows: { price: number; index: number }[];
  retracements: { from: number; to: number; percent: number }[];
  bosCount: number;
}

// Uptrend - Valid Higher Highs and Higher Lows with Fibonacci retracement pullback validation
export function detectUptrend(candles: Candle[], minRetracementPct: number = 25, bosCount: number = 2): boolean {
  return detectUptrendDetail(candles, minRetracementPct, bosCount).detected;
}

export function detectUptrendDetail(candles: Candle[], minRetracementPct: number = 25, bosCount: number = 2): TrendDetail {
  const empty: TrendDetail = { detected: false, swingHighs: [], swingLows: [], retracements: [], bosCount: 0 };
  if (candles.length < 20) return empty;
  
  const swingPoints = findSwingPoints(candles, 3);
  const swingHighs = swingPoints.filter(p => p.type === 'high');
  const swingLows = swingPoints.filter(p => p.type === 'low');
  
  const requiredSwings = bosCount + 1;
  if (swingHighs.length < requiredSwings || swingLows.length < requiredSwings) return empty;
  
  const recentHighs = swingHighs.slice(-requiredSwings);
  const recentLows = swingLows.slice(-requiredSwings);
  
  for (let i = 1; i < recentHighs.length; i++) {
    if (recentHighs[i].price <= recentHighs[i - 1].price) return empty;
  }
  
  for (let i = 1; i < recentLows.length; i++) {
    if (recentLows[i].price <= recentLows[i - 1].price) return empty;
  }
  
  const minRetracement = minRetracementPct / 100;
  const retracements: { from: number; to: number; percent: number }[] = [];
  
  for (let i = 0; i < recentHighs.length - 1; i++) {
    const swingHigh = recentHighs[i];
    const nextSwingHigh = recentHighs[i + 1];
    
    const pullbackLow = swingLows.find(
      p => p.index > swingHigh.index && p.index < nextSwingHigh.index
    );
    
    if (!pullbackLow) return empty;
    
    const impulseRange = swingHigh.price - (i > 0 ? recentLows[i - 1]?.price ?? pullbackLow.price : pullbackLow.price);
    if (impulseRange <= 0) continue;
    
    const pullbackDepth = swingHigh.price - pullbackLow.price;
    const retracementRatio = pullbackDepth / impulseRange;
    
    if (retracementRatio < minRetracement) return empty;
    
    retracements.push({
      from: swingHigh.price,
      to: pullbackLow.price,
      percent: Math.round(retracementRatio * 100),
    });
  }
  
  return {
    detected: true,
    swingHighs: recentHighs.map(p => ({ price: p.price, index: p.index })),
    swingLows: recentLows.map(p => ({ price: p.price, index: p.index })),
    retracements,
    bosCount,
  };
}

// Downtrend - Valid Lower Highs and Lower Lows with Fibonacci retracement pullback validation
export function detectDowntrend(candles: Candle[], minRetracementPct: number = 25, bosCount: number = 2): boolean {
  return detectDowntrendDetail(candles, minRetracementPct, bosCount).detected;
}

export function detectDowntrendDetail(candles: Candle[], minRetracementPct: number = 25, bosCount: number = 2): TrendDetail {
  const empty: TrendDetail = { detected: false, swingHighs: [], swingLows: [], retracements: [], bosCount: 0 };
  if (candles.length < 20) return empty;
  
  const swingPoints = findSwingPoints(candles, 3);
  const swingHighs = swingPoints.filter(p => p.type === 'high');
  const swingLows = swingPoints.filter(p => p.type === 'low');
  
  const requiredSwings = bosCount + 1;
  if (swingHighs.length < requiredSwings || swingLows.length < requiredSwings) return empty;
  
  const recentHighs = swingHighs.slice(-requiredSwings);
  const recentLows = swingLows.slice(-requiredSwings);
  
  for (let i = 1; i < recentHighs.length; i++) {
    if (recentHighs[i].price >= recentHighs[i - 1].price) return empty;
  }
  
  for (let i = 1; i < recentLows.length; i++) {
    if (recentLows[i].price >= recentLows[i - 1].price) return empty;
  }
  
  const minRetracement = minRetracementPct / 100;
  const retracements: { from: number; to: number; percent: number }[] = [];
  
  for (let i = 0; i < recentLows.length - 1; i++) {
    const swingLow = recentLows[i];
    const nextSwingLow = recentLows[i + 1];
    
    const pullbackHigh = swingHighs.find(
      p => p.index > swingLow.index && p.index < nextSwingLow.index
    );
    
    if (!pullbackHigh) return empty;
    
    const impulseRange = (i > 0 ? recentHighs[i - 1]?.price ?? pullbackHigh.price : pullbackHigh.price) - swingLow.price;
    if (impulseRange <= 0) continue;
    
    const pullbackDepth = pullbackHigh.price - swingLow.price;
    const retracementRatio = pullbackDepth / impulseRange;
    
    if (retracementRatio < minRetracement) return empty;
    
    retracements.push({
      from: swingLow.price,
      to: pullbackHigh.price,
      percent: Math.round(retracementRatio * 100),
    });
  }
  
  return {
    detected: true,
    swingHighs: recentHighs.map(p => ({ price: p.price, index: p.index })),
    swingLows: recentLows.map(p => ({ price: p.price, index: p.index })),
    retracements,
    bosCount,
  };
}

// ============================================================
// SPRING (Bullish Liquidity Sweep at Support) — Wyckoff-style
// Detects: a tested support level got broken (wick below) but
// price quickly recovered back ABOVE the support (absorption).
// ============================================================
export interface SpringResult {
  detected: boolean;
  supportLevel: number;
  sweepLow: number;
  recoveryClose: number;
  candlesAgo: number;            // how many candles ago the sweep happened (0 = current)
  supportTouches: number;        // how many times the support was tested before sweep
  volumeSpike: boolean;          // sweep candle had above-avg volume
  reclaimConfirmed: boolean;     // close back above the support
}

export function detectBullishSpring(
  candles: Candle[],
  opts: {
    lookback?: number;          // how far back to scan for support level (default 60)
    swingLookback?: number;     // strictness of swing low (default 5)
    maxAge?: number;            // sweep must have occurred within last N candles (default 5)
    minBreakPct?: number;       // wick must extend at least this % below support (default 0.05)
    tolerancePct?: number;      // support touch tolerance (default 0.3%)
    minTouches?: number;        // support must have been tested at least N times (default 1)
  } = {}
): SpringResult {
  const lookback = opts.lookback ?? 60;
  const swingLookback = opts.swingLookback ?? 5;
  const maxAge = opts.maxAge ?? 5;
  const minBreakPct = opts.minBreakPct ?? 0.05;
  const tolerancePct = opts.tolerancePct ?? 0.3;
  const minTouches = opts.minTouches ?? 1;

  const empty: SpringResult = {
    detected: false, supportLevel: 0, sweepLow: 0, recoveryClose: 0,
    candlesAgo: 0, supportTouches: 0, volumeSpike: false, reclaimConfirmed: false,
  };

  if (candles.length < lookback + swingLookback + 2) return empty;

  const len = candles.length;
  const recentStart = len - maxAge;             // sweep window: [recentStart, len-1]
  const historyEnd = recentStart - 1;
  const historyStart = Math.max(swingLookback, len - lookback);

  if (historyEnd <= historyStart) return empty;

  // 1) collect swing lows from the historical window
  const swings: { idx: number; price: number }[] = [];
  for (let i = historyStart; i <= historyEnd; i++) {
    let ok = true;
    for (let j = i - swingLookback; j <= i + swingLookback; j++) {
      if (j === i || j < 0 || j >= len) continue;
      if (candles[j].low <= candles[i].low) { ok = false; break; }
    }
    if (ok) swings.push({ idx: i, price: candles[i].low });
  }
  if (swings.length === 0) return empty;

  // volume baseline (history only, exclude sweep window)
  const histVols = candles.slice(historyStart, historyEnd + 1).map(c => c.volume || 0).filter(v => v > 0);
  const avgVol = histVols.length ? histVols.reduce((a, b) => a + b, 0) / histVols.length : 0;

  let best: SpringResult | null = null;

  for (const s of swings) {
    // count touches before sweep window: candles whose low approached support within tolerance
    const tol = s.price * (tolerancePct / 100);
    let touches = 0;
    for (let i = s.idx; i <= historyEnd; i++) {
      if (candles[i].low <= s.price + tol && candles[i].low >= s.price - tol) touches++;
    }
    if (touches < minTouches) continue;

    // look for a sweep within the recent window
    for (let k = recentStart; k < len; k++) {
      const c = candles[k];
      const brokeBelow = c.low < s.price * (1 - minBreakPct / 100);
      if (!brokeBelow) continue;

      // Recovery: either sweep candle closed back above OR a later candle closed above
      let reclaimed = c.close > s.price;
      let recoveryClose = c.close;
      if (!reclaimed) {
        for (let m = k + 1; m < len; m++) {
          if (candles[m].close > s.price) { reclaimed = true; recoveryClose = candles[m].close; break; }
        }
      }
      if (!reclaimed) continue;

      // current price must still be above support (setup still valid)
      if (candles[len - 1].close <= s.price) continue;

      const volSpike = avgVol > 0 && (c.volume || 0) >= avgVol * 1.3;

      const candidate: SpringResult = {
        detected: true,
        supportLevel: s.price,
        sweepLow: c.low,
        recoveryClose,
        candlesAgo: len - 1 - k,
        supportTouches: touches,
        volumeSpike: volSpike,
        reclaimConfirmed: true,
      };

      // Prefer the most recent sweep with the strongest support (most touches)
      if (!best || candidate.candlesAgo < best.candlesAgo ||
          (candidate.candlesAgo === best.candlesAgo && candidate.supportTouches > best.supportTouches)) {
        best = candidate;
      }
      break; // one sweep per support
    }
  }

  return best ?? empty;
}

// ============================================================
// UPTHRUST (Bearish Liquidity Sweep at Resistance) — mirror of Spring
// ============================================================
export interface UpthrustResult {
  detected: boolean;
  resistanceLevel: number;
  sweepHigh: number;
  rejectionClose: number;
  candlesAgo: number;
  resistanceTouches: number;
  volumeSpike: boolean;
  rejectionConfirmed: boolean;
}

export function detectBearishUpthrust(
  candles: Candle[],
  opts: {
    lookback?: number;
    swingLookback?: number;
    maxAge?: number;
    minBreakPct?: number;
    tolerancePct?: number;
    minTouches?: number;
  } = {}
): UpthrustResult {
  const lookback = opts.lookback ?? 60;
  const swingLookback = opts.swingLookback ?? 5;
  const maxAge = opts.maxAge ?? 5;
  const minBreakPct = opts.minBreakPct ?? 0.05;
  const tolerancePct = opts.tolerancePct ?? 0.3;
  const minTouches = opts.minTouches ?? 1;

  const empty: UpthrustResult = {
    detected: false, resistanceLevel: 0, sweepHigh: 0, rejectionClose: 0,
    candlesAgo: 0, resistanceTouches: 0, volumeSpike: false, rejectionConfirmed: false,
  };

  if (candles.length < lookback + swingLookback + 2) return empty;

  const len = candles.length;
  const recentStart = len - maxAge;
  const historyEnd = recentStart - 1;
  const historyStart = Math.max(swingLookback, len - lookback);
  if (historyEnd <= historyStart) return empty;

  const swings: { idx: number; price: number }[] = [];
  for (let i = historyStart; i <= historyEnd; i++) {
    let ok = true;
    for (let j = i - swingLookback; j <= i + swingLookback; j++) {
      if (j === i || j < 0 || j >= len) continue;
      if (candles[j].high >= candles[i].high) { ok = false; break; }
    }
    if (ok) swings.push({ idx: i, price: candles[i].high });
  }
  if (swings.length === 0) return empty;

  const histVols = candles.slice(historyStart, historyEnd + 1).map(c => c.volume || 0).filter(v => v > 0);
  const avgVol = histVols.length ? histVols.reduce((a, b) => a + b, 0) / histVols.length : 0;

  let best: UpthrustResult | null = null;

  for (const r of swings) {
    const tol = r.price * (tolerancePct / 100);
    let touches = 0;
    for (let i = r.idx; i <= historyEnd; i++) {
      if (candles[i].high <= r.price + tol && candles[i].high >= r.price - tol) touches++;
    }
    if (touches < minTouches) continue;

    for (let k = recentStart; k < len; k++) {
      const c = candles[k];
      const brokeAbove = c.high > r.price * (1 + minBreakPct / 100);
      if (!brokeAbove) continue;

      let rejected = c.close < r.price;
      let rejectionClose = c.close;
      if (!rejected) {
        for (let m = k + 1; m < len; m++) {
          if (candles[m].close < r.price) { rejected = true; rejectionClose = candles[m].close; break; }
        }
      }
      if (!rejected) continue;
      if (candles[len - 1].close >= r.price) continue;

      const volSpike = avgVol > 0 && (c.volume || 0) >= avgVol * 1.3;

      const candidate: UpthrustResult = {
        detected: true,
        resistanceLevel: r.price,
        sweepHigh: c.high,
        rejectionClose,
        candlesAgo: len - 1 - k,
        resistanceTouches: touches,
        volumeSpike: volSpike,
        rejectionConfirmed: true,
      };

      if (!best || candidate.candlesAgo < best.candlesAgo ||
          (candidate.candlesAgo === best.candlesAgo && candidate.resistanceTouches > best.resistanceTouches)) {
        best = candidate;
      }
      break;
    }
  }

  return best ?? empty;
}



