import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { trades, stats } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are a professional trading coach reviewing a trader's performance journal. Provide honest, actionable feedback.

IMPORTANT: Respond in valid JSON only. No markdown, no code blocks.

Response format:
{
  "overallGrade": "A" | "B" | "C" | "D" | "F",
  "overallScore": 1-100,
  "strengths": ["string", "string"],
  "weaknesses": ["string", "string"],
  "emotionalPatterns": "string (psychological observations)",
  "riskManagement": {
    "score": 1-100,
    "feedback": "string",
    "suggestions": ["string"]
  },
  "tradeReviews": [
    {
      "symbol": "string",
      "grade": "A" | "B" | "C" | "D" | "F",
      "whatWentRight": "string",
      "whatWentWrong": "string",
      "lesson": "string"
    }
  ],
  "improvementPlan": [
    {
      "priority": "HIGH" | "MEDIUM" | "LOW",
      "area": "string",
      "action": "string",
      "timeframe": "string"
    }
  ],
  "summary": "string (encouraging but honest overall summary)"
}

Analyze:
- Win rate patterns
- Position sizing consistency
- Risk/reward adherence
- Emotional trading signs (revenge trades, FOMO entries)
- Best/worst performing setups
- Time-of-day patterns`;

    const tradesData = trades.map((t: any) => 
      `${t.symbol} ${t.side.toUpperCase()}: Entry $${t.entry_price}, Exit $${t.exit_price || 'OPEN'}, PnL ${t.pnl ? `$${t.pnl.toFixed(2)} (${t.pnl_percent?.toFixed(1)}%)` : 'N/A'}, SL $${t.stop_loss || 'None'}, TP $${t.take_profit || 'None'}, Status: ${t.status}, Notes: ${t.notes || 'None'}`
    ).join('\n');

    const statsStr = `Stats: ${stats.totalTrades} trades, ${stats.winRate.toFixed(1)}% win rate, Total PnL $${stats.totalPnl.toFixed(2)}, Best $${stats.bestTrade.toFixed(2)}, Worst $${stats.worstTrade.toFixed(2)}, ${stats.openTrades} open`;

    const userPrompt = `Review this trader's journal:\n\n${statsStr}\n\nRecent Trades:\n${tradesData}\n\nProvide a thorough coaching review.`;

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
      throw new Error("AI gateway error");
    }

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
