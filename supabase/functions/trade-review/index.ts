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

const FALLBACK_PROMPT = `You are a professional trading coach reviewing a trader's performance journal. Provide honest, actionable feedback.

IMPORTANT: Respond in valid JSON only. No markdown, no code blocks.

Response format:
{
  "overallGrade": "A" | "B" | "C" | "D" | "F",
  "overallScore": 1-100,
  "strengths": ["string"],
  "weaknesses": ["string"],
  "emotionalPatterns": "string",
  "riskManagement": { "score": 1-100, "feedback": "string", "suggestions": ["string"] },
  "tradeReviews": [{ "symbol": "string", "grade": "string", "whatWentRight": "string", "whatWentWrong": "string", "lesson": "string" }],
  "improvementPlan": [{ "priority": "HIGH" | "MEDIUM" | "LOW", "area": "string", "action": "string", "timeframe": "string" }],
  "summary": "string"
}`;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { trades, stats } = await req.json();

    const systemPrompt = await getSystemPrompt('journal_ai', FALLBACK_PROMPT);

    const tradesData = trades.map((t: any) => 
      `${t.symbol} ${t.side.toUpperCase()}: Entry $${t.entry_price}, Exit $${t.exit_price || 'OPEN'}, PnL ${t.pnl ? `$${t.pnl.toFixed(2)} (${t.pnl_percent?.toFixed(1)}%)` : 'N/A'}, SL $${t.stop_loss || 'None'}, TP $${t.take_profit || 'None'}, Status: ${t.status}, Notes: ${t.notes || 'None'}`
    ).join('\n');

    const statsStr = `Stats: ${stats.totalTrades} trades, ${stats.winRate.toFixed(1)}% win rate, Total PnL $${stats.totalPnl.toFixed(2)}, Best $${stats.bestTrade.toFixed(2)}, Worst $${stats.worstTrade.toFixed(2)}, ${stats.openTrades} open`;

    const userPrompt = `Review this trader's journal:\n\n${statsStr}\n\nRecent Trades:\n${tradesData}\n\nProvide a thorough coaching review.`;

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
      result = { overallGrade: "N/A", overallScore: 0, strengths: [], weaknesses: [], summary: "Review parsing failed." };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("trade-review error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
