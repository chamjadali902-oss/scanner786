/**
 * Simple indicator calculations from raw close prices.
 * Used by LiveTradeAnalysis (frontend) and edge functions.
 * For full candle-based indicators, see src/lib/indicators.ts
 */

// Wilder's Smoothed RSI (matches TradingView)
export function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) avgGain += diff;
    else avgLoss += Math.abs(diff);
  }
  avgGain /= period;
  avgLoss /= period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// Exponential Moving Average from close prices
export function calcEMA(closes: number[], period: number): number {
  if (closes.length < period) return closes[closes.length - 1] ?? 0;
  const k = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < closes.length; i++) ema = closes[i] * k + ema * (1 - k);
  return ema;
}

// MACD (12, 26) from close prices
export function calcMACD(closes: number[]): number {
  if (closes.length < 26) return 0;
  return calcEMA(closes, 12) - calcEMA(closes, 26);
}

// Detect trend based on price vs EMAs
export function detectTrend(
  price: number,
  ema20: number,
  ema50: number
): 'up' | 'down' | 'sideways' {
  if (price > ema20 && ema20 > ema50) return 'up';
  if (price < ema20 && ema20 < ema50) return 'down';
  return 'sideways';
}
