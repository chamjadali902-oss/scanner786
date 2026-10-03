import "../_shared/binance-geo.ts";
// Market Intelligence AI: gathers ALL live market data (global stats, sentiment,
// movers, futures positioning, news, economic events) and returns one structured
// AI brief so the trader does not need any other website.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAIWithFallback } from "../_shared/ai-fallback.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const FALLBACK_PROMPT = `You are the head of research at a crypto prop trading desk. You receive a complete live market snapshot: global market cap and dominance, Fear & Greed, top movers, futures positioning (funding, open interest, long/short ratio, taker delta) for majors, the latest news headlines and this week's economic calendar.

Produce one decision-grade market brief.

Analysis hierarchy (strict order):
1. Positioning and liquidity (funding, OI change, long/short ratio, crowded side)
2. Order flow (taker delta, volume leadership, dominance rotation)
3. Macro and event risk (calendar events within 48h, rate/inflation prints)
4. News flow: separate real catalysts from noise; ignore recycled headlines
5. Sentiment (Fear & Greed) only as a contrarian filter

Rules:
- Be specific and numeric. Quote the actual levels and percentages from the data.
- Never hedge with generic statements. Give a clear stance and what invalidates it.
- Say plainly when the market is not tradable and why.
- No emojis. No hype. Professional desk language, English only.

Respond with RAW JSON only, no markdown, no code fences:
{
  "regime": "RISK_ON" | "RISK_OFF" | "CHOPPY" | "TRANSITION",
  "bias": "BULLISH" | "BEARISH" | "NEUTRAL",
  "confidence": 1-100,
  "headline": "one sentence verdict",
  "summary": "3-5 sentence desk brief",
  "positioning": "what futures positioning implies right now",
  "flow": "what order flow and volume leadership imply",
  "sentiment": "Fear & Greed read used as a filter",
  "newsImpact": [{ "title": "string", "impact": "HIGH" | "MEDIUM" | "LOW", "read": "why it matters or why it is noise" }],
  "eventRisk": [{ "event": "string", "when": "string", "read": "how to trade around it" }],
  "opportunities": [{ "symbol": "string", "direction": "LONG" | "SHORT", "setup": "string", "trigger": "string", "invalidation": "string", "confidence": 1-100 }],
  "avoid": ["string"],
  "playbook": ["actionable step", "actionable step"],
  "invalidation": "what would flip this entire view"
}`;

async function getSystemPrompt(key: string, fallback: string): Promise<string> {
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data } = await supabase.from('ai_prompts').select('system_prompt').eq('key', key).maybeSingle();
    return data?.system_prompt || fallback;
  } catch { return fallback; }
}

async function j<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MarketIntel/1.0)', Accept: 'application/json' } });
    if (!r.ok) return null;
    return await r.json() as T;
  } catch { return null; }
}

const FAPI = 'https://fapi.binance.com';

async function majorSnapshot(symbol: string) {
  const [prem, oiHist, ls, tk] = await Promise.all([
    j<{ markPrice: string; lastFundingRate: string }>(`${FAPI}/fapi/v1/premiumIndex?symbol=${symbol}`),
    j<Array<{ sumOpenInterestValue: string }>>(`${FAPI}/futures/data/openInterestHist?symbol=${symbol}&period=1h&limit=25`),
    j<Array<{ longShortRatio: string }>>(`${FAPI}/futures/data/topLongShortPositionRatio?symbol=${symbol}&period=1h&limit=1`),
    j<{ lastPrice: string; priceChangePercent: string; quoteVolume: string; highPrice: string; lowPrice: string }>(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`),
  ]);

  let oi1h: number | null = null, oi24h: number | null = null;
  if (oiHist && oiHist.length > 2) {
    const last = parseFloat(oiHist[oiHist.length - 1].sumOpenInterestValue);
    const prev1 = parseFloat(oiHist[oiHist.length - 2].sumOpenInterestValue);
    const first = parseFloat(oiHist[0].sumOpenInterestValue);
    if (prev1 > 0) oi1h = ((last - prev1) / prev1) * 100;
    if (first > 0) oi24h = ((last - first) / first) * 100;
  }

  // Taker delta from recent aggregated trades
  let takerDelta: number | null = null;
  const agg = await j<Array<{ q: string; m: boolean }>>(`https://api.binance.com/api/v3/aggTrades?symbol=${symbol}&limit=1000`);
  if (agg?.length) {
    let buy = 0, sell = 0;
    for (const t of agg) { const q = parseFloat(t.q); if (t.m) sell += q; else buy += q; }
    const total = buy + sell;
    if (total > 0) takerDelta = ((buy - sell) / total) * 100;
  }

  return {
    symbol,
    price: tk ? parseFloat(tk.lastPrice) : null,
    change24hPct: tk ? parseFloat(tk.priceChangePercent) : null,
    high24h: tk ? parseFloat(tk.highPrice) : null,
    low24h: tk ? parseFloat(tk.lowPrice) : null,
    quoteVolume24h: tk ? parseFloat(tk.quoteVolume) : null,
    fundingRatePct: prem ? parseFloat(prem.lastFundingRate) * 100 : null,
    fundingAprPct: prem ? parseFloat(prem.lastFundingRate) * 100 * 3 * 365 : null,
    oiChange1hPct: oi1h,
    oiChange24hPct: oi24h,
    topTraderLongShortRatio: ls?.[0] ? parseFloat(ls[0].longShortRatio) : null,
    takerDeltaPct: takerDelta,
  };
}

