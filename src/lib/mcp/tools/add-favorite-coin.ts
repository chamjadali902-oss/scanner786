import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { normalizeSymbol } from "../market";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "add_favorite_coin",
  title: "Add favorite coin",
  description: "Add a coin to the signed-in user's favorite coins watchlist.",
  inputSchema: {
    symbol: z.string().min(2).describe("Coin or pair, e.g. SOL or SOLUSDT."),
  },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ symbol }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const pair = normalizeSymbol(symbol);
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("favorite_coins")
      .insert({ user_id: ctx.getUserId(), symbol: pair })
      .select("symbol, added_at");
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Added ${pair} to favorites.` }],
      structuredContent: { favorite: data?.[0] ?? { symbol: pair } },
    };
  },
});
