import { Candle } from '@/types/scanner';

// =====================================================
// INDUSTRY-STANDARD INDICATOR CALCULATIONS
// All formulas match TradingView and professional platforms
// =====================================================

// Helper: Wilder's Smoothing (RMA) - Used by RSI, ATR, ADX
function wilderSmooth(values: number[], period: number): number[] {
  const result: number[] = [];
  let sum = 0;
  
  for (let i = 0; i < values.length; i++) {
    if (i < period) {
      sum += values[i];
      if (i === period - 1) {
        result.push(sum / period);
      } else {
        result.push(NaN);
      }
    } else {
      const smoothed = (result[i - 1] * (period - 1) + values[i]) / period;
      result.push(smoothed);
    }
  }
  
  return result;
}

// =====================================================
// SIMPLE MOVING AVERAGE (SMA)
// =====================================================
export function calculateSMA(candles: Candle[], period: number): number[] {
  const result: number[] = [];
  
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sum += candles[j].close;
      }
      result.push(sum / period);
    }
  }
  
  return result;
}

// =====================================================
// EXPONENTIAL MOVING AVERAGE (EMA)
// Uses SMA as seed, then applies EMA formula
// =====================================================
export function calculateEMA(candles: Candle[], period: number): number[] {
  const result: number[] = [];
  const multiplier = 2 / (period + 1);
  
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else if (i === period - 1) {
      // First EMA = SMA
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += candles[j].close;
      }
      result.push(sum / period);
    } else {
      // EMA = (Close - Previous EMA) * multiplier + Previous EMA
      const ema = (candles[i].close - result[i - 1]) * multiplier + result[i - 1];
      result.push(ema);
    }
  }
  
  return result;
}

// =====================================================
// RELATIVE STRENGTH INDEX (RSI)
// Uses Wilder's Smoothing Method (RMA) - matches TradingView
// =====================================================
export function calculateRSI(candles: Candle[], period: number = 14): number[] {
  if (candles.length < period + 1) {
    return candles.map(() => NaN);
  }
  
  // Calculate price changes
  const gains: number[] = [0];
  const losses: number[] = [0];
  
  for (let i = 1; i < candles.length; i++) {
    const change = candles[i].close - candles[i - 1].close;
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }
  
  // Apply Wilder's smoothing to gains and losses
  const avgGains = wilderSmooth(gains, period);
  const avgLosses = wilderSmooth(losses, period);
  
  // Calculate RSI
  const result: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (isNaN(avgGains[i]) || isNaN(avgLosses[i])) {
      result.push(NaN);
    } else if (avgLosses[i] === 0) {
      result.push(100);
    } else {
      const rs = avgGains[i] / avgLosses[i];
      result.push(100 - (100 / (1 + rs)));
    }
  }
  
  return result;
}

// =====================================================
// MOVING AVERAGE CONVERGENCE DIVERGENCE (MACD)
// Standard: 12, 26, 9 periods
// =====================================================
export function calculateMACD(candles: Candle[], fastPeriod = 12, slowPeriod = 26, signalPeriod = 9): {
  macdLine: number[];
  signalLine: number[];
  histogram: number[];
} {
  const emaFast = calculateEMA(candles, fastPeriod);
  const emaSlow = calculateEMA(candles, slowPeriod);
  
  // MACD Line = Fast EMA - Slow EMA
  const macdLine: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (isNaN(emaFast[i]) || isNaN(emaSlow[i])) {
      macdLine.push(NaN);
    } else {
      macdLine.push(emaFast[i] - emaSlow[i]);
    }
  }
  
  // Signal Line = EMA of MACD Line
  const signalLine: number[] = [];
  const multiplier = 2 / (signalPeriod + 1);
  let validMacdCount = 0;
  let macdSum = 0;
  
  for (let i = 0; i < macdLine.length; i++) {
    if (isNaN(macdLine[i])) {
      signalLine.push(NaN);
      continue;
    }
    
    validMacdCount++;
    
    if (validMacdCount < signalPeriod) {
      macdSum += macdLine[i];
      signalLine.push(NaN);
    } else if (validMacdCount === signalPeriod) {
      macdSum += macdLine[i];
      signalLine.push(macdSum / signalPeriod);
    } else {
      const ema = (macdLine[i] - signalLine[i - 1]) * multiplier + signalLine[i - 1];
      signalLine.push(ema);
    }
  }
  
  // Histogram = MACD Line - Signal Line
  const histogram: number[] = [];
  for (let i = 0; i < macdLine.length; i++) {
    if (isNaN(macdLine[i]) || isNaN(signalLine[i])) {
      histogram.push(NaN);
    } else {
      histogram.push(macdLine[i] - signalLine[i]);
    }
  }
  
  return { macdLine, signalLine, histogram };
}

