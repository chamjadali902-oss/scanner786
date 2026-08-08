import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { normalizeSymbol } from "../market";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "remove_favorite_coin",
  title: "Remove favorite coin",
  description: "Remove a coin from the signed-in user's favorite coins watchlist.",
  inputSchema: {
    symbol: z.string().min(2).describe("Coin or pair to remove, e.g. SOLUSDT."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ symbol }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const pair = normalizeSymbol(symbol);
    const supabase = supabaseForUser(ctx);
    const { error } = await supabase.from("favorite_coins").delete().eq("symbol", pair);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: `Removed ${pair} from favorites.` }] };
  },
});
