import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// =====================================================
// CORS Configuration
// =====================================================
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// =====================================================
// AI Gateway Configuration
// Change these to switch AI providers
// =====================================================
const AI_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const AI_MODEL = 'google/gemini-2.5-flash';

// =====================================================
// Database Helpers
// =====================================================
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

// =====================================================
// Types
// =====================================================
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

// =====================================================
// Default Prompt (used as fallback if DB prompt not found)
// =====================================================
const FALLBACK_PROMPT = `You are an elite crypto trading analyst specializing in active trade management and multi-timeframe analysis.
Your job is to protect the trader from TRAPS — situations where one timeframe looks good but others contradict.

Analyze an OPEN trade across ALL timeframes (1m to 1d) and provide precise, actionable advice.

IMPORTANT: Respond in valid JSON only. No markdown. No code blocks.

Response format:
{
  "decision": "HOLD" | "EXIT_NOW" | "EXIT_PARTIAL" | "ADD_POSITION",
  "urgency": "HIGH" | "MEDIUM" | "LOW",
  "confidence": number (1-100),
  "currentBias": "BULLISH" | "BEARISH" | "NEUTRAL",
  "shortTermOutlook": "string (what 1m-30m shows — momentum, divergences, traps)",
  "longTermOutlook": "string (what 1h-1d shows — macro trend, key levels, structure)",
  "recommendation": "string (specific actionable advice in 2-3 sentences)",
  "riskLevel": "HIGH" | "MEDIUM" | "LOW",
  "slSuggestion": number | null,
  "tpSuggestion": number | null,
  "keyLevels": { "support": number, "resistance": number },
  "reasons": ["string", "string", "string"],
  "warning": "string | null",
  "trapWarning": "string | null (explain if trader is in a TRAP — e.g. short TF bullish but higher TFs bearish, or RSI divergence across TFs)",
  "targetAchievable": boolean (based on multi-TF analysis, can the TP realistically be hit?),
  "targetAnalysis": "string (detailed explanation of why target is/isn't achievable based on resistance/support/trend across TFs)",
  "priceRange": {
    "shortTerm": { "min": number, "max": number, "timeframe": "next 1-4 hours" },
    "longTerm": { "min": number, "max": number, "timeframe": "next 12-24 hours" }
  },
  "timeframeSummary": [
    { "tf": "1m", "signal": "BUY|SELL|NEUTRAL", "strength": "STRONG|MODERATE|WEAK" }
  ],
  "conflictingSignals": ["string (any timeframe conflicts that could trap the trader)"]
}`;

// =====================================================
// Main Handler
// =====================================================
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { symbol, side, entryPrice, stopLoss, takeProfit, quantity, timeframeData } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = await getSystemPrompt('dashboard_ai', FALLBACK_PROMPT);

    // Calculate P&L
    const currentPrice = timeframeData?.[0]?.currentPrice || entryPrice;
    const pnl = side === 'long'
      ? (currentPrice - entryPrice) * quantity
      : (entryPrice - currentPrice) * quantity;
    const pnlPct = side === 'long'
      ? ((currentPrice - entryPrice) / entryPrice) * 100
      : ((entryPrice - currentPrice) / entryPrice) * 100;

    // Build timeframe summary
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

    // Call AI Gateway
    const response = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: AI_MODEL,
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

    // Parse AI response
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
