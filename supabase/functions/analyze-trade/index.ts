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

const FALLBACK_PROMPT = `You are an elite cryptocurrency technical analyst. Analyze the given coin data and provide a comprehensive trading recommendation.

IMPORTANT: You MUST respond in valid JSON format only. No markdown, no code blocks, just raw JSON.

Response format:
{
  "signal": "BUY" | "SELL" | "HOLD",
  "tradeType": "REVERSAL" | "BREAKOUT" | "SCALP" | "SWING" | "TREND_CONTINUATION",
  "direction": "LONG" | "SHORT",
  "confidence": 1-100,
  "strength": "STRONG" | "MODERATE" | "WEAK",
  "entry": number (entry price),
  "takeProfit": [number, number, number] (3 TP levels),
  "stopLoss": number,
  "riskReward": string (e.g. "1:2.5"),
  "reasons": [string, string, string] (3-5 key reasons),
  "setup": string (detailed 2-3 sentence setup description),
  "warnings": [string] (potential risks and invalidation levels),
  "keyLevels": {
    "support": [number, number],
    "resistance": [number, number]
  },
  "summary": string (2-3 sentence summary in simple language)
}

Consider:
- Classify the trade type accurately (reversal at key levels, breakout from range, scalp on momentum, swing on trend)
- Current price action and trend direction
- Indicator confluence (RSI, MACD, BB, etc.)
- Smart Money Concepts if applicable
- Risk management with proper stop loss
- Multiple take profit targets
- Volume confirmation
- Key support/resistance levels
- Potential warnings and invalidation scenarios`;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { symbol, price, priceChange24h, volume24h, indicatorValues, matchReasons, isBullish, timeframe } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

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

    const makeAIRequest = async (retries = 3, delay = 2000) => {
      for (let attempt = 0; attempt < retries; attempt++) {
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

        if (response.ok) return response;

        if (response.status === 402) {
          return response;
        }

        if (response.status === 429 && attempt < retries - 1) {
          console.log(`Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`);
          await new Promise(r => setTimeout(r, delay));
          delay *= 2;
          continue;
        }

        return response;
      }
    };

    const response = await makeAIRequest();
    if (!response || !response.ok) {
      const status = response?.status || 500;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response?.text();
      console.error("AI error:", status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    let analysis;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);
    } catch {
      analysis = {
        signal: isBullish ? "BUY" : "SELL",
        confidence: 50,
        entry: price,
        takeProfit: [price * 1.02, price * 1.05, price * 1.1],
        stopLoss: price * 0.97,
        riskReward: "1:2",
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