// =====================================================
// BOLLINGER BANDS
// Middle = SMA(20), Upper/Lower = Middle ± 2*StdDev
// =====================================================
export function calculateBollingerBands(candles: Candle[], period = 20, stdDev = 2): {
  upper: number[];
  middle: number[];
  lower: number[];
  bandwidth: number[];
} {
  const middle = calculateSMA(candles, period);
  const upper: number[] = [];
  const lower: number[] = [];
  const bandwidth: number[] = [];
  
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      upper.push(NaN);
      lower.push(NaN);
      bandwidth.push(NaN);
    } else {
      // Calculate standard deviation
      let sumSquares = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sumSquares += Math.pow(candles[j].close - middle[i], 2);
      }
      const std = Math.sqrt(sumSquares / period);
      
      upper.push(middle[i] + stdDev * std);
      lower.push(middle[i] - stdDev * std);
      bandwidth.push(((upper[i] - lower[i]) / middle[i]) * 100);
    }
  }
  
  return { upper, middle, lower, bandwidth };
}

// =====================================================
// STOCHASTIC OSCILLATOR
// %K = (Close - Lowest Low) / (Highest High - Lowest Low) * 100
// %D = SMA of %K
// =====================================================
export function calculateStochastic(candles: Candle[], kPeriod = 14, dPeriod = 3, smooth = 3): {
  k: number[];
  d: number[];
} {
  // Calculate raw %K (Fast Stochastic)
  const rawK: number[] = [];
  
  for (let i = 0; i < candles.length; i++) {
    if (i < kPeriod - 1) {
      rawK.push(NaN);
    } else {
      let highestHigh = candles[i].high;
      let lowestLow = candles[i].low;
      
      for (let j = i - kPeriod + 1; j <= i; j++) {
        if (candles[j].high > highestHigh) highestHigh = candles[j].high;
        if (candles[j].low < lowestLow) lowestLow = candles[j].low;
      }
      
      if (highestHigh === lowestLow) {
        rawK.push(50);
      } else {
        rawK.push(((candles[i].close - lowestLow) / (highestHigh - lowestLow)) * 100);
      }
    }
  }
  
  // Smooth %K (Slow Stochastic %K = SMA of raw %K)
  const k: number[] = [];
  for (let i = 0; i < rawK.length; i++) {
    if (isNaN(rawK[i]) || i < kPeriod - 1 + smooth - 1) {
      k.push(NaN);
    } else {
      let sum = 0;
      for (let j = i - smooth + 1; j <= i; j++) {
        sum += rawK[j];
      }
      k.push(sum / smooth);
    }
  }
  
  // %D = SMA of smoothed %K
  const d: number[] = [];
  for (let i = 0; i < k.length; i++) {
    if (isNaN(k[i]) || i < kPeriod - 1 + smooth - 1 + dPeriod - 1) {
      d.push(NaN);
    } else {
      let sum = 0;
      for (let j = i - dPeriod + 1; j <= i; j++) {
        sum += k[j];
      }
      d.push(sum / dPeriod);
    }
  }
  
  return { k, d };
}

