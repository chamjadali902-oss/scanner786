import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function getSystemPrompt(key: string, fallback: string): Promise<string> {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data } = await supabase.from('ai_prompts').select('system_prompt').eq('key', key).single();
    return data?.system_prompt || fallback;
  } catch {
    return fallback;
  }
}

interface TimeframeData {
  tf: string;
  rsi: number;
  macd: number;
  ema20: number;
  ema50: number;
  currentPrice: number;
  trend: 'up' | 'down' | 'sideways';
  lastCandles: { open: number; high: number; low: number; close: number; volume: number }[];
}

// Wilder's Smoothed RSI (matches TradingView)
function calcRSI(closes: number[], period = 14): number {
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

function calcEMA(closes: number[], period: number): number {
  if (closes.length < period) return closes[closes.length - 1];
  const k = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
  }
  return ema;
}

function calcMACD(closes: number[]): number {
  if (closes.length < 26) return 0;
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  return ema12 - ema26;
}

function detectTrend(closes: number[], ema20: number, ema50: number): 'up' | 'down' | 'sideways' {
  const price = closes[closes.length - 1];
  if (price > ema20 && ema20 > ema50) return 'up';
  if (price < ema20 && ema20 < ema50) return 'down';
  return 'sideways';
}

const FALLBACK_PROMPT = `You are an elite crypto trading analyst specializing in active trade management. 
Analyze an OPEN trade across multiple timeframes and provide precise, actionable advice.

IMPORTANT: Respond in valid JSON only. No markdown. No code blocks.

Response format:
{
  "decision": "HOLD" | "EXIT_NOW" | "EXIT_PARTIAL" | "ADD_POSITION",
  "urgency": "HIGH" | "MEDIUM" | "LOW",
  "confidence": number (1-100),
  "currentBias": "BULLISH" | "BEARISH" | "NEUTRAL",
  "shortTermOutlook": "string (what 1m-30m shows)",
  "longTermOutlook": "string (what 1h-1d shows)",
  "recommendation": "string (specific actionable advice in 2-3 sentences)",
  "riskLevel": "HIGH" | "MEDIUM" | "LOW",
  "slSuggestion": number | null (suggested stop loss price, null if current is fine),
  "tpSuggestion": number | null (suggested take profit price, null if current is fine),
  "keyLevels": {
    "support": number,
    "resistance": number
  },
  "reasons": ["string", "string", "string"] (3 key reasons for the decision),
  "warning": "string | null" (critical risk warning if any)
}`;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { symbol, side, entryPrice, stopLoss, takeProfit, quantity, timeframeData } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = await getSystemPrompt('dashboard_ai', FALLBACK_PROMPT);

    const currentPrice = timeframeData?.[0]?.currentPrice || entryPrice;
    const pnl = side === 'long'
      ? (currentPrice - entryPrice) * quantity
      : (entryPrice - currentPrice) * quantity;
    const pnlPct = side === 'long'
      ? ((currentPrice - entryPrice) / entryPrice) * 100
      : ((entryPrice - currentPrice) / entryPrice) * 100;

    const tfSummary = (timeframeData as TimeframeData[])
      .map(tf => `[${tf.tf}] Price: $${tf.currentPrice.toFixed(4)} | RSI: ${tf.rsi.toFixed(1)} | MACD: ${tf.macd > 0 ? '+' : ''}${tf.macd.toFixed(4)} | EMA20: $${tf.ema20.toFixed(4)} | EMA50: $${tf.ema50.toFixed(4)} | Trend: ${tf.trend.toUpperCase()}`)
      .join('\n');

    const userPrompt = `Active Trade Analysis Request:

Symbol: ${symbol}
Direction: ${side.toUpperCase()}
Entry Price: $${entryPrice}
Current Price: $${currentPrice.toFixed(4)}
Current P&L: $${pnl.toFixed(2)} (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%)
${stopLoss ? `Stop Loss: $${stopLoss}` : 'Stop Loss: Not set'}
${takeProfit ? `Take Profit: $${takeProfit}` : 'Take Profit: Not set'}
Quantity: ${quantity}

Multi-Timeframe Analysis:
${tfSummary}

Short timeframes (1m-30m) show immediate momentum.
Long timeframes (1h-1d) show macro trend.
Provide your decision on whether to hold, exit, or adjust this ${side} trade.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI error: ${status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    let analysis;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);
    } catch {
      analysis = {
        decision: "HOLD",
        urgency: "LOW",
        confidence: 50,
        currentBias: "NEUTRAL",
        shortTermOutlook: "Unable to parse analysis",
        longTermOutlook: "Unable to parse analysis",
        recommendation: content.slice(0, 200),
        riskLevel: "MEDIUM",
        slSuggestion: null,
        tpSuggestion: null,
        keyLevels: { support: currentPrice * 0.98, resistance: currentPrice * 1.02 },
        reasons: ["Analysis parsing failed"],
        warning: null,
      };
    }

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
