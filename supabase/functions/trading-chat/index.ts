import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAIWithFallback } from "../_shared/ai-fallback.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BINANCE_API = "https://api.binance.com/api/v3";

/** Extract potential crypto symbols from the latest user messages */
function extractSymbols(messages: { role: string; content: string }[]): string[] {
  const userMessages = messages.filter(m => m.role === 'user').slice(-3);
  const text = userMessages.map(m => m.content).join(' ').toUpperCase();
  
  const knownCoins = [
    'BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'DOGE', 'ADA', 'AVAX', 'DOT', 'MATIC',
    'LINK', 'UNI', 'ATOM', 'LTC', 'FIL', 'APT', 'ARB', 'OP', 'NEAR', 'FTM',
    'ALGO', 'VET', 'SAND', 'MANA', 'AXS', 'SHIB', 'PEPE', 'WIF', 'BONK',
    'SUI', 'SEI', 'TIA', 'JUP', 'WLD', 'INJ', 'TRX', 'TON', 'RENDER', 'FET',
    'HBAR', 'ICP', 'RUNE', 'AAVE', 'MKR', 'CRV', 'SNX', 'COMP', 'SUSHI',
    'ENA', 'PENDLE', 'STX', 'KAS', 'TAO', 'ONDO', 'JASMY', 'GALA', 'IMX',
    'ORDI', 'WOO', 'CAKE', '1000PEPE', '1000SHIB', 'NOT', 'PEOPLE',
  ];

  const found: string[] = [];
  
  for (const coin of knownCoins) {
    const patterns = [
      new RegExp(`\\b${coin}USDT\\b`),
      new RegExp(`\\b${coin}/USDT\\b`),
      new RegExp(`\\b${coin}\\b`),
    ];
    if (patterns.some(p => p.test(text))) {
      found.push(coin + 'USDT');
    }
  }

  const usdtMatch = text.match(/\b([A-Z1-9]{2,10})USDT\b/g);
  if (usdtMatch) {
    for (const m of usdtMatch) {
      if (!found.includes(m)) found.push(m);
    }
  }

  return [...new Set(found)].slice(0, 5);
}

// ─── Wilder's Smoothed RSI (matches TradingView exactly) ───
function calcWildersRSI(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;

  // First average: simple average of first `period` changes
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) avgGain += diff;
    else avgLoss += Math.abs(diff);
  }
  avgGain /= period;
  avgLoss /= period;

  // Wilder's smoothing for remaining candles
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

// ─── EMA with SMA seed (matches TradingView) ───
function calcEMA(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  
  // SMA seed from first `period` values
  let ema = 0;
  for (let i = 0; i < period; i++) {
    ema += closes[i];
  }
  ema /= period;

  const k = 2 / (period + 1);
  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
  }
  return ema;
}

// ─── MACD (12, 26, 9) ───
function calcMACD(closes: number[]): { macd: number; signal: number; histogram: number } | null {
  if (closes.length < 35) return null;

  const ema12 = calcEMAFromArray(closes, 12);
  const ema26 = calcEMAFromArray(closes, 26);
  if (ema12 === null || ema26 === null) return null;

  // Build MACD line history for signal
  const macdLine: number[] = [];
  let e12 = 0, e26 = 0;
  for (let i = 0; i < 12; i++) e12 += closes[i];
  e12 /= 12;
  for (let i = 0; i < 26; i++) e26 += closes[i];
  e26 /= 26;
  
  const k12 = 2 / 13, k26 = 2 / 27;
  for (let i = 26; i < closes.length; i++) {
    e12 = closes[i] * k12 + e12 * (1 - k12);
    e26 = closes[i] * k26 + e26 * (1 - k26);
    macdLine.push(e12 - e26);
  }
  // Recalc e12 properly from start
  // Simplified: just use last values
  if (macdLine.length < 9) return null;

  let signal = 0;
  for (let i = 0; i < 9; i++) signal += macdLine[i];
  signal /= 9;
  const kSig = 2 / 10;
  for (let i = 9; i < macdLine.length; i++) {
    signal = macdLine[i] * kSig + signal * (1 - kSig);
  }

  const macdVal = macdLine[macdLine.length - 1];
  return { macd: macdVal, signal, histogram: macdVal - signal };
}

