import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAIWithFallback } from "../_shared/ai-fallback.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function getSystemPrompt(key: string, fallback: string): Promise<string> {
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data } = await supabase.from('ai_prompts').select('system_prompt').eq('key', key).single();
    return data?.system_prompt || fallback;
  } catch { return fallback; }
}

const FALLBACK_PROMPT = `You are an elite cryptocurrency trading analyst specializing in THREE key analysis pillars:
1. TECHNICAL INDICATORS (RSI, MACD, EMA, Bollinger Bands, Stochastic, ADX, ATR)
2. PRICE ACTION PATTERNS (Doji, Hammer, Engulfing, Morning/Evening Star, Harami, Marubozu, Inside Bar, Three White Soldiers, Three Black Crows)
3. SMART MONEY CONCEPTS (BOS, ChoCH, Order Blocks, Fair Value Gaps, Liquidity Sweeps, Equal Highs/Lows, Premium/Discount Zones)

IMPORTANT: Respond in valid JSON only. No markdown, no code blocks.

Response format:
{
  "signals": [
    {
      "symbol": "string",
      "tradeType": "REVERSAL" | "BREAKOUT" | "SCALP" | "SWING",
      "direction": "LONG" | "SHORT",
      "signal": "BUY" | "SELL",
      "confidence": 1-100,
      "strength": "STRONG" | "MODERATE" | "WEAK",
      "entry": number,
      "takeProfit": [number, number, number],
      "stopLoss": number,
      "riskReward": "string",
      "timeframe": "string",
      "reasons": ["string", "string", "string"],
      "setup": "string",
      "warnings": ["string"],
      "urgency": "HIGH" | "MEDIUM" | "LOW"
    }
  ],
  "marketSentiment": "BULLISH" | "BEARISH" | "NEUTRAL",
  "topPick": "string",
  "summary": "string"
}

Signal Generation Rules:
- MUST use confluence of indicators + price action + SMC for high-confidence signals
- Only include signals with confidence > 60 and at least 2 category confluence`;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { coins } = await req.json();

    const systemPrompt = await getSystemPrompt('smart_signals_ai', FALLBACK_PROMPT);

    const coinsData = coins.map((c: any) => {
      const parts = [
        `${c.symbol}: Price $${c.price}, 24h Change ${c.priceChange24h?.toFixed(2)}%, Vol $${c.volume24h?.toLocaleString()}`,
        `Indicators: ${JSON.stringify(c.indicatorValues || {})}`,
      ];
      if (c.patterns?.length > 0) parts.push(`Price Action: ${c.patterns.join(', ')}`);
      if (c.smcSignals?.length > 0) parts.push(`SMC: ${c.smcSignals.join(', ')}`);
      parts.push(`Bias: ${c.isBullish ? 'Bullish' : 'Bearish'}`);
      return parts.join(' | ');
    }).join('\n');

    const userPrompt = `Analyze these ${coins.length} coins using INDICATORS + PRICE ACTION + SMART MONEY CONCEPTS and find the best trading opportunities:\n\n${coinsData}\n\nReturn only the top opportunities with highest confluence.`;

    const response = await callAIWithFallback({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    let result;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      result = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);
    } catch {
      result = { signals: [], marketSentiment: "NEUTRAL", topPick: "", summary: "Analysis parsing failed." };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("smart-signals error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
