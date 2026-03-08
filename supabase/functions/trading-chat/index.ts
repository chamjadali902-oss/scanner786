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
  
  // Common crypto tickers
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
  
  // Match patterns like BTCUSDT, BTC/USDT, BTC
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

  // Also try to catch any XXXUSDT pattern
  const usdtMatch = text.match(/\b([A-Z1-9]{2,10})USDT\b/g);
  if (usdtMatch) {
    for (const m of usdtMatch) {
      if (!found.includes(m)) found.push(m);
    }
  }

  return [...new Set(found)].slice(0, 5); // max 5 symbols
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

interface KlineData {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

async function fetchMarketData(symbol: string): Promise<string | null> {
  try {
    // Fetch ticker + klines in parallel
    const [tickerRes, klines1hRes, klines4hRes, klines1dRes] = await Promise.all([
      fetch(`${BINANCE_API}/ticker/24hr?symbol=${symbol}`),
      fetch(`${BINANCE_API}/klines?symbol=${symbol}&interval=1h&limit=24`),
      fetch(`${BINANCE_API}/klines?symbol=${symbol}&interval=4h&limit=20`),
      fetch(`${BINANCE_API}/klines?symbol=${symbol}&interval=1d&limit=14`),
    ]);

    if (!tickerRes.ok) return null;

    const ticker: TickerData = await tickerRes.json();
    const klines1h: any[][] = klines1hRes.ok ? await klines1hRes.json() : [];
    const klines4h: any[][] = klines4hRes.ok ? await klines4hRes.json() : [];
    const klines1d: any[][] = klines1dRes.ok ? await klines1dRes.json() : [];

    // Calculate simple indicators from klines
    const calcRSI = (candles: any[][], period = 14): number | null => {
      if (candles.length < period + 1) return null;
      const closes = candles.map(c => +c[4]);
      let gains = 0, losses = 0;
      for (let i = closes.length - period; i < closes.length; i++) {
        const diff = closes[i] - closes[i - 1];
        if (diff > 0) gains += diff; else losses -= diff;
      }
      const avgGain = gains / period;
      const avgLoss = losses / period;
      if (avgLoss === 0) return 100;
      const rs = avgGain / avgLoss;
      return 100 - (100 / (1 + rs));
    };

    const calcEMA = (candles: any[][], period: number): number | null => {
      if (candles.length < period) return null;
      const closes = candles.map(c => +c[4]);
      const k = 2 / (period + 1);
      let ema = closes[0];
      for (let i = 1; i < closes.length; i++) {
        ema = closes[i] * k + ema * (1 - k);
      }
      return ema;
    };

    const rsi1h = calcRSI(klines1h);
    const rsi4h = calcRSI(klines4h);
    const rsi1d = calcRSI(klines1d);
    const ema20_1h = calcEMA(klines1h, 20);
    const ema50_4h = calcEMA(klines4h, 12);
    const ema20_1d = calcEMA(klines1d, 10);

    const price = +ticker.price;
    const change24h = +ticker.priceChangePercent;

    // Recent price action
    const recentCandles = klines1h.slice(-6).map(c => ({
      time: new Date(+c[0]).toISOString().slice(11, 16),
      o: (+c[1]).toFixed(4),
      h: (+c[2]).toFixed(4),
      l: (+c[3]).toFixed(4),
      c: (+c[4]).toFixed(4),
    }));

    // Support/Resistance from daily
    const dailyHighs = klines1d.map(c => +c[2]);
    const dailyLows = klines1d.map(c => +c[3]);
    const recentHigh = Math.max(...dailyHighs.slice(-7));
    const recentLow = Math.min(...dailyLows.slice(-7));

    return `
📊 **${symbol}** — LIVE Market Data (fetched just now):
• Price: $${price} | 24h Change: ${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%
• 24h High: $${(+ticker.highPrice).toFixed(4)} | Low: $${(+ticker.lowPrice).toFixed(4)}
• 24h Volume: $${(+ticker.quoteVolume / 1e6).toFixed(2)}M
• 7d High: $${recentHigh.toFixed(4)} | 7d Low: $${recentLow.toFixed(4)}
• RSI(14): 1h=${rsi1h?.toFixed(1) ?? 'N/A'} | 4h=${rsi4h?.toFixed(1) ?? 'N/A'} | 1d=${rsi1d?.toFixed(1) ?? 'N/A'}
• EMA: 1h EMA20=$${ema20_1h?.toFixed(4) ?? 'N/A'} | 4h EMA12=$${ema50_4h?.toFixed(4) ?? 'N/A'} | 1d EMA10=$${ema20_1d?.toFixed(4) ?? 'N/A'}
• Price vs 1h EMA20: ${ema20_1h ? (price > ema20_1h ? '🟢 ABOVE' : '🔴 BELOW') : 'N/A'}
• Recent 1h Candles: ${recentCandles.map(c => `${c.time}→$${c.c}`).join(' | ')}`;
  } catch (e) {
    console.error(`Failed to fetch data for ${symbol}:`, e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();

    // Detect symbols and fetch live data
    const symbols = extractSymbols(messages);
    let marketContext = '';

    if (symbols.length > 0) {
      console.log(`Detected symbols: ${symbols.join(', ')}. Fetching live data...`);
      const dataResults = await Promise.all(symbols.map(s => fetchMarketData(s)));
      const validData = dataResults.filter(Boolean);
      if (validData.length > 0) {
        marketContext = `\n\n--- LIVE REAL-TIME MARKET DATA (use this to answer accurately) ---\n${validData.join('\n')}\n--- END LIVE DATA ---\n`;
      }
    }

    const systemPrompt = `You are CryptoMentor AI — an expert cryptocurrency trading assistant and educator with LIVE market data access. You help traders of all levels with:

1. **Technical Analysis**: Explain indicators (RSI, MACD, Bollinger Bands, Stochastic, ADX, etc.), chart patterns, and how to use them effectively.
2. **Trading Strategies**: Suggest and explain strategies like scalping, swing trading, trend following, mean reversion, breakout trading.
3. **Risk Management**: Position sizing, stop-loss placement, risk-reward ratios, portfolio allocation.
4. **Market Analysis**: Help interpret current market conditions, sentiment, and macro factors.
5. **Smart Money Concepts (SMC)**: Order blocks, fair value gaps, liquidity sweeps, market structure shifts.
6. **Education**: Explain concepts clearly for beginners while providing depth for advanced traders.
7. **LIVE DATA**: When you have live market data available, use it to provide SPECIFIC, data-backed analysis. Quote exact prices, RSI values, EMA levels, and support/resistance. Don't be vague when you have the numbers.

Rules:
- Always emphasize risk management and responsible trading
- Never give specific financial advice — always say "this is educational, not financial advice"
- Use examples with specific numbers when explaining concepts
- Format responses with markdown for readability
- Be concise but thorough
- When live data is provided, ALWAYS reference the actual current price, RSI, EMA levels, and other data in your analysis
- Clearly state what timeframe each indicator reading is from
- Highlight if RSI is overbought (>70) or oversold (<30)
- Note if price is above or below key EMAs
- Use emojis sparingly for key points (✅ ❌ ⚠️ 📊 🎯)
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
