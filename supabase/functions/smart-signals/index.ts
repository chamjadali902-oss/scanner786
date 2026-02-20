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

const FALLBACK_PROMPT = `You are an elite cryptocurrency trading analyst specializing in THREE key analysis pillars:
1. TECHNICAL INDICATORS (RSI, MACD, EMA, Bollinger Bands, Stochastic, ADX, ATR)
2. PRICE ACTION PATTERNS (Doji, Hammer, Engulfing, Morning/Evening Star, Harami, Marubozu, Inside Bar, Three White Soldiers, Three Black Crows)
3. SMART MONEY CONCEPTS (BOS, ChoCH, Order Blocks, Fair Value Gaps, Liquidity Sweeps, Equal Highs/Lows, Premium/Discount Zones)

You MUST consider ALL THREE categories when generating signals. Signals with confluence across multiple categories are stronger.

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
      "timeframe": "string (recommended timeframe)",
      "reasons": ["string", "string", "string"],
      "setup": "string (2-3 sentence setup description mentioning indicators, price action AND SMC)",
      "warnings": ["string"] (potential risks),
      "urgency": "HIGH" | "MEDIUM" | "LOW"
    }
  ],
  "marketSentiment": "BULLISH" | "BEARISH" | "NEUTRAL",
  "topPick": "string (symbol of best opportunity)",
  "summary": "string (market overview in 2-3 sentences)"
}

Signal Generation Rules:
- MUST use confluence of indicators + price action + SMC for high-confidence signals
- For REVERSAL: prioritize RSI divergences + reversal patterns (Hammer, Engulfing) + SMC (Order Blocks, Liquidity Sweeps, ChoCH)
- For BREAKOUT: prioritize volume + BOS + price breaking key levels + ADX trend strength
- For SCALP: prioritize Stochastic crosses + FVG fills + quick momentum patterns
- For SWING: prioritize EMA alignment + BOS/ChoCH + higher timeframe confluence + trend patterns
- Only include signals with confidence > 60 and at least 2 category confluence
- SMC concepts like Order Blocks and FVGs provide precise entry zones - USE them for entry/SL levels
- Liquidity sweeps and equal highs/lows indicate potential reversal zones
- Premium/Discount zones help determine trade direction bias`;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { coins } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

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

    const userPrompt = `Analyze these ${coins.length} coins using INDICATORS + PRICE ACTION + SMART MONEY CONCEPTS and find the best trading opportunities:\n\n${coinsData}\n\nReturn only the top opportunities with highest confluence across all three analysis categories.`;

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
        if (response.status === 402) return response;
        if (response.status === 429 && attempt < retries - 1) {
          console.log(`Rate limited, retrying in ${delay}ms`);
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
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI gateway error");
    }

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
