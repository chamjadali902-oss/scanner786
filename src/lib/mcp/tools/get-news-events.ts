import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "get_news_and_events",
  title: "Get crypto news and economic events",
  description:
    "Latest crypto news headlines (with source and time) and this week's economic calendar (FOMC, CPI, etc. with impact level). Optionally filter news by a keyword such as a coin name.",
  inputSchema: {
    keyword: z.string().optional().describe("Optional filter, e.g. BTC, ETF, Solana."),
    newsLimit: z.number().int().min(1).max(50).default(20),
    highImpactOnly: z.boolean().default(true).describe("Only high-impact economic events."),
  },
  annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: true },
  handler: async ({ keyword, newsLimit, highImpactOnly }) => {
    const base = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    try {
      const res = await fetch(`${base}/functions/v1/market-feed`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      if (!res.ok) throw new Error(`feed status ${res.status}`);
      const data = await res.json();
      const kw = keyword?.toLowerCase();
      const news = (data.news ?? [])
        .filter((n: any) => !kw || `${n.title} ${n.body} ${n.categories}`.toLowerCase().includes(kw))
        .slice(0, newsLimit)
        .map((n: any) => ({
          title: n.title,
          summary: String(n.body ?? "").slice(0, 280),
          source: n.source,
          publishedAt: n.published_on ? new Date(n.published_on * 1000).toISOString() : null,
          url: n.url,
        }));
      const events = (data.events ?? [])
        .filter((e: any) => !highImpactOnly || /high/i.test(e.impact))
        .slice(0, 40);
      const out = { news, events, fetchedAt: new Date().toISOString() };
      return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }], structuredContent: out };
    } catch (e) {
      return { content: [{ type: "text", text: `Could not load news: ${(e as Error).message}` }], isError: true };
    }
  },
});