// =====================================================
// AVERAGE DIRECTIONAL INDEX (ADX)
// Uses Wilder's smoothing - matches TradingView
// =====================================================
export function calculateADX(candles: Candle[], period = 14): number[] {
  if (candles.length < period * 2) {
    return candles.map(() => NaN);
  }
  
  const tr: number[] = [];
  const plusDM: number[] = [];
  const minusDM: number[] = [];
  
  // First candle
  tr.push(candles[0].high - candles[0].low);
  plusDM.push(0);
  minusDM.push(0);
  
  // Calculate True Range and Directional Movement
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevHigh = candles[i - 1].high;
    const prevLow = candles[i - 1].low;
    const prevClose = candles[i - 1].close;
    
    // True Range
    tr.push(Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    ));
    
    // Directional Movement
    const upMove = high - prevHigh;
    const downMove = prevLow - low;
    
    if (upMove > downMove && upMove > 0) {
      plusDM.push(upMove);
    } else {
      plusDM.push(0);
    }
    
    if (downMove > upMove && downMove > 0) {
      minusDM.push(downMove);
    } else {
      minusDM.push(0);
    }
  }
  
  // Apply Wilder's smoothing
  const smoothTR = wilderSmooth(tr, period);
  const smoothPlusDM = wilderSmooth(plusDM, period);
  const smoothMinusDM = wilderSmooth(minusDM, period);
  
  // Calculate +DI and -DI
  const plusDI: number[] = [];
  const minusDI: number[] = [];
  const dx: number[] = [];
  
  for (let i = 0; i < candles.length; i++) {
    if (isNaN(smoothTR[i]) || smoothTR[i] === 0) {
      plusDI.push(NaN);
      minusDI.push(NaN);
      dx.push(NaN);
    } else {
      const pdi = (smoothPlusDM[i] / smoothTR[i]) * 100;
      const mdi = (smoothMinusDM[i] / smoothTR[i]) * 100;
      plusDI.push(pdi);
      minusDI.push(mdi);
      
      if (pdi + mdi === 0) {
        dx.push(0);
      } else {
        dx.push((Math.abs(pdi - mdi) / (pdi + mdi)) * 100);
      }
    }
  }
  
  // ADX = Wilder's smooth of DX
  const adx = wilderSmooth(dx.map(v => isNaN(v) ? 0 : v), period);
  
  // Adjust for proper NaN handling
  const result: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i < period * 2 - 1) {
      result.push(NaN);
    } else {
      result.push(adx[i]);
    }
  }
  
  return result;
}

// =====================================================
// COMMODITY CHANNEL INDEX (CCI)
// CCI = (Typical Price - SMA) / (0.015 * Mean Deviation)
// =====================================================
export function calculateCCI(candles: Candle[], period = 20): number[] {
  const result: number[] = [];
  
  // Calculate Typical Prices
  const typicalPrices: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    typicalPrices.push((candles[i].high + candles[i].low + candles[i].close) / 3);
  }
  
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else {
      // Calculate SMA of Typical Price
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sum += typicalPrices[j];
      }
      const sma = sum / period;
      
      // Calculate Mean Deviation
      let meanDev = 0;
      for (let j = i - period + 1; j <= i; j++) {
        meanDev += Math.abs(typicalPrices[j] - sma);
      }
      meanDev /= period;
      
      // CCI formula
      if (meanDev === 0) {
        result.push(0);
      } else {
        result.push((typicalPrices[i] - sma) / (0.015 * meanDev));
      }
    }
  }
  
  return result;
}

// =====================================================
// AVERAGE TRUE RANGE (ATR)
// Uses Wilder's smoothing (RMA) - matches TradingView
// =====================================================
export function calculateATR(candles: Candle[], period = 14): number[] {
  const tr: number[] = [];
  
  // First candle TR = High - Low
  tr.push(candles[0].high - candles[0].low);
  
  // Calculate True Range for remaining candles
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;
    
    tr.push(Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    ));
  }
  
  // ATR = Wilder's smooth of TR
  return wilderSmooth(tr, period);
}

// =====================================================
// VOLUME WEIGHTED AVERAGE PRICE (VWAP)
// Cumulative (Typical Price * Volume) / Cumulative Volume
// =====================================================
export function calculateVWAP(candles: Candle[]): number[] {
  const result: number[] = [];
  let cumulativeTPV = 0;
  let cumulativeVolume = 0;
  
  for (let i = 0; i < candles.length; i++) {
    const typicalPrice = (candles[i].high + candles[i].low + candles[i].close) / 3;
    cumulativeTPV += typicalPrice * candles[i].volume;
    cumulativeVolume += candles[i].volume;
    
    if (cumulativeVolume === 0) {
      result.push(typicalPrice);
    } else {
      result.push(cumulativeTPV / cumulativeVolume);
    }
  }
  
  return result;
}