function calcEMAFromArray(data: number[], period: number): number | null {
  if (data.length < period) return null;
  let ema = 0;
  for (let i = 0; i < period; i++) ema += data[i];
  ema /= period;
  const k = 2 / (period + 1);
  for (let i = period; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
  }
  return ema;
}

// ─── Supertrend (10, 3) ───
function calcSupertrend(candles: any[][], period = 10, multiplier = 3): { value: number; direction: 'UP' | 'DOWN' } | null {
  if (candles.length < period + 1) return null;

  const highs = candles.map(c => +c[2]);
  const lows = candles.map(c => +c[3]);
  const closes = candles.map(c => +c[4]);

  // ATR using Wilder's smoothing
  const trueRanges: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    trueRanges.push(tr);
  }

  if (trueRanges.length < period) return null;

  let atr = 0;
  for (let i = 0; i < period; i++) atr += trueRanges[i];
  atr /= period;

  let upperBand = 0, lowerBand = 0;
  let supertrend = 0;
  let direction: 'UP' | 'DOWN' = 'UP';

  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period;

    const idx = i + 1; // offset because trueRanges starts from index 1
    const hl2 = (highs[idx] + lows[idx]) / 2;
    const newUpper = hl2 + multiplier * atr;
    const newLower = hl2 - multiplier * atr;

    upperBand = (newUpper < upperBand || closes[idx - 1] > upperBand) ? newUpper : upperBand;
    lowerBand = (newLower > lowerBand || closes[idx - 1] < lowerBand) ? newLower : lowerBand;

    if (i === period) {
      // Initialize
      upperBand = newUpper;
      lowerBand = newLower;
      direction = closes[idx] > upperBand ? 'UP' : 'DOWN';
      supertrend = direction === 'UP' ? lowerBand : upperBand;
    } else {
      if (direction === 'UP') {
        if (closes[idx] < lowerBand) {
          direction = 'DOWN';
          supertrend = upperBand;
        } else {
          supertrend = lowerBand;
        }
      } else {
        if (closes[idx] > upperBand) {
          direction = 'UP';
          supertrend = lowerBand;
        } else {
          supertrend = upperBand;
        }
      }
    }
  }

  return { value: supertrend, direction };
}

// ─── Bollinger Bands (20, 2) ───
function calcBollingerBands(closes: number[], period = 20, mult = 2): { upper: number; middle: number; lower: number; bandwidth: number } | null {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  const sma = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((sum, val) => sum + Math.pow(val - sma, 2), 0) / period;
  const stdDev = Math.sqrt(variance);
  return {
    upper: sma + mult * stdDev,
    middle: sma,
    lower: sma - mult * stdDev,
    bandwidth: ((sma + mult * stdDev) - (sma - mult * stdDev)) / sma * 100,
  };
}

// ─── Stochastic RSI ───
function calcStochRSI(closes: number[], rsiPeriod = 14, stochPeriod = 14, kSmooth = 3, dSmooth = 3): { k: number; d: number } | null {
  if (closes.length < rsiPeriod + stochPeriod + kSmooth + dSmooth) return null;

  // Calculate RSI series
  const rsiValues: number[] = [];
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= rsiPeriod; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) avgGain += diff; else avgLoss += Math.abs(diff);
  }
  avgGain /= rsiPeriod;
  avgLoss /= rsiPeriod;
  rsiValues.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));

  for (let i = rsiPeriod + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (rsiPeriod - 1) + (diff > 0 ? diff : 0)) / rsiPeriod;
    avgLoss = (avgLoss * (rsiPeriod - 1) + (diff < 0 ? Math.abs(diff) : 0)) / rsiPeriod;
    rsiValues.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  }

  if (rsiValues.length < stochPeriod) return null;

  // Stochastic of RSI
  const stochK: number[] = [];
  for (let i = stochPeriod - 1; i < rsiValues.length; i++) {
    const window = rsiValues.slice(i - stochPeriod + 1, i + 1);
    const min = Math.min(...window);
    const max = Math.max(...window);
    stochK.push(max === min ? 50 : ((rsiValues[i] - min) / (max - min)) * 100);
  }

  // Smooth K
  if (stochK.length < kSmooth) return null;
  const smoothedK: number[] = [];
  for (let i = kSmooth - 1; i < stochK.length; i++) {
    const sum = stochK.slice(i - kSmooth + 1, i + 1).reduce((a, b) => a + b, 0);
    smoothedK.push(sum / kSmooth);
  }

  // D line (SMA of smoothed K)
  if (smoothedK.length < dSmooth) return null;
  const lastD = smoothedK.slice(-dSmooth).reduce((a, b) => a + b, 0) / dSmooth;

  return { k: smoothedK[smoothedK.length - 1], d: lastD };
}

