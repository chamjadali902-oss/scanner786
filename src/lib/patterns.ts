import { Candle } from '@/types/scanner';

// Candlestick Pattern Detection

const DOJI_THRESHOLD = 0.1; // Body is less than 10% of range
const BODY_THRESHOLD = 0.3; // For determining significant bodies

function getBodyRatio(candle: Candle): number {
  const range = candle.high - candle.low;
  if (range === 0) return 0;
  return Math.abs(candle.close - candle.open) / range;
}

function isBullish(candle: Candle): boolean {
  return candle.close > candle.open;
}

function isBearish(candle: Candle): boolean {
  return candle.close < candle.open;
}

function getUpperWick(candle: Candle): number {
  return candle.high - Math.max(candle.open, candle.close);
}

function getLowerWick(candle: Candle): number {
  return Math.min(candle.open, candle.close) - candle.low;
}

function getBody(candle: Candle): number {
  return Math.abs(candle.close - candle.open);
}

function getRange(candle: Candle): number {
  return candle.high - candle.low;
}

export function detectDoji(candles: Candle[]): boolean {
  if (candles.length < 1) return false;
  const candle = candles[candles.length - 1];
  return getBodyRatio(candle) < DOJI_THRESHOLD;
}

export function detectHammer(candles: Candle[]): boolean {
  if (candles.length < 2) return false;
  const candle = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  
  const body = getBody(candle);
  const lowerWick = getLowerWick(candle);
  const upperWick = getUpperWick(candle);
  const range = getRange(candle);
  
  // Hammer: small body at top, long lower wick, in downtrend
  const isHammerShape = lowerWick >= body * 2 && upperWick < body * 0.5 && body / range < 0.4;
  const isDowntrend = prev.close < prev.open || candle.low < prev.low;
  
  return isHammerShape && isDowntrend;
}

export function detectShootingStar(candles: Candle[]): boolean {
  if (candles.length < 2) return false;
  const candle = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  
  const body = getBody(candle);
  const lowerWick = getLowerWick(candle);
  const upperWick = getUpperWick(candle);
  const range = getRange(candle);
  
  // Shooting Star: small body at bottom, long upper wick, in uptrend
  const isShootingStarShape = upperWick >= body * 2 && lowerWick < body * 0.5 && body / range < 0.4;
  const isUptrend = prev.close > prev.open || candle.high > prev.high;
  
  return isShootingStarShape && isUptrend;
}

export function detectBullishEngulfing(candles: Candle[]): boolean {
  if (candles.length < 2) return false;
  const curr = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  
  return (
    isBearish(prev) &&
    isBullish(curr) &&
    curr.open < prev.close &&
    curr.close > prev.open &&
    getBody(curr) > getBody(prev)
  );
}

export function detectBearishEngulfing(candles: Candle[]): boolean {
  if (candles.length < 2) return false;
  const curr = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  
  return (
    isBullish(prev) &&
    isBearish(curr) &&
    curr.open > prev.close &&
    curr.close < prev.open &&
    getBody(curr) > getBody(prev)
  );
}

export function detectMorningStar(candles: Candle[]): boolean {
  if (candles.length < 3) return false;
  const [first, second, third] = candles.slice(-3);
  
  return (
    isBearish(first) &&
    getBodyRatio(first) > BODY_THRESHOLD &&
    getBodyRatio(second) < DOJI_THRESHOLD &&
    second.close < first.close &&
    isBullish(third) &&
    getBodyRatio(third) > BODY_THRESHOLD &&
    third.close > (first.open + first.close) / 2
  );
}

export function detectEveningStar(candles: Candle[]): boolean {
  if (candles.length < 3) return false;
  const [first, second, third] = candles.slice(-3);
  
  return (
    isBullish(first) &&
    getBodyRatio(first) > BODY_THRESHOLD &&
    getBodyRatio(second) < DOJI_THRESHOLD &&
    second.close > first.close &&
    isBearish(third) &&
    getBodyRatio(third) > BODY_THRESHOLD &&
    third.close < (first.open + first.close) / 2
  );
}

export function detectMarubozu(candles: Candle[]): boolean {
  if (candles.length < 1) return false;
  const candle = candles[candles.length - 1];
  
  const body = getBody(candle);
  const range = getRange(candle);
  const upperWick = getUpperWick(candle);
  const lowerWick = getLowerWick(candle);
  
  // Almost no wicks
  return body / range > 0.9 && upperWick / range < 0.05 && lowerWick / range < 0.05;
}

export function detectBullishHarami(candles: Candle[]): boolean {
  if (candles.length < 2) return false;
  const curr = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  
  return (
    isBearish(prev) &&
    isBullish(curr) &&
    getBody(curr) < getBody(prev) &&
    curr.open > prev.close &&
    curr.close < prev.open
  );
}

export function detectBearishHarami(candles: Candle[]): boolean {
  if (candles.length < 2) return false;
  const curr = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  
  return (
    isBullish(prev) &&
    isBearish(curr) &&
    getBody(curr) < getBody(prev) &&
    curr.open < prev.close &&
    curr.close > prev.open
  );
}

export function detectInvertedHammer(candles: Candle[]): boolean {
  if (candles.length < 2) return false;
  const candle = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  
  const body = getBody(candle);
  const lowerWick = getLowerWick(candle);
  const upperWick = getUpperWick(candle);
  
  // Inverted Hammer: small body at bottom, long upper wick, in downtrend
  const isInvertedHammerShape = upperWick >= body * 2 && lowerWick < body * 0.5;
  const isDowntrend = prev.close < prev.open || candle.low < prev.low;
  
  return isInvertedHammerShape && isDowntrend && isBullish(candle);
}

export function detectThreeWhiteSoldiers(candles: Candle[]): boolean {
  if (candles.length < 3) return false;
  const [first, second, third] = candles.slice(-3);
  
  return (
    isBullish(first) && isBullish(second) && isBullish(third) &&
    second.close > first.close &&
    third.close > second.close &&
    second.open > first.open && second.open < first.close &&
    third.open > second.open && third.open < second.close &&
    getBodyRatio(first) > BODY_THRESHOLD &&
    getBodyRatio(second) > BODY_THRESHOLD &&
    getBodyRatio(third) > BODY_THRESHOLD
  );
}

export function detectThreeBlackCrows(candles: Candle[]): boolean {
  if (candles.length < 3) return false;
  const [first, second, third] = candles.slice(-3);
  
  return (
    isBearish(first) && isBearish(second) && isBearish(third) &&
    second.close < first.close &&
    third.close < second.close &&
    second.open < first.open && second.open > first.close &&
    third.open < second.open && third.open > second.close &&
    getBodyRatio(first) > BODY_THRESHOLD &&
    getBodyRatio(second) > BODY_THRESHOLD &&
    getBodyRatio(third) > BODY_THRESHOLD
  );
}

export function detectInsideBar(candles: Candle[]): boolean {
  if (candles.length < 2) return false;
  const curr = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  
  return curr.high < prev.high && curr.low > prev.low;
}

export function detectSpinningTop(candles: Candle[]): boolean {
  if (candles.length < 1) return false;
  const candle = candles[candles.length - 1];
  
  const body = getBody(candle);
  const upperWick = getUpperWick(candle);
  const lowerWick = getLowerWick(candle);
  const range = getRange(candle);
  
  // Small body in the middle with wicks on both sides
  return (
    body / range < 0.3 &&
    upperWick / range > 0.2 &&
    lowerWick / range > 0.2 &&
    Math.abs(upperWick - lowerWick) / range < 0.2
  );
}