// =====================================================
// MONEY FLOW INDEX (MFI)
// Similar to RSI but uses volume
// =====================================================
export function calculateMFI(candles: Candle[], period = 14): number[] {
  const result: number[] = [];
  
  // Calculate Typical Prices and Raw Money Flow
  const typicalPrices: number[] = [];
  const rawMoneyFlow: number[] = [];
  
  for (let i = 0; i < candles.length; i++) {
    const tp = (candles[i].high + candles[i].low + candles[i].close) / 3;
    typicalPrices.push(tp);
    rawMoneyFlow.push(tp * candles[i].volume);
  }
  
  for (let i = 0; i < candles.length; i++) {
    if (i < period) {
      result.push(NaN);
    } else {
      let positiveFlow = 0;
      let negativeFlow = 0;
      
      for (let j = i - period + 1; j <= i; j++) {
        if (typicalPrices[j] > typicalPrices[j - 1]) {
          positiveFlow += rawMoneyFlow[j];
        } else if (typicalPrices[j] < typicalPrices[j - 1]) {
          negativeFlow += rawMoneyFlow[j];
        }
      }
      
      if (negativeFlow === 0) {
        result.push(100);
      } else if (positiveFlow === 0) {
        result.push(0);
      } else {
        const mfRatio = positiveFlow / negativeFlow;
        result.push(100 - (100 / (1 + mfRatio)));
      }
    }
  }
  
  return result;
}

// =====================================================
// WILLIAMS %R
// %R = (Highest High - Close) / (Highest High - Lowest Low) * -100
// =====================================================
export function calculateWilliamsR(candles: Candle[], period = 14): number[] {
  const result: number[] = [];
  
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else {
      let highestHigh = candles[i].high;
      let lowestLow = candles[i].low;
      
      for (let j = i - period + 1; j <= i; j++) {
        if (candles[j].high > highestHigh) highestHigh = candles[j].high;
        if (candles[j].low < lowestLow) lowestLow = candles[j].low;
      }
      
      if (highestHigh === lowestLow) {
        result.push(-50);
      } else {
        result.push(((highestHigh - candles[i].close) / (highestHigh - lowestLow)) * -100);
      }
    }
  }
  
  return result;
}

// =====================================================
// RATE OF CHANGE (ROC)
// ROC = ((Close - Close[n]) / Close[n]) * 100
// =====================================================
export function calculateROC(candles: Candle[], period = 12): number[] {
  const result: number[] = [];
  
  for (let i = 0; i < candles.length; i++) {
    if (i < period) {
      result.push(NaN);
    } else {
      const prevClose = candles[i - period].close;
      if (prevClose === 0) {
        result.push(0);
      } else {
        result.push(((candles[i].close - prevClose) / prevClose) * 100);
      }
    }
  }
  
  return result;
}

// =====================================================
// PARABOLIC SAR
// Standard implementation with acceleration factor
// =====================================================
export function calculateParabolicSAR(candles: Candle[], step = 0.02, maxStep = 0.2): number[] {
  const result: number[] = [];
  
  if (candles.length < 2) {
    return candles.map(() => NaN);
  }
  
  // Determine initial trend
  let isUpTrend = candles[1].close > candles[0].close;
  let af = step;
  let ep = isUpTrend ? candles[0].high : candles[0].low;
  let sar = isUpTrend ? candles[0].low : candles[0].high;
  
  result.push(sar);
  
  for (let i = 1; i < candles.length; i++) {
    const prevSar = sar;
    
    // Calculate new SAR
    sar = prevSar + af * (ep - prevSar);
    
    if (isUpTrend) {
      // SAR cannot be above prior two lows
      if (i >= 2) {
        sar = Math.min(sar, candles[i - 1].low, candles[i - 2].low);
      } else {
        sar = Math.min(sar, candles[i - 1].low);
      }
      
      // Check for reversal
      if (candles[i].low < sar) {
        // Reversal to downtrend
        isUpTrend = false;
        sar = ep;
        ep = candles[i].low;
        af = step;
      } else {
        // Continue uptrend
        if (candles[i].high > ep) {
          ep = candles[i].high;
          af = Math.min(af + step, maxStep);
        }
      }
    } else {
      // SAR cannot be below prior two highs
      if (i >= 2) {
        sar = Math.max(sar, candles[i - 1].high, candles[i - 2].high);
      } else {
        sar = Math.max(sar, candles[i - 1].high);
      }
      
      // Check for reversal
      if (candles[i].high > sar) {
        // Reversal to uptrend
        isUpTrend = true;
        sar = ep;
        ep = candles[i].high;
        af = step;
      } else {
        // Continue downtrend
        if (candles[i].low < ep) {
          ep = candles[i].low;
          af = Math.min(af + step, maxStep);
        }
      }
    }
    
    result.push(sar);
  }
  
  return result;
}