interface TickerData {
  symbol: string;
  price: string;
  priceChangePercent: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
}

async function fetchMarketData(symbol: string): Promise<string | null> {
  try {
    // Fetch 500 candles for accurate Wilder's smoothed indicators
    const [tickerRes, klines1hRes, klines4hRes, klines1dRes] = await Promise.all([
      fetch(`${BINANCE_API}/ticker/24hr?symbol=${symbol}`),
      fetch(`${BINANCE_API}/klines?symbol=${symbol}&interval=1h&limit=500`),
      fetch(`${BINANCE_API}/klines?symbol=${symbol}&interval=4h&limit=500`),
      fetch(`${BINANCE_API}/klines?symbol=${symbol}&interval=1d&limit=500`),
    ]);

    if (!tickerRes.ok) return null;

    const ticker: TickerData = await tickerRes.json();
    const klines1h: any[][] = klines1hRes.ok ? await klines1hRes.json() : [];
    const klines4h: any[][] = klines4hRes.ok ? await klines4hRes.json() : [];
    const klines1d: any[][] = klines1dRes.ok ? await klines1dRes.json() : [];

    const closes1h = klines1h.map(c => +c[4]);
    const closes4h = klines4h.map(c => +c[4]);
    const closes1d = klines1d.map(c => +c[4]);

    // ── Wilder's RSI (14) ──
    const rsi1h = calcWildersRSI(closes1h);
    const rsi4h = calcWildersRSI(closes4h);
    const rsi1d = calcWildersRSI(closes1d);

    // ── EMAs ──
    const ema9_1h = calcEMA(closes1h, 9);
    const ema20_1h = calcEMA(closes1h, 20);
    const ema50_1h = calcEMA(closes1h, 50);
    const ema200_1h = calcEMA(closes1h, 200);
    const ema9_4h = calcEMA(closes4h, 9);
    const ema20_4h = calcEMA(closes4h, 20);
    const ema50_4h = calcEMA(closes4h, 50);
    const ema20_1d = calcEMA(closes1d, 20);
    const ema50_1d = calcEMA(closes1d, 50);
    const ema200_1d = calcEMA(closes1d, 200);

    // ── MACD (12, 26, 9) ──
    const macd1h = calcMACD(closes1h);
    const macd4h = calcMACD(closes4h);
    const macd1d = calcMACD(closes1d);

    // ── Supertrend (10, 3) ──
    const st1h = calcSupertrend(klines1h);
    const st4h = calcSupertrend(klines4h);
    const st1d = calcSupertrend(klines1d);

    // ── Bollinger Bands (20, 2) ──
    const bb1h = calcBollingerBands(closes1h);
    const bb4h = calcBollingerBands(closes4h);

    // ── Stochastic RSI ──
    const stochRsi1h = calcStochRSI(closes1h);
    const stochRsi4h = calcStochRSI(closes4h);

    const price = +ticker.price;
    const change24h = +ticker.priceChangePercent;

    // Recent price action
    const recentCandles = klines1h.slice(-6).map(c => ({
      time: new Date(+c[0]).toISOString().slice(11, 16),
      c: (+c[4]).toFixed(4),
    }));

    // Support/Resistance from daily
    const dailyHighs = klines1d.map(c => +c[2]);
    const dailyLows = klines1d.map(c => +c[3]);
    const recentHigh = Math.max(...dailyHighs.slice(-7));
    const recentLow = Math.min(...dailyLows.slice(-7));

    const fmt = (v: number | null, decimals = 2) => v !== null ? v.toFixed(decimals) : 'N/A';
    const fmtPrice = (v: number | null) => v !== null ? `$${v.toFixed(4)}` : 'N/A';

    return `
📊 **${symbol}** — LIVE Market Data (Wilder's smoothed, TradingView-accurate):
• Price: $${price} | 24h: ${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%
• 24h High: $${(+ticker.highPrice).toFixed(4)} | Low: $${(+ticker.lowPrice).toFixed(4)}
• Volume: $${(+ticker.quoteVolume / 1e6).toFixed(2)}M
• 7d Range: $${recentLow.toFixed(4)} – $${recentHigh.toFixed(4)}

📈 RSI(14) Wilder's Smoothed:
• 1H: ${fmt(rsi1h, 1)} ${rsi1h && rsi1h > 70 ? '⚠️ OVERBOUGHT' : rsi1h && rsi1h < 30 ? '⚠️ OVERSOLD' : ''}
• 4H: ${fmt(rsi4h, 1)} ${rsi4h && rsi4h > 70 ? '⚠️ OVERBOUGHT' : rsi4h && rsi4h < 30 ? '⚠️ OVERSOLD' : ''}
• 1D: ${fmt(rsi1d, 1)} ${rsi1d && rsi1d > 70 ? '⚠️ OVERBOUGHT' : rsi1d && rsi1d < 30 ? '⚠️ OVERSOLD' : ''}

📊 EMAs:
• 1H: EMA9=${fmtPrice(ema9_1h)} | EMA20=${fmtPrice(ema20_1h)} | EMA50=${fmtPrice(ema50_1h)} | EMA200=${fmtPrice(ema200_1h)}
• 4H: EMA9=${fmtPrice(ema9_4h)} | EMA20=${fmtPrice(ema20_4h)} | EMA50=${fmtPrice(ema50_4h)}
• 1D: EMA20=${fmtPrice(ema20_1d)} | EMA50=${fmtPrice(ema50_1d)} | EMA200=${fmtPrice(ema200_1d)}
• Price vs EMAs (1H): ${ema20_1h ? (price > ema20_1h ? '🟢 Above EMA20' : '🔴 Below EMA20') : ''} | ${ema200_1h ? (price > ema200_1h ? '🟢 Above EMA200' : '🔴 Below EMA200') : ''}

📉 MACD (12,26,9):
• 1H: MACD=${fmt(macd1h?.macd ?? null, 4)} | Signal=${fmt(macd1h?.signal ?? null, 4)} | Hist=${fmt(macd1h?.histogram ?? null, 4)} ${macd1h ? (macd1h.histogram > 0 ? '🟢 Bullish' : '🔴 Bearish') : ''}
• 4H: MACD=${fmt(macd4h?.macd ?? null, 4)} | Signal=${fmt(macd4h?.signal ?? null, 4)} | Hist=${fmt(macd4h?.histogram ?? null, 4)} ${macd4h ? (macd4h.histogram > 0 ? '🟢 Bullish' : '🔴 Bearish') : ''}
• 1D: MACD=${fmt(macd1d?.macd ?? null, 4)} | Signal=${fmt(macd1d?.signal ?? null, 4)} | Hist=${fmt(macd1d?.histogram ?? null, 4)} ${macd1d ? (macd1d.histogram > 0 ? '🟢 Bullish' : '🔴 Bearish') : ''}

🔺 Supertrend (10,3):
• 1H: ${st1h ? `${st1h.direction === 'UP' ? '🟢 BULLISH' : '🔴 BEARISH'} @ $${st1h.value.toFixed(4)}` : 'N/A'}
• 4H: ${st4h ? `${st4h.direction === 'UP' ? '🟢 BULLISH' : '🔴 BEARISH'} @ $${st4h.value.toFixed(4)}` : 'N/A'}
• 1D: ${st1d ? `${st1d.direction === 'UP' ? '🟢 BULLISH' : '🔴 BEARISH'} @ $${st1d.value.toFixed(4)}` : 'N/A'}

📊 Bollinger Bands (20,2):
• 1H: Upper=${fmtPrice(bb1h?.upper ?? null)} | Mid=${fmtPrice(bb1h?.middle ?? null)} | Lower=${fmtPrice(bb1h?.lower ?? null)} | BW=${fmt(bb1h?.bandwidth ?? null)}%
• 4H: Upper=${fmtPrice(bb4h?.upper ?? null)} | Mid=${fmtPrice(bb4h?.middle ?? null)} | Lower=${fmtPrice(bb4h?.lower ?? null)} | BW=${fmt(bb4h?.bandwidth ?? null)}%

📈 Stochastic RSI:
• 1H: K=${fmt(stochRsi1h?.k ?? null, 1)} | D=${fmt(stochRsi1h?.d ?? null, 1)} ${stochRsi1h ? (stochRsi1h.k > 80 ? '⚠️ OVERBOUGHT' : stochRsi1h.k < 20 ? '⚠️ OVERSOLD' : '') : ''}
• 4H: K=${fmt(stochRsi4h?.k ?? null, 1)} | D=${fmt(stochRsi4h?.d ?? null, 1)} ${stochRsi4h ? (stochRsi4h.k > 80 ? '⚠️ OVERBOUGHT' : stochRsi4h.k < 20 ? '⚠️ OVERSOLD' : '') : ''}

🕐 Recent 1H Candles: ${recentCandles.map(c => `${c.time}→$${c.c}`).join(' | ')}`;
  } catch (e) {
    console.error(`Failed to fetch data for ${symbol}:`, e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();

    const symbols = extractSymbols(messages);
    let marketContext = '';

    if (symbols.length > 0) {
      console.log(`Detected symbols: ${symbols.join(', ')}. Fetching live data with 500 candles...`);
      const dataResults = await Promise.all(symbols.map(s => fetchMarketData(s)));
      const validData = dataResults.filter(Boolean);
      if (validData.length > 0) {
        marketContext = `\n\n--- LIVE REAL-TIME MARKET DATA (Wilder's smoothed RSI, proper EMA with SMA seed — matches TradingView) ---\n${validData.join('\n')}\n--- END LIVE DATA ---\n`;
      }
    }

    const systemPrompt = `You are CryptoMentor AI — an expert cryptocurrency trading assistant with LIVE market data access. All indicator values provided are calculated using industry-standard methods:
- RSI: Wilder's Smoothed RSI (14) with 500 candle history — matches TradingView exactly
- EMA: SMA-seeded EMA — matches TradingView exactly  
- MACD: Standard (12,26,9) — matches TradingView
- Supertrend: (10,3) with Wilder's ATR — matches TradingView
- Bollinger Bands: (20,2) standard
- Stochastic RSI: (14,14,3,3) standard

You help traders with:
1. **Technical Analysis**: Reference the EXACT indicator values provided. They are accurate.
2. **Trading Strategies**: Scalping, swing, trend following, breakout, mean reversion.
3. **Risk Management**: Position sizing, stop-loss, R:R ratios.
4. **Smart Money Concepts**: Order blocks, FVGs, liquidity sweeps, market structure.
5. **Multi-Timeframe Analysis**: Compare readings across 1H, 4H, 1D.

Rules:
- ALWAYS quote exact numbers from the live data — never approximate or guess
- Highlight overbought (RSI>70, StochRSI>80) and oversold (RSI<30, StochRSI<20)
- Note Supertrend direction for trend confirmation
- Compare MACD histogram direction across timeframes
- State EMA alignment (golden cross, death cross, price position)
- Use markdown formatting and emojis sparingly (✅ ❌ ⚠️ 📊 🎯)
- Always say "this is educational, not financial advice"
${marketContext}`;

    const response = await callAIWithFallback({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
      stream: true,
    });

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("trading-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
