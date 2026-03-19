
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BINANCE_API = "https://api.binance.com/api/v3";

// ==================== TYPES ====================
interface Candle {
  openTime: number; open: number; high: number; low: number; close: number;
  volume: number; closeTime: number; quoteVolume: number;
}
interface SwingPoint { index: number; price: number; type: "high" | "low"; }
interface AnalysisResult {
  signalType: string; trend: string; confidence: number;
  entryPrice: number; stopLoss: number; tp1: number; tp2: number; tp3: number;
  riskReward: number; reasons: string[]; indicatorData: Record<string, any>;
}

// ==================== BINANCE DATA ====================
async function fetchKlines(symbol: string, interval: string, limit = 500): Promise<Candle[]> {
  const res = await fetch(`${BINANCE_API}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
  if (!res.ok) throw new Error(`Binance API error: ${res.status}`);
  const data = await res.json();
  return data.map((k: any[]) => ({
    openTime: k[0], open: +k[1], high: +k[2], low: +k[3], close: +k[4],
    volume: +k[5], closeTime: k[6], quoteVolume: +k[7],
  }));
}

// ==================== INDICATORS ====================
function wilderSmooth(values: number[], period: number): number[] {
  const r: number[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    if (i < period) { sum += values[i]; r.push(i === period - 1 ? sum / period : NaN); }
    else { r.push((r[i - 1] * (period - 1) + values[i]) / period); }
  }
  return r;
}

function calcEMA(closes: number[], period: number): number[] {
  const r: number[] = [];
  const mult = 2 / (period + 1);
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) { r.push(NaN); }
    else if (i === period - 1) {
      let s = 0; for (let j = 0; j < period; j++) s += closes[j]; r.push(s / period);
    } else { r.push((closes[i] - r[i - 1]) * mult + r[i - 1]); }
  }
  return r;
}

function calcRSI(candles: Candle[], period = 14): number[] {
  const gains: number[] = [0], losses: number[] = [0];
  for (let i = 1; i < candles.length; i++) {
    const d = candles[i].close - candles[i - 1].close;
    gains.push(d > 0 ? d : 0);
    losses.push(d < 0 ? -d : 0);
  }
  const avgGain = wilderSmooth(gains, period);
  const avgLoss = wilderSmooth(losses, period);
  return avgGain.map((g, i) => {
    if (isNaN(g) || isNaN(avgLoss[i]) || avgLoss[i] === 0) return avgLoss[i] === 0 ? 100 : NaN;
    return 100 - 100 / (1 + g / avgLoss[i]);
  });
}

function calcATR(candles: Candle[], period = 14): number[] {
  const trs: number[] = [candles[0].high - candles[0].low];
  for (let i = 1; i < candles.length; i++) {
    trs.push(Math.max(candles[i].high - candles[i].low, Math.abs(candles[i].high - candles[i - 1].close), Math.abs(candles[i].low - candles[i - 1].close)));
  }
  return wilderSmooth(trs, period);
}

function calcMACD(candles: Candle[]): { macd: number[]; signal: number[]; histogram: number[] } {
  const closes = candles.map(c => c.close);
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const macdLine = ema12.map((v, i) => (isNaN(v) || isNaN(ema26[i])) ? NaN : v - ema26[i]);
  const validMacd = macdLine.filter(v => !isNaN(v));
  const sig = calcEMA(validMacd, 9);
  const signal: number[] = [];
  let vi = 0;
  for (let i = 0; i < macdLine.length; i++) {
    if (isNaN(macdLine[i])) { signal.push(NaN); }
    else { signal.push(vi < sig.length ? sig[vi] : NaN); vi++; }
  }
  const histogram = macdLine.map((v, i) => (isNaN(v) || isNaN(signal[i])) ? NaN : v - signal[i]);
  return { macd: macdLine, signal, histogram };
}

function calcSupertrend(candles: Candle[], period = 10, mult = 3): { trend: boolean[]; values: number[] } {
  const atr = calcATR(candles, period);
  const trends: boolean[] = [];
  const vals: number[] = [];
  let prevUp = 0, prevDn = 0, prevTrend = true;
  for (let i = 0; i < candles.length; i++) {
    if (isNaN(atr[i])) { trends.push(true); vals.push(NaN); continue; }
    const hl2 = (candles[i].high + candles[i].low) / 2;
    let up = hl2 - mult * atr[i];
    let dn = hl2 + mult * atr[i];
    up = (i > 0 && prevUp > 0) ? Math.max(up, prevUp) : up;
    dn = (i > 0 && prevDn > 0) ? Math.min(dn, prevDn) : dn;
    let trend: boolean;
    if (i === 0) trend = true;
    else if (prevTrend && candles[i].close < prevUp) trend = false;
    else if (!prevTrend && candles[i].close > prevDn) trend = true;
    else trend = prevTrend;
    trends.push(trend);
    vals.push(trend ? up : dn);
    prevUp = up; prevDn = dn; prevTrend = trend;
  }
  return { trend: trends, values: vals };
}

// ==================== STRUCTURE ANALYSIS ====================
function findSwingPoints(candles: Candle[], lookback = 5): SwingPoint[] {
  const pts: SwingPoint[] = [];
  for (let i = lookback; i < candles.length - lookback; i++) {
    let isHigh = true, isLow = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j !== i) {
        if (candles[j].high >= candles[i].high) isHigh = false;
        if (candles[j].low <= candles[i].low) isLow = false;
      }
    }
    if (isHigh) pts.push({ index: i, price: candles[i].high, type: "high" });
    if (isLow) pts.push({ index: i, price: candles[i].low, type: "low" });
  }
  return pts;
}

function detectTrend(candles: Candle[]): { trend: "uptrend" | "downtrend" | "sideways"; swings: SwingPoint[] } {
  const swings = findSwingPoints(candles, 3);
  const highs = swings.filter(s => s.type === "high").slice(-4);
  const lows = swings.filter(s => s.type === "low").slice(-4);

  let hhCount = 0, hlCount = 0, lhCount = 0, llCount = 0;
  for (let i = 1; i < highs.length; i++) {
    if (highs[i].price > highs[i - 1].price) hhCount++;
    else lhCount++;
  }
  for (let i = 1; i < lows.length; i++) {
    if (lows[i].price > lows[i - 1].price) hlCount++;
    else llCount++;
  }

  if (hhCount >= 2 && hlCount >= 2) return { trend: "uptrend", swings };
  if (lhCount >= 2 && llCount >= 2) return { trend: "downtrend", swings };
  return { trend: "sideways", swings };
}

// ==================== SMC DETECTION ====================
function detectBOS(candles: Candle[], swings: SwingPoint[]): { bullish: boolean; bearish: boolean } {
  const last = candles[candles.length - 1];
  const highs = swings.filter(s => s.type === "high").slice(-3);
  const lows = swings.filter(s => s.type === "low").slice(-3);
  const bullish = highs.length > 0 && last.close > highs[highs.length - 1].price;
  const bearish = lows.length > 0 && last.close < lows[lows.length - 1].price;
  return { bullish, bearish };
}

function detectChoCH(candles: Candle[], swings: SwingPoint[]): { bullish: boolean; bearish: boolean } {
  const highs = swings.filter(s => s.type === "high").slice(-4);
  const lows = swings.filter(s => s.type === "low").slice(-4);
  const last = candles[candles.length - 1];

  // Bullish ChoCH: was making LH/LL, now breaks above a swing high
  let bearishStructure = false;
  if (highs.length >= 2) {
    const lastTwo = highs.slice(-2);
    if (lastTwo[1].price < lastTwo[0].price) bearishStructure = true;
  }
  const bullish = bearishStructure && highs.length > 0 && last.close > highs[highs.length - 1].price;

  let bullishStructure = false;
  if (lows.length >= 2) {
    const lastTwo = lows.slice(-2);
    if (lastTwo[1].price > lastTwo[0].price) bullishStructure = true;
  }
  const bearish = bullishStructure && lows.length > 0 && last.close < lows[lows.length - 1].price;

  return { bullish, bearish };
}

function detectOrderBlocks(candles: Candle[]): { bullishOB: number | null; bearishOB: number | null } {
  let bullishOB: number | null = null;
  let bearishOB: number | null = null;
  const recent = candles.slice(-30);

  for (let i = 1; i < recent.length - 1; i++) {
    const prev = recent[i - 1]; const curr = recent[i]; const next = recent[i + 1];
    // Bullish OB: bearish candle followed by strong bullish move
    if (curr.close < curr.open && next.close > next.open && next.close > curr.high) {
      bullishOB = curr.low;
    }
    // Bearish OB: bullish candle followed by strong bearish move
    if (curr.close > curr.open && next.close < next.open && next.close < curr.low) {
      bearishOB = curr.high;
    }
  }
  return { bullishOB, bearishOB };
}

function detectFVG(candles: Candle[]): { bullishFVG: boolean; bearishFVG: boolean } {
  if (candles.length < 3) return { bullishFVG: false, bearishFVG: false };
  const c = candles.slice(-5);
  let bullishFVG = false, bearishFVG = false;
  for (let i = 2; i < c.length; i++) {
    if (c[i].low > c[i - 2].high) bullishFVG = true; // gap up
    if (c[i].high < c[i - 2].low) bearishFVG = true; // gap down
  }
  return { bullishFVG, bearishFVG };
}

function detectLiquiditySweep(candles: Candle[], swings: SwingPoint[]): { sweepHigh: boolean; sweepLow: boolean } {
  const last = candles[candles.length - 1];
  const highs = swings.filter(s => s.type === "high").slice(-5);
  const lows = swings.filter(s => s.type === "low").slice(-5);

  // Sweep high: wick above swing high but close below
  const sweepHigh = highs.some(h => last.high > h.price && last.close < h.price);
  const sweepLow = lows.some(l => last.low < l.price && last.close > l.price);
  return { sweepHigh, sweepLow };
}

// ==================== PATTERN DETECTION ====================
function detectPatterns(candles: Candle[]): string[] {
  const patterns: string[] = [];
  const c = candles[candles.length - 1];
  const p = candles[candles.length - 2];
  const range = c.high - c.low;
  if (range === 0) return patterns;

  const bodyRatio = Math.abs(c.close - c.open) / range;
  const lowerWick = (Math.min(c.open, c.close) - c.low) / range;
  const upperWick = (c.high - Math.max(c.open, c.close)) / range;
  const isBull = c.close > c.open;
  const isPBear = p.close < p.open;

  // Doji
  if (bodyRatio < 0.1) patterns.push("Doji");
  // Hammer
  if (lowerWick > 0.6 && bodyRatio < 0.3 && upperWick < 0.1 && isPBear) patterns.push("Hammer");
  // Shooting Star
  if (upperWick > 0.6 && bodyRatio < 0.3 && lowerWick < 0.1) patterns.push("Shooting Star");
  // Bullish Engulfing
  if (isBull && isPBear && c.open <= p.close && c.close >= p.open) patterns.push("Bullish Engulfing");
  // Bearish Engulfing
  if (!isBull && !isPBear && c.open >= p.close && c.close <= p.open) patterns.push("Bearish Engulfing");
  // Morning Star (3 candles)
  if (candles.length >= 3) {
    const pp = candles[candles.length - 3];
    if (pp.close < pp.open && Math.abs(p.close - p.open) / (p.high - p.low || 1) < 0.3 && isBull && c.close > (pp.open + pp.close) / 2) {
      patterns.push("Morning Star");
    }
  }

  return patterns;
}

// ==================== TRAP/PULLBACK DETECTION ====================
function detectTrap(candles: Candle[], trend: string, ema20: number[], ema50: number[]): { isTrap: boolean; reason: string } {
  const last = candles.length - 1;
  const price = candles[last].close;
  const e20 = ema20[last];
  const e50 = ema50[last];

  if (trend === "uptrend") {
    // In uptrend, if price dips below EMA20 but stays above EMA50
    // and volume is decreasing → valid pullback, not reversal
    if (price < e20 && price > e50) {
      // Check if recent bearish volume is declining
      const recentBearVol = candles.slice(-5).filter(c => c.close < c.open).map(c => c.volume);
      const prevBearVol = candles.slice(-10, -5).filter(c => c.close < c.open).map(c => c.volume);
      const avgRecent = recentBearVol.length > 0 ? recentBearVol.reduce((a, b) => a + b, 0) / recentBearVol.length : 0;
      const avgPrev = prevBearVol.length > 0 ? prevBearVol.reduce((a, b) => a + b, 0) / prevBearVol.length : Infinity;

      if (avgRecent < avgPrev) {
        return { isTrap: true, reason: "Valid pullback in uptrend - bearish volume declining, BUY opportunity" };
      }
    }
  }

  if (trend === "downtrend") {
    if (price > e20 && price < e50) {
      const recentBullVol = candles.slice(-5).filter(c => c.close > c.open).map(c => c.volume);
      const prevBullVol = candles.slice(-10, -5).filter(c => c.close > c.open).map(c => c.volume);
      const avgRecent = recentBullVol.length > 0 ? recentBullVol.reduce((a, b) => a + b, 0) / recentBullVol.length : 0;
      const avgPrev = prevBullVol.length > 0 ? prevBullVol.reduce((a, b) => a + b, 0) / prevBullVol.length : Infinity;

      if (avgRecent < avgPrev) {
        return { isTrap: true, reason: "Valid pullback in downtrend - bullish volume declining, SELL opportunity" };
      }
    }
  }

  return { isTrap: false, reason: "" };
}

// ==================== CONSOLIDATION DETECTION ====================
function detectConsolidation(candles: Candle[], ema20: number[], atr: number[]): { isConsolidating: boolean; reason: string } {
  const last = candles.length - 1;
  const price = candles[last].close;
  const e20 = ema20[last];
  const currentATR = atr[last];

  // Price within 0.5% of EMA20
  const distFromEMA = Math.abs(price - e20) / price;
  if (distFromEMA > 0.005) return { isConsolidating: false, reason: "" };

  // Check if last 10 candles have small range relative to ATR
  const recentRanges = candles.slice(-10).map(c => c.high - c.low);
  const avgRange = recentRanges.reduce((a, b) => a + b, 0) / recentRanges.length;

  if (avgRange < currentATR * 0.7) {
    return { isConsolidating: true, reason: "Price consolidating near EMA20 - potential breakout incoming" };
  }

  return { isConsolidating: false, reason: "" };
}

// ==================== MAIN ANALYSIS ====================
function analyzeSymbol(candles: Candle[]): AnalysisResult | null {
  if (candles.length < 100) return null;

  const closes = candles.map(c => c.close);
  const price = candles[candles.length - 1].close;
  const last = candles.length - 1;

  // Calculate indicators
  const ema20 = calcEMA(closes, 20);
  const ema50 = calcEMA(closes, 50);
  const rsi = calcRSI(candles);
  const atr = calcATR(candles);
  const macd = calcMACD(candles);
  const supertrend = calcSupertrend(candles);

  // Detect trend via structure
  const { trend, swings } = detectTrend(candles);

  // EMA confirmation
  const emaConfirm = (trend === "uptrend" && ema20[last] > ema50[last] && price > ema20[last]) ||
    (trend === "downtrend" && ema20[last] < ema50[last] && price < ema20[last]);

  // If trend not confirmed by EMA, check deeper
  if (!emaConfirm && trend !== "sideways") {
    // Check if it's a valid pullback / trap
    const trap = detectTrap(candles, trend, ema20, ema50);
    if (trap.isTrap) {
      // This is a pullback opportunity
      const reasons: string[] = [
        `📊 Trend: ${trend.toUpperCase()} (Structure confirmed)`,
        `🔄 ${trap.reason}`,
      ];

      const currentATR = atr[last] || 0;
      const entry = price;
      let sl: number, tp1: number, tp2: number, tp3: number;

      if (trend === "uptrend") {
        sl = Math.max(price - currentATR * 1.5, ema50[last] - currentATR * 0.3);
        tp1 = price + currentATR * 1.5;
        tp2 = price + currentATR * 2.5;
        tp3 = price + currentATR * 4;
        reasons.push("🎯 BUY at pullback - trend continuation expected");
      } else {
        sl = Math.min(price + currentATR * 1.5, ema50[last] + currentATR * 0.3);
        tp1 = price - currentATR * 1.5;
        tp2 = price - currentATR * 2.5;
        tp3 = price - currentATR * 4;
        reasons.push("🎯 SELL at pullback - trend continuation expected");
      }

      const risk = Math.abs(price - sl);
      const reward = Math.abs(tp1 - price);
      const rr = risk > 0 ? Math.round((reward / risk) * 100) / 100 : 0;

      return {
        signalType: trend === "uptrend" ? "buy" : "sell",
        trend, confidence: 65,
        entryPrice: entry, stopLoss: sl, tp1, tp2, tp3,
        riskReward: rr,
        reasons,
        indicatorData: {
          rsi: rsi[last], ema20: ema20[last], ema50: ema50[last],
          atr: currentATR, macd_histogram: macd.histogram[last],
          supertrend_bullish: supertrend.trend[last],
        },
      };
    }
  }

  // SMC Analysis
  const bos = detectBOS(candles, swings);
  const choch = detectChoCH(candles, swings);
  const ob = detectOrderBlocks(candles);
  const fvg = detectFVG(candles);
  const sweep = detectLiquiditySweep(candles, swings);
  const patterns = detectPatterns(candles);
  const consolidation = detectConsolidation(candles, ema20, atr);

  // Build signals
  const reasons: string[] = [];
  let buyScore = 0, sellScore = 0;
  const currentATR = atr[last] || 0;

  // Trend direction scoring
  if (trend === "uptrend") { buyScore += 25; reasons.push("📈 Uptrend confirmed (HH/HL structure)"); }
  if (trend === "downtrend") { sellScore += 25; reasons.push("📉 Downtrend confirmed (LH/LL structure)"); }

  // EMA confirmation
  if (emaConfirm) {
    if (trend === "uptrend") { buyScore += 15; reasons.push("✅ EMA20 > EMA50, Price > EMA20"); }
    if (trend === "downtrend") { sellScore += 15; reasons.push("✅ EMA20 < EMA50, Price < EMA20"); }
  }

  // Consolidation near EMA
  if (consolidation.isConsolidating) {
    buyScore += 10; reasons.push(`🔄 ${consolidation.reason}`);
  }

  // RSI
  const rsiVal = rsi[last];
  if (!isNaN(rsiVal)) {
    if (rsiVal < 35) { buyScore += 10; reasons.push(`📊 RSI oversold: ${rsiVal.toFixed(1)}`); }
    if (rsiVal > 65) { sellScore += 10; reasons.push(`📊 RSI overbought: ${rsiVal.toFixed(1)}`); }
  }

  // MACD
  const macdHist = macd.histogram[last];
  if (!isNaN(macdHist)) {
    const prevHist = macd.histogram[last - 1];
    if (macdHist > 0 && prevHist <= 0) { buyScore += 10; reasons.push("📊 MACD bullish crossover"); }
    if (macdHist < 0 && prevHist >= 0) { sellScore += 10; reasons.push("📊 MACD bearish crossover"); }
  }

  // Supertrend
  if (supertrend.trend[last]) { buyScore += 10; reasons.push("📊 Supertrend: Bullish"); }
  else { sellScore += 10; reasons.push("📊 Supertrend: Bearish"); }

  // SMC signals
  if (bos.bullish) { buyScore += 15; reasons.push("🏦 Bullish Break of Structure (BOS)"); }
  if (bos.bearish) { sellScore += 15; reasons.push("🏦 Bearish Break of Structure (BOS)"); }
  if (choch.bullish) { buyScore += 20; reasons.push("🔄 Bullish Change of Character (ChoCH)"); }
  if (choch.bearish) { sellScore += 20; reasons.push("🔄 Bearish Change of Character (ChoCH)"); }

  if (ob.bullishOB && price <= ob.bullishOB * 1.01) {
    buyScore += 15; reasons.push(`🏦 Price at Bullish Order Block: ${ob.bullishOB.toFixed(2)}`);
  }
  if (ob.bearishOB && price >= ob.bearishOB * 0.99) {
    sellScore += 15; reasons.push(`🏦 Price at Bearish Order Block: ${ob.bearishOB.toFixed(2)}`);
  }

  if (fvg.bullishFVG) { buyScore += 10; reasons.push("📊 Bullish Fair Value Gap detected"); }
  if (fvg.bearishFVG) { sellScore += 10; reasons.push("📊 Bearish Fair Value Gap detected"); }

  if (sweep.sweepLow) { buyScore += 15; reasons.push("💧 Liquidity sweep below low - potential reversal UP"); }
  if (sweep.sweepHigh) { sellScore += 15; reasons.push("💧 Liquidity sweep above high - potential reversal DOWN"); }

  // Price action patterns
  const bullishPatterns = ["Hammer", "Bullish Engulfing", "Morning Star"];
  const bearishPatterns = ["Shooting Star", "Bearish Engulfing"];
  for (const p of patterns) {
    if (bullishPatterns.includes(p)) { buyScore += 10; reasons.push(`🕯️ ${p} pattern detected`); }
    if (bearishPatterns.includes(p)) { sellScore += 10; reasons.push(`🕯️ ${p} pattern detected`); }
    if (p === "Doji") reasons.push("🕯️ Doji - indecision");
  }

  // Only signal if direction matches trend (or sideways)
  const isBuySignal = buyScore >= 40;
  const isSellSignal = sellScore >= 40;

  // Counter-trend filter
  if (isBuySignal && trend === "downtrend") {
    // Check if this is a valid reversal (ChoCH needed)
    if (!choch.bullish) return null; // Not confirmed reversal
    reasons.push("⚠️ Counter-trend BUY - ChoCH confirms potential reversal");
  }
  if (isSellSignal && trend === "uptrend") {
    if (!choch.bearish) return null;
    reasons.push("⚠️ Counter-trend SELL - ChoCH confirms potential reversal");
  }

  if (!isBuySignal && !isSellSignal) return null;

  // Calculate levels
  const isBuy = buyScore > sellScore;
  const entry = price;
  let sl: number, tp1: number, tp2: number, tp3: number;
  const swingHighs = swings.filter(s => s.type === "high").map(s => s.price);
  const swingLows = swings.filter(s => s.type === "low").map(s => s.price);

  if (isBuy) {
    const nearSupport = swingLows.filter(l => l < price).sort((a, b) => b - a)[0] || price - currentATR * 1.5;
    sl = Math.max(nearSupport - currentATR * 0.3, price - currentATR * 2);
    const nearRes = swingHighs.filter(h => h > price).sort((a, b) => a - b);
    tp1 = nearRes[0] || price + currentATR * 1.5;
    tp2 = nearRes[1] || price + currentATR * 2.5;
    tp3 = nearRes[2] || price + currentATR * 4;
  } else {
    const nearRes = swingHighs.filter(h => h > price).sort((a, b) => a - b)[0] || price + currentATR * 1.5;
    sl = Math.min(nearRes + currentATR * 0.3, price + currentATR * 2);
    const nearSup = swingLows.filter(l => l < price).sort((a, b) => b - a);
    tp1 = nearSup[0] || price - currentATR * 1.5;
    tp2 = nearSup[1] || price - currentATR * 2.5;
    tp3 = nearSup[2] || price - currentATR * 4;
  }

  const risk = Math.abs(price - sl);
  const reward = Math.abs(tp1 - price);
  const rr = risk > 0 ? Math.round((reward / risk) * 100) / 100 : 0;
  const confidence = Math.min(95, Math.max(isBuy ? buyScore : sellScore, 40));
  const signalType = isBuy ? (confidence >= 70 ? "strong_buy" : "buy") : (confidence >= 70 ? "strong_sell" : "sell");

  return {
    signalType, trend, confidence,
    entryPrice: entry, stopLoss: sl, tp1, tp2, tp3,
    riskReward: rr, reasons,
    indicatorData: {
      rsi: rsiVal, ema20: ema20[last], ema50: ema50[last],
      atr: currentATR, macd_histogram: macdHist,
      supertrend_bullish: supertrend.trend[last],
      patterns, bos, choch, fvg, sweep,
    },
  };
}

// ==================== MAIN HANDLER ====================
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get timeframe from request body or default
    const body = await req.json().catch(() => ({}));
    const timeframe = body.timeframe || "15m";

    // Map timeframe to Binance interval
    const tfMap: Record<string, string> = {
      "1d": "1d", "4h": "4h", "1h": "1h", "15m": "15m", "5m": "5m", "3m": "3m",
    };
    const interval = tfMap[timeframe] || "15m";

    // Get all unique symbols from all users' watchlists
    const { data: watchlistData, error: wlError } = await supabase
      .from("watchlist_coins")
      .select("user_id, symbol");

    if (wlError) throw new Error(`Watchlist fetch error: ${wlError.message}`);
    if (!watchlistData || watchlistData.length === 0) {
      return new Response(JSON.stringify({ message: "No watchlist coins found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group by symbol to avoid fetching same data multiple times
    const symbolUsers = new Map<string, string[]>();
    for (const item of watchlistData) {
      if (!symbolUsers.has(item.symbol)) symbolUsers.set(item.symbol, []);
      symbolUsers.get(item.symbol)!.push(item.user_id);
    }

    const signals: any[] = [];
    const errors: string[] = [];

    // Analyze each symbol
    for (const [symbol, userIds] of symbolUsers.entries()) {
      try {
        const candles = await fetchKlines(symbol, interval, 500);
        const result = analyzeSymbol(candles);

        if (result) {
          // Create signal for each user who has this symbol
          for (const userId of userIds) {
            // Check if we already sent a signal for this symbol/timeframe recently (within same candle period)
            const cooldownMinutes: Record<string, number> = {
              "1d": 1440, "4h": 240, "1h": 60, "15m": 15, "5m": 5, "3m": 3,
            };
            const cooldown = cooldownMinutes[timeframe] || 15;

            const { data: existingSignal } = await supabase
              .from("analysis_signals")
              .select("id")
              .eq("user_id", userId)
              .eq("symbol", symbol)
              .eq("timeframe", timeframe)
              .gte("created_at", new Date(Date.now() - cooldown * 60 * 1000).toISOString())
              .limit(1);

            if (existingSignal && existingSignal.length > 0) continue; // Already notified

            const signal = {
              user_id: userId,
              symbol,
              timeframe,
              signal_type: result.signalType,
              trend: result.trend,
              confidence: result.confidence,
              entry_price: result.entryPrice,
              stop_loss: result.stopLoss,
              take_profit_1: result.tp1,
              take_profit_2: result.tp2,
              take_profit_3: result.tp3,
              risk_reward: result.riskReward,
              reasons: result.reasons,
              indicator_data: result.indicatorData,
            };

            const { error: insertError } = await supabase
              .from("analysis_signals")
              .insert(signal);

            if (insertError) {
              errors.push(`Insert error for ${symbol}/${userId}: ${insertError.message}`);
            } else {
              signals.push({ symbol, userId, signalType: result.signalType, timeframe });
            }
          }
        }

        // Small delay to avoid Binance rate limit
        await new Promise(r => setTimeout(r, 200));
      } catch (err) {
        errors.push(`Analysis error for ${symbol}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Send push notifications for new signals
    if (signals.length > 0) {
      for (const sig of signals) {
        try {
          const { data: subs } = await supabase
            .from("push_subscriptions")
            .select("*")
            .eq("user_id", sig.userId);

          if (subs && subs.length > 0) {
            // We'll handle push in a separate function for web-push
            console.log(`Would send push to ${subs.length} subscriptions for ${sig.symbol}`);
          }
        } catch (e) {
          // Push errors shouldn't stop the flow
          console.error("Push notification error:", e);
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      signalsGenerated: signals.length,
      symbolsAnalyzed: symbolUsers.size,
      timeframe,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Auto-analyze error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