// =====================================================
// SUPERTREND
// Based on ATR with multiplier - matches TradingView exactly
// Default: period=10, multiplier=3
// Returns: { value: number[], direction: number[] }
// direction: 1 = bullish (price above), -1 = bearish (price below)
// =====================================================
export function calculateSupertrend(candles: Candle[], period = 10, multiplier = 3): {
  value: number[];
  direction: number[];
} {
  const len = candles.length;
  const value: number[] = new Array(len).fill(NaN);
  const direction: number[] = new Array(len).fill(0);

  if (len < period + 1) {
    return { value, direction };
  }

  // Calculate ATR using Wilder's smoothing
  const tr: number[] = [candles[0].high - candles[0].low];
  for (let i = 1; i < len; i++) {
    tr.push(Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close)
    ));
  }
  const atr = wilderSmooth(tr, period);

  // Calculate basic upper and lower bands
  const upperBand: number[] = new Array(len).fill(NaN);
  const lowerBand: number[] = new Array(len).fill(NaN);
  const finalUpperBand: number[] = new Array(len).fill(NaN);
  const finalLowerBand: number[] = new Array(len).fill(NaN);

  for (let i = 0; i < len; i++) {
    if (isNaN(atr[i])) continue;
    const hl2 = (candles[i].high + candles[i].low) / 2;
    upperBand[i] = hl2 + multiplier * atr[i];
    lowerBand[i] = hl2 - multiplier * atr[i];
  }

  // Initialize first valid index
  const firstValid = period - 1;
  finalUpperBand[firstValid] = upperBand[firstValid];
  finalLowerBand[firstValid] = lowerBand[firstValid];
  // Initial direction based on close vs bands
  direction[firstValid] = candles[firstValid].close > upperBand[firstValid] ? 1 : -1;
  value[firstValid] = direction[firstValid] === 1 ? finalLowerBand[firstValid] : finalUpperBand[firstValid];

  for (let i = firstValid + 1; i < len; i++) {
    if (isNaN(upperBand[i])) continue;

    // Final Lower Band: if current lowerBand > previous finalLowerBand OR previous close < previous finalLowerBand
    // then use current lowerBand, else use previous finalLowerBand
    if (lowerBand[i] > finalLowerBand[i - 1] || candles[i - 1].close < finalLowerBand[i - 1]) {
      finalLowerBand[i] = lowerBand[i];
    } else {
      finalLowerBand[i] = finalLowerBand[i - 1];
    }

    // Final Upper Band: if current upperBand < previous finalUpperBand OR previous close > previous finalUpperBand
    // then use current upperBand, else use previous finalUpperBand
    if (upperBand[i] < finalUpperBand[i - 1] || candles[i - 1].close > finalUpperBand[i - 1]) {
      finalUpperBand[i] = upperBand[i];
    } else {
      finalUpperBand[i] = finalUpperBand[i - 1];
    }

    // Direction logic (matches TradingView pine script)
    if (direction[i - 1] === -1 && candles[i].close > finalUpperBand[i - 1]) {
      direction[i] = 1; // Flip to bullish
    } else if (direction[i - 1] === 1 && candles[i].close < finalLowerBand[i - 1]) {
      direction[i] = -1; // Flip to bearish
    } else {
      direction[i] = direction[i - 1]; // Continue same direction
    }

    // Supertrend value
    value[i] = direction[i] === 1 ? finalLowerBand[i] : finalUpperBand[i];
  }

  return { value, direction };
}

// =====================================================
// FIBONACCI RETRACEMENT
// Auto-detects swing high/low, calculates Fib levels
// Matches TradingView's Auto Fib Retracement logic
// =====================================================
export function calculateFibonacciRetracement(candles: Candle[], lookbackPeriod = 50): {
  swingHigh: number;
  swingLow: number;
  levels: Record<string, number>;
  trend: 'up' | 'down';
} {
  if (candles.length < lookbackPeriod) {
    const price = candles[candles.length - 1]?.close ?? 0;
    return {
      swingHigh: price,
      swingLow: price,
      levels: { '0': price, '0.236': price, '0.382': price, '0.5': price, '0.618': price, '0.786': price, '1': price },
      trend: 'up',
    };
  }

  const recentCandles = candles.slice(-lookbackPeriod);

  // Find swing high and swing low
  let swingHigh = -Infinity;
  let swingLow = Infinity;
  let swingHighIndex = 0;
  let swingLowIndex = 0;

  for (let i = 0; i < recentCandles.length; i++) {
    if (recentCandles[i].high > swingHigh) {
      swingHigh = recentCandles[i].high;
      swingHighIndex = i;
    }
    if (recentCandles[i].low < swingLow) {
      swingLow = recentCandles[i].low;
      swingLowIndex = i;
    }
  }

  const range = swingHigh - swingLow;
  // Determine trend: if swing low came before swing high = uptrend, else downtrend
  const trend: 'up' | 'down' = swingLowIndex < swingHighIndex ? 'up' : 'down';

  // Standard Fibonacci levels
  const fibRatios = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
  const levels: Record<string, number> = {};

  for (const ratio of fibRatios) {
    if (trend === 'up') {
      // In uptrend: retracement from high going down
      levels[ratio.toString()] = swingHigh - range * ratio;
    } else {
      // In downtrend: retracement from low going up
      levels[ratio.toString()] = swingLow + range * ratio;
    }
  }

  return { swingHigh, swingLow, levels, trend };
}

