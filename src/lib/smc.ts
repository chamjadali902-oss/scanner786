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
  
  // Need volume data
  if (!currentCandle.volume || currentCandle.volume === 0) return false;
  
  const volumes = previousCandles.map(c => c.volume || 0).filter(v => v > 0);
  if (volumes.length < 5) return false;
  
  const avgVolume = volumes.reduce((sum, v) => sum + v, 0) / volumes.length;
  
  // Current volume is X times (default 2x) higher than average
  return currentCandle.volume >= avgVolume * multiplier;
}
