import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAIWithFallback } from "../_shared/ai-fallback.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SPOT = 'https://api.binance.com/api/v3';
const FAPI = 'https://fapi.binance.com';

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch { return null; }
}

async function getSystemPrompt(key: string, fallback: string): Promise<string> {
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data } = await supabase.from('ai_prompts').select('system_prompt').eq('key', key).single();
    return data?.system_prompt || fallback;
  } catch { return fallback; }
}

interface TimeframeData {
  tf: string; rsi: number; macd: number; ema20: number; ema50: number;
  currentPrice: number; trend: 'up' | 'down' | 'sideways';
  lastCandles: { open: number; high: number; low: number; close: number; volume: number }[];
}

/** LIVE market context: spot price, derivatives positioning, taker order flow. */
async function fetchLiveContext(symbol: string) {
  const [tick, stats24h, prem, oiHist, lsRatio, aggTrades] = await Promise.all([
    getJson<{ price: string }>(`${SPOT}/ticker/price?symbol=${symbol}`),
    getJson<{ priceChangePercent: string; quoteVolume: string; highPrice: string; lowPrice: string }>(`${SPOT}/ticker/24hr?symbol=${symbol}`),
    getJson<{ lastFundingRate: string; markPrice: string }>(`${FAPI}/fapi/v1/premiumIndex?symbol=${symbol}`),
    getJson<Array<{ sumOpenInterest: string }>>(`${FAPI}/futures/data/openInterestHist?symbol=${symbol}&period=1h&limit=24`),
    getJson<Array<{ longShortRatio: string }>>(`${FAPI}/futures/data/topLongShortAccountRatio?symbol=${symbol}&period=1h&limit=1`),
    getJson<Array<{ p: string; q: string; m: boolean }>>(`${SPOT}/aggTrades?symbol=${symbol}&limit=1000`),
  ]);

  const livePrice = tick ? parseFloat(tick.price) : null;

  let oiChange24h: number | null = null;
  if (oiHist && oiHist.length > 2) {
    const a = parseFloat(oiHist[0].sumOpenInterest);
    const b = parseFloat(oiHist[oiHist.length - 1].sumOpenInterest);
    if (a > 0 && !isNaN(b)) oiChange24h = ((b - a) / a) * 100;
  }

  // Taker delta / CVD from recent aggregated trades (m=true => buyer is maker => taker SELL)
  let buyVol = 0, sellVol = 0;
  if (aggTrades) {
    for (const t of aggTrades) {
      const q = parseFloat(t.q) * parseFloat(t.p);
      if (t.m) sellVol += q; else buyVol += q;
    }
  }
  const totalVol = buyVol + sellVol;
  const deltaPct = totalVol > 0 ? ((buyVol - sellVol) / totalVol) * 100 : null;

  return {
    livePrice,
    markPrice: prem ? parseFloat(prem.markPrice) : null,
    change24hPct: stats24h ? parseFloat(stats24h.priceChangePercent) : null,
    quoteVolume24h: stats24h ? parseFloat(stats24h.quoteVolume) : null,
    high24h: stats24h ? parseFloat(stats24h.highPrice) : null,
    low24h: stats24h ? parseFloat(stats24h.lowPrice) : null,
    fundingRate: prem ? parseFloat(prem.lastFundingRate) : null,
    oiChange24h,
    longShortRatio: lsRatio && lsRatio.length ? parseFloat(lsRatio[0].longShortRatio) : null,
    takerDeltaPct: deltaPct,
    takerBuyQuote: buyVol,
    takerSellQuote: sellVol,
  };
}