// =====================================================
// SMART-BULLISH INDICATOR v2
// Deep candle analysis + Price Targets + Entry/TP/SL
// Combines ATR, Swing Points, Volume Profile
// =====================================================
export interface SmartBullishResult {
  score: number;
  sellerExhaustion: number;
  buyerAbsorption: number;
  momentumShift: number;
  volumeConfirm: number;
  priceRecovery: number;
  signal: 'strong_buy' | 'buy' | 'neutral' | 'weak';
  currentPrice: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
  riskRewardRatio: number;
  expectedMovePercent: number;
  maxDownsidePercent: number;
  supportZone: { low: number; high: number };
  resistanceZone: { low: number; high: number };
  nearestSupport: number;
  nearestResistance: number;
  strongSupport: number;
  strongResistance: number;
  swingLow: number;
  swingHigh: number;
  atrValue: number;
}

export function calculateSmartBullish(candles: Candle[], lookback: number = 30): SmartBullishResult {
  const price = candles[candles.length - 1].close;
  const defaultResult: SmartBullishResult = {
    score: 0, sellerExhaustion: 0, buyerAbsorption: 0,
    momentumShift: 0, volumeConfirm: 0, priceRecovery: 0, signal: 'weak',
    currentPrice: price, entryPrice: price, stopLoss: price * 0.97,
    takeProfit1: price * 1.02, takeProfit2: price * 1.04, takeProfit3: price * 1.06,
    riskRewardRatio: 1, expectedMovePercent: 2, maxDownsidePercent: 3,
    supportZone: { low: price * 0.97, high: price * 0.98 },
    resistanceZone: { low: price * 1.02, high: price * 1.03 },
    nearestSupport: price * 0.98, nearestResistance: price * 1.02,
    strongSupport: price * 0.95, strongResistance: price * 1.05,
    swingLow: price * 0.95, swingHigh: price * 1.05, atrValue: 0,
  };

  if (candles.length < lookback + 5) return defaultResult;

  const recent = candles.slice(-lookback);
  const allAnalysis = candles.slice(-Math.min(candles.length, lookback * 3));
  const halfLen = Math.floor(lookback / 2);

  // ========== ATR ==========
  const trValues: number[] = [];
  for (let i = 1; i < allAnalysis.length; i++) {
    trValues.push(Math.max(
      allAnalysis[i].high - allAnalysis[i].low,
      Math.abs(allAnalysis[i].high - allAnalysis[i - 1].close),
      Math.abs(allAnalysis[i].low - allAnalysis[i - 1].close)
    ));
  }
  let atrValue = 0;
  if (trValues.length >= 14) {
    let atrSum = 0;
    for (let i = 0; i < 14; i++) atrSum += trValues[trValues.length - 14 + i];
    atrValue = atrSum / 14;
  }

  // ========== SWING POINTS ==========
  const swingHighs: number[] = [];
  const swingLows: number[] = [];
  const ps = 3;
  for (let i = ps; i < allAnalysis.length - ps; i++) {
    let isSH = true, isSL = true;
    for (let j = 1; j <= ps; j++) {
      if (allAnalysis[i].high <= allAnalysis[i - j].high || allAnalysis[i].high <= allAnalysis[i + j].high) isSH = false;
      if (allAnalysis[i].low >= allAnalysis[i - j].low || allAnalysis[i].low >= allAnalysis[i + j].low) isSL = false;
    }
    if (isSH) swingHighs.push(allAnalysis[i].high);
    if (isSL) swingLows.push(allAnalysis[i].low);
  }
  const sortedHighs = [...swingHighs].sort((a, b) => a - b);
  const sortedLows = [...swingLows].sort((a, b) => a - b);
  const swingHigh = sortedHighs.length > 0 ? sortedHighs[sortedHighs.length - 1] : allAnalysis.reduce((m, c) => Math.max(m, c.high), 0);
  const swingLow = sortedLows.length > 0 ? sortedLows[0] : allAnalysis.reduce((m, c) => Math.min(m, c.low), Infinity);

  // ========== VOLUME PROFILE ==========
  const pRange = swingHigh - swingLow;
  const bins = 20;
  const binSz = pRange > 0 ? pRange / bins : price * 0.01;
  const volProfile: { price: number; volume: number }[] = [];
  for (let i = 0; i < bins; i++) {
    const bL = swingLow + i * binSz;
    const bH = bL + binSz;
    let vol = 0;
    for (const c of allAnalysis) {
      const tp = (c.high + c.low + c.close) / 3;
      if (tp >= bL && tp < bH) vol += c.volume;
    }
    volProfile.push({ price: (bL + bH) / 2, volume: vol });
  }
  const sortByVol = [...volProfile].sort((a, b) => b.volume - a.volume);
  const hvnAbove = sortByVol.filter(v => v.price > price).slice(0, 3);
  const hvnBelow = sortByVol.filter(v => v.price < price).slice(0, 3);

  // ========== SUPPORT & RESISTANCE ==========
  const supBelow = sortedLows.filter(l => l < price).sort((a, b) => b - a);
  const resAbove = sortedHighs.filter(h => h > price).sort((a, b) => a - b);
  const nearSup = supBelow.length > 0 ? supBelow[0] : price - atrValue * 1.5;
  const nearRes = resAbove.length > 0 ? resAbove[0] : price + atrValue * 1.5;
  const strongSup = hvnBelow.length > 0 ? hvnBelow[0].price : nearSup - atrValue;
  const strongRes = hvnAbove.length > 0 ? hvnAbove[0].price : nearRes + atrValue;
  const zw = atrValue * 0.3;

  // ========== CANDLE ANALYSIS ==========
  const cm = recent.map(c => {
    const r = c.high - c.low;
    if (r === 0) return { bp: 0.5, sp: 0.5, br: 0, lw: 0, uw: 0, bull: true, vol: c.volume };
    return {
      bp: (c.close - c.low) / r, sp: (c.high - c.close) / r,
      br: Math.abs(c.close - c.open) / r,
      lw: (Math.min(c.open, c.close) - c.low) / r,
      uw: (c.high - Math.max(c.open, c.close)) / r,
      bull: c.close >= c.open, vol: c.volume,
    };
  });
  const om = cm.slice(0, halfLen);
  const nm = cm.slice(halfLen);

  // 1. Seller Exhaustion (25%)
  const oBB = om.filter(m => !m.bull).map(m => m.br);
  const nBB = nm.filter(m => !m.bull).map(m => m.br);
  const aOBB = oBB.length > 0 ? oBB.reduce((a, b) => a + b, 0) / oBB.length : 0;
  const aNBB = nBB.length > 0 ? nBB.reduce((a, b) => a + b, 0) / nBB.length : 0;
  const oBC = om.filter(m => !m.bull).length;
  const nBC = nm.filter(m => !m.bull).length;
  let se = 50;
  if (aOBB > 0) se += ((aOBB - aNBB) / aOBB) * 50;
  if (oBC > 0) se += ((oBC - nBC) / oBC) * 30;
  se = Math.max(0, Math.min(100, se));

  // 2. Buyer Absorption (20%)
  const oLW = om.map(m => m.lw).reduce((a, b) => a + b, 0) / om.length;
  const nLW = nm.map(m => m.lw).reduce((a, b) => a + b, 0) / nm.length;
  const oUW = om.map(m => m.uw).reduce((a, b) => a + b, 0) / om.length;
  const nUW = nm.map(m => m.uw).reduce((a, b) => a + b, 0) / nm.length;
  let ba = 50;
  if (nLW > oLW) ba += Math.min(30, ((nLW - oLW) / Math.max(oLW, 0.01)) * 40);
  if (nUW < oUW) ba += Math.min(20, ((oUW - nUW) / Math.max(oUW, 0.01)) * 25);
  ba = Math.max(0, Math.min(100, ba));

  // 3. Momentum Shift (25%)
  const bps = cm.map(m => m.bp);
  const nn = bps.length;
  let sx = 0, sy = 0, sxy = 0, sx2 = 0;
  for (let i = 0; i < nn; i++) { sx += i; sy += bps[i]; sxy += i * bps[i]; sx2 += i * i; }
  const sl = (nn * sxy - sx * sy) / (nn * sx2 - sx * sx);
  const l5b = cm.slice(-5).filter(m => m.bull).length;
  const f5b = cm.slice(0, 5).filter(m => m.bull).length;
  let ms = 50 + sl * 500 + (l5b - f5b) * 5;
  ms = Math.max(0, Math.min(100, ms));

  // 4. Volume Confirmation (15%)
  const nbv = nm.filter(m => m.bull).map(m => m.vol);
  const nsv = nm.filter(m => !m.bull).map(m => m.vol);
  const abv = nbv.length > 0 ? nbv.reduce((a, b) => a + b, 0) / nbv.length : 0;
  const asv = nsv.length > 0 ? nsv.reduce((a, b) => a + b, 0) / nsv.length : 0;
  const oav = om.map(m => m.vol).reduce((a, b) => a + b, 0) / om.length;
  const nav = nm.map(m => m.vol).reduce((a, b) => a + b, 0) / nm.length;
  let vc = 50;
  if (asv > 0) vc += Math.min(30, (abv / asv - 1) * 25);
  if (oav > 0 && nav > oav) vc += Math.min(20, ((nav - oav) / oav) * 15);
  vc = Math.max(0, Math.min(100, vc));

  // 5. Price Recovery (15%)
  const cp = recent.map(c => { const r = c.high - c.low; return r > 0 ? (c.close - c.low) / r : 0.5; });
  const ocp = cp.slice(0, halfLen).reduce((a, b) => a + b, 0) / halfLen;
  const ncp = cp.slice(halfLen).reduce((a, b) => a + b, 0) / nm.length;
  const rLows = recent.slice(-10).map(c => c.low);
  let hlc = 0;
  for (let i = 1; i < rLows.length; i++) { if (rLows[i] >= rLows[i - 1]) hlc++; }
  let pr = 50 + (ncp - ocp) * 60 + (hlc / (rLows.length - 1) - 0.5) * 30;
  pr = Math.max(0, Math.min(100, pr));

  // SCORE
  const score = Math.round(se * 0.25 + ba * 0.20 + ms * 0.25 + vc * 0.15 + pr * 0.15);
  let signal: SmartBullishResult['signal'] = 'weak';
  if (score >= 75) signal = 'strong_buy';
  else if (score >= 60) signal = 'buy';
  else if (score >= 45) signal = 'neutral';

  // ========== PRICE TARGETS ==========
  const entryPrice = price;
  const stopLoss = Math.max(nearSup - atrValue * 0.3, price - atrValue * 1.5);
  const tp1 = Math.min(nearRes, price + atrValue * 1.5);
  const tp2r = resAbove.length > 1 ? resAbove[1] : nearRes + atrValue;
  const tp2 = Math.min(Math.max(tp2r, price + atrValue * 2.5), strongRes > price ? strongRes : price + atrValue * 2.5);
  const tp3 = Math.min(swingHigh, price + atrValue * 4);
  const risk = Math.abs(price - stopLoss);
  const reward = Math.abs(tp1 - price);
  const rrr = risk > 0 ? Math.round((reward / risk) * 100) / 100 : 0;
  const emp = price > 0 ? Math.round(((tp2 - price) / price) * 10000) / 100 : 0;
  const mdp = price > 0 ? Math.round(((price - stopLoss) / price) * 10000) / 100 : 0;

  return {
    score: Math.max(0, Math.min(100, score)),
    sellerExhaustion: Math.round(se), buyerAbsorption: Math.round(ba),
    momentumShift: Math.round(ms), volumeConfirm: Math.round(vc), priceRecovery: Math.round(pr),
    signal, currentPrice: price, entryPrice, stopLoss,
    takeProfit1: tp1, takeProfit2: tp2, takeProfit3: tp3,
    riskRewardRatio: rrr, expectedMovePercent: emp, maxDownsidePercent: mdp,
    supportZone: { low: nearSup - zw, high: nearSup + zw },
    resistanceZone: { low: nearRes - zw, high: nearRes + zw },
    nearestSupport: nearSup, nearestResistance: nearRes,
    strongSupport: strongSup, strongResistance: strongRes,
    swingLow, swingHigh, atrValue,
  };
}
