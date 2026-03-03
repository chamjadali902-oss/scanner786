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

const FALLBACK_PROMPT = `You are an elite cryptocurrency technical analyst. Analyze the given coin data and provide a comprehensive trading recommendation.

IMPORTANT: You MUST respond in valid JSON format only. No markdown, no code blocks, just raw JSON.

Response format:
{
  "signal": "BUY" | "SELL" | "HOLD",
  "tradeType": "REVERSAL" | "BREAKOUT" | "SCALP" | "SWING" | "TREND_CONTINUATION",
  "direction": "LONG" | "SHORT",
  "confidence": 1-100,
  "strength": "STRONG" | "MODERATE" | "WEAK",
  "entry": number,
  "takeProfit": [number, number, number],
  "stopLoss": number,
  "riskReward": "string",
  "reasons": ["string", "string", "string"],
  "setup": "string",
  "warnings": ["string"],
  "keyLevels": { "support": [number, number], "resistance": [number, number] },
  "summary": "string"
}`;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { symbol, price, priceChange24h, volume24h, indicatorValues, matchReasons, isBullish, timeframe } = await req.json();

    const systemPrompt = await getSystemPrompt('scanner_ai', FALLBACK_PROMPT);

    const userPrompt = `Analyze ${symbol} for a ${timeframe} timeframe trade:

Price: $${price}
24h Change: ${priceChange24h?.toFixed(2)}%
24h Volume: $${volume24h?.toLocaleString()}
Bullish Bias: ${isBullish}

Technical Indicators:
${Object.entries(indicatorValues || {}).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

Match Reasons: ${(matchReasons || []).join(', ')}

Provide your analysis with entry, take profit levels, and stop loss.`;

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
        signal: isBullish ? "BUY" : "SELL",
        confidence: 50, entry: price,
        takeProfit: [price * 1.02, price * 1.05, price * 1.1],
        stopLoss: price * 0.97, riskReward: "1:2",
        reasons: ["Analysis parsing failed, showing defaults"],
        summary: content.slice(0, 200),
      };
    }

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-trade error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