const FALLBACK_PROMPT = `You are a modern crypto trade-management desk: part risk manager, part flow trader.
You manage an ALREADY OPEN position. Your only job is protecting capital and maximising expectancy on THIS trade.

How today's market actually works — weight your read in this order:
1. LIQUIDITY & POSITIONING (highest weight): where stops sit, funding rate extremes, open-interest behaviour vs price (price up + OI down = weak/short-covering rally; price up + OI up + funding hot = crowded long, squeeze risk), crowded long/short ratio.
2. ORDER FLOW: taker delta / CVD direction vs price. Price rising on negative delta = passive absorption, distribution risk. Price falling on positive delta = absorption, reversal fuel.
3. HTF CONTEXT & STRUCTURE: higher timeframes (4h/1d) decide direction; lower timeframes only decide timing. Never let a 1m/5m signal override a 4h/1d regime.
4. LEVEL RECLAIM / SWEEP QUALITY: liquidity sweep then reclaim beats any pattern name. Failed reclaim = trade thesis dead.
5. CLASSIC INDICATORS (lowest weight): RSI/MACD/EMA only as confirmation or divergence, never as the primary reason. Do not call plain "RSI overbought" a reason to exit if flow and HTF are intact.

Hard rules:
- Use ONLY the numeric values supplied in the data block. Never invent a price, funding number, or level. If a value is N/A, say the data is unavailable instead of guessing.
- Every level you output (SL, TP, support, resistance, invalidation) must be a real number near live price and consistent with the trade direction: for a LONG, stop below live price and target above; for a SHORT, the reverse.
- Be decisive and specific. No hedging filler, no motivational lines, no emojis.
- Trade management is scenario based: state what invalidates the trade, and what would make you add or trim.
- Flag traps: one timeframe or one indicator looking good while positioning, flow, or HTF disagrees.

IMPORTANT: Respond in valid JSON only. No markdown. No code blocks.

Response format:
{
  "decision": "HOLD" | "EXIT_NOW" | "EXIT_PARTIAL" | "ADD_POSITION",
  "urgency": "HIGH" | "MEDIUM" | "LOW",
  "confidence": number (1-100),
  "currentBias": "BULLISH" | "BEARISH" | "NEUTRAL",
  "shortTermOutlook": "string",
  "longTermOutlook": "string",
  "recommendation": "string (2-4 sentences, concrete management plan)",
  "riskLevel": "HIGH" | "MEDIUM" | "LOW",
  "slSuggestion": number | null,
  "tpSuggestion": number | null,
  "keyLevels": { "support": number, "resistance": number },
  "invalidationLevel": number | null,
  "reasons": ["string (lead with positioning/flow/HTF, not indicators)"],
  "warning": "string | null",
  "trapWarning": "string | null",
  "targetAchievable": boolean,
  "targetAnalysis": "string",
  "positioningRead": "string (funding + OI + long/short ratio in plain language: who is trapped)",
  "flowRead": "string (taker delta / CVD vs price: absorption, distribution, or confirmation)",
  "priceRange": {
    "shortTerm": { "min": number, "max": number, "timeframe": "next 1-4 hours" },
    "longTerm": { "min": number, "max": number, "timeframe": "next 12-24 hours" }
  },
  "timeframeSummary": [{ "tf": "1m", "signal": "BUY|SELL|NEUTRAL", "strength": "STRONG|MODERATE|WEAK" }],
  "conflictingSignals": ["string"]
}`;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { symbol, side, entryPrice, stopLoss, takeProfit, quantity, timeframeData } = await req.json();

    const [systemPrompt, live] = await Promise.all([
      getSystemPrompt('dashboard_ai', FALLBACK_PROMPT),
      fetchLiveContext(symbol),
    ]);

    const currentPrice = live.livePrice ?? timeframeData?.[0]?.currentPrice ?? entryPrice;
    const pnl = side === 'long' ? (currentPrice - entryPrice) * quantity : (entryPrice - currentPrice) * quantity;
    const pnlPct = side === 'long' ? ((currentPrice - entryPrice) / entryPrice) * 100 : ((entryPrice - currentPrice) / entryPrice) * 100;

    const tfSummary = (timeframeData as TimeframeData[] ?? [])
      .map(tf => `[${tf.tf}] Close: $${tf.currentPrice.toFixed(6)} | RSI: ${tf.rsi.toFixed(1)} | MACD: ${tf.macd > 0 ? '+' : ''}${tf.macd.toFixed(6)} | EMA20: $${tf.ema20.toFixed(6)} | EMA50: $${tf.ema50.toFixed(6)} | Trend: ${tf.trend.toUpperCase()}`)
      .join('\n');

    const n = (v: number | null, digits = 4, suffix = '') => v == null || isNaN(v) ? 'N/A' : `${v.toFixed(digits)}${suffix}`;

    const liveBlock = `LIVE MARKET DATA (authoritative — use these exact numbers):
- Live spot price: ${live.livePrice != null ? '$' + live.livePrice : 'N/A'}
- Mark price (perp): ${live.markPrice != null ? '$' + live.markPrice : 'N/A'}
- 24h change: ${n(live.change24hPct, 2, '%')} | 24h high: ${n(live.high24h, 6)} | 24h low: ${n(live.low24h, 6)}
- 24h quote volume: ${live.quoteVolume24h != null ? '$' + Math.round(live.quoteVolume24h).toLocaleString('en-US') : 'N/A'}
- Funding rate: ${live.fundingRate != null ? (live.fundingRate * 100).toFixed(4) + '%' : 'N/A'}
- Open interest change (24h): ${n(live.oiChange24h, 2, '%')}
- Top trader long/short account ratio: ${n(live.longShortRatio, 2)}
- Taker delta (last 1000 agg trades): ${n(live.takerDeltaPct, 1, '%')} (buy $${Math.round(live.takerBuyQuote).toLocaleString('en-US')} vs sell $${Math.round(live.takerSellQuote).toLocaleString('en-US')})`;

    const userPrompt = `OPEN TRADE MANAGEMENT REQUEST

Symbol: ${symbol}
Direction: ${String(side).toUpperCase()}
Entry price: $${entryPrice}
Live price: $${currentPrice}
Current P&L: $${pnl.toFixed(2)} (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%)
${stopLoss ? `Stop loss: $${stopLoss}` : 'Stop loss: not set'}
${takeProfit ? `Take profit: $${takeProfit}` : 'Take profit: not set'}
Quantity: ${quantity}

${liveBlock}

MULTI-TIMEFRAME INDICATOR DATA (500-candle calculations, TradingView-matched):
${tfSummary || 'unavailable'}

Manage this ${side} position. Lead your reasoning with positioning and order flow, then HTF structure, and only then indicators. Give exact numeric levels for stop, target and invalidation.`;

    const response = await callAIWithFallback({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    let analysis;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);
    } catch {
      analysis = {
        decision: "HOLD", urgency: "LOW", confidence: 50, currentBias: "NEUTRAL",
        shortTermOutlook: "Unable to parse analysis", longTermOutlook: "Unable to parse analysis",
        recommendation: content.slice(0, 200), riskLevel: "MEDIUM",
        slSuggestion: null, tpSuggestion: null,
        keyLevels: { support: currentPrice * 0.98, resistance: currentPrice * 1.02 },
        reasons: ["Analysis parsing failed"], warning: null,
      };
    }

    // Attach the verified live snapshot so the UI never shows stale prices.
    analysis.liveData = {
      price: live.livePrice,
      change24hPct: live.change24hPct,
      fundingRate: live.fundingRate,
      oiChange24h: live.oiChange24h,
      longShortRatio: live.longShortRatio,
      takerDeltaPct: live.takerDeltaPct,
      pnl,
      pnlPct,
    };

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("live-trade-analysis error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