async function fetchNewsAndEvents(origin: string, authHeader: string | null) {
  // Reuse the market-feed proxy so news/calendar logic lives in one place.
  try {
    const r = await fetch(`${origin}/functions/v1/market-feed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: '{}',
    });
    if (r.ok) return await r.json() as { news?: unknown[]; events?: unknown[] };
  } catch { /* ignore */ }
  return { news: [], events: [] };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const focusSymbols: string[] = Array.isArray(body?.symbols) && body.symbols.length
      ? body.symbols.slice(0, 4)
      : ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? '';

    const [global, fng, tickers, feed, ...majors] = await Promise.all([
      j<{ data?: Record<string, any> }>('https://api.coingecko.com/api/v3/global'),
      j<{ data?: Array<{ value: string; value_classification: string }> }>('https://api.alternative.me/fng/?limit=2'),
      j<Array<{ symbol: string; lastPrice: string; priceChangePercent: string; quoteVolume: string }>>('https://api.binance.com/api/v3/ticker/24hr'),
      fetchNewsAndEvents(supabaseUrl, req.headers.get('Authorization')),
      ...focusSymbols.map((s) => majorSnapshot(s)),
    ]);

    const g = global?.data;
    const globalStats = g ? {
      totalMarketCapUsd: g.total_market_cap?.usd ?? null,
      mcapChange24hPct: g.market_cap_change_percentage_24h_usd ?? null,
      volume24hUsd: g.total_volume?.usd ?? null,
      btcDominancePct: g.market_cap_percentage?.btc ?? null,
      ethDominancePct: g.market_cap_percentage?.eth ?? null,
    } : null;

    const fearGreed = fng?.data?.[0] ? {
      value: parseInt(fng.data[0].value),
      label: fng.data[0].value_classification,
      yesterday: fng.data[1] ? parseInt(fng.data[1].value) : null,
    } : null;

    const usdt = (tickers ?? [])
      .filter((t) => t.symbol.endsWith('USDT') && parseFloat(t.quoteVolume) > 1e7)
      .map((t) => ({ symbol: t.symbol, price: parseFloat(t.lastPrice), chg: parseFloat(t.priceChangePercent), vol: parseFloat(t.quoteVolume) }));
    const gainers = [...usdt].sort((a, b) => b.chg - a.chg).slice(0, 10);
    const losers = [...usdt].sort((a, b) => a.chg - b.chg).slice(0, 10);
    const byVolume = [...usdt].sort((a, b) => b.vol - a.vol).slice(0, 10);

    const news = (feed.news as Array<Record<string, any>> ?? []).slice(0, 25).map((n) => ({
      title: n.title, source: n.source, published: n.published_on ? new Date(n.published_on * 1000).toISOString() : null,
      body: typeof n.body === 'string' ? n.body.slice(0, 300) : '',
    }));

    const now = Date.now();
    const events = (feed.events as Array<Record<string, any>> ?? [])
      .filter((e) => {
        const t = new Date(String(e.date)).getTime();
        return !isNaN(t) && t >= now - 3600e3 && t <= now + 7 * 864e5;
      })
      .filter((e) => /high|medium/i.test(String(e.impact)) || e.country === 'USD')
      .sort((a, b) => new Date(String(a.date)).getTime() - new Date(String(b.date)).getTime())
      .slice(0, 20)
      .map((e) => ({ title: e.title, country: e.country, date: e.date, impact: e.impact, forecast: e.forecast, previous: e.previous }));

    const snapshot = {
      generatedAt: new Date().toISOString(),
      globalStats,
      fearGreed,
      majors,
      topGainers24h: gainers,
      topLosers24h: losers,
      highestVolume24h: byVolume,
      news,
      economicEvents: events,
    };

    const systemPrompt = await getSystemPrompt('market_intel_ai', FALLBACK_PROMPT);

    const userPrompt = `Here is the complete live market snapshot (UTC ${snapshot.generatedAt}). Analyse everything and return the JSON brief.

${JSON.stringify(snapshot, null, 1)}`;

    const response = await callAIWithFallback({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? '';

    let brief: Record<string, unknown>;
    try {
      const m = content.match(/\{[\s\S]*\}/);
      brief = m ? JSON.parse(m[0]) : JSON.parse(content);
    } catch {
      brief = {
        regime: 'CHOPPY', bias: 'NEUTRAL', confidence: 40,
        headline: 'AI response could not be parsed into a structured brief.',
        summary: String(content).slice(0, 600),
        newsImpact: [], eventRisk: [], opportunities: [], avoid: [], playbook: [],
      };
    }

    return new Response(JSON.stringify({ ...brief, snapshot }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('market-intel-ai error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
