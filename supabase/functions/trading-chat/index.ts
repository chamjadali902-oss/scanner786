import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAIWithFallback } from "../_shared/ai-fallback.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();

    const systemPrompt = `You are CryptoMentor AI — an expert cryptocurrency trading assistant and educator. You help traders of all levels with:

1. **Technical Analysis**: Explain indicators (RSI, MACD, Bollinger Bands, Stochastic, ADX, etc.), chart patterns, and how to use them effectively.
2. **Trading Strategies**: Suggest and explain strategies like scalping, swing trading, trend following, mean reversion, breakout trading.
3. **Risk Management**: Position sizing, stop-loss placement, risk-reward ratios, portfolio allocation.
4. **Market Analysis**: Help interpret current market conditions, sentiment, and macro factors.
5. **Smart Money Concepts (SMC)**: Order blocks, fair value gaps, liquidity sweeps, market structure shifts.
6. **Education**: Explain concepts clearly for beginners while providing depth for advanced traders.

Rules:
- Always emphasize risk management and responsible trading
- Never give specific financial advice — always say "this is educational, not financial advice"
- Use examples with specific numbers when explaining concepts
- Format responses with markdown for readability
- Be concise but thorough
- If asked about a specific coin, provide general analysis frameworks rather than predictions
- Use emojis sparingly for key points (✅ ❌ ⚠️ 📊 🎯)`;

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
