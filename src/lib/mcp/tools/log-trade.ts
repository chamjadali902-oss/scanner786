import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { normalizeSymbol } from "../market";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "log_trade",
  title: "Log a trade",
  description: "Record a new trade in the signed-in user's trade journal.",
  inputSchema: {
    symbol: z.string().min(2).describe("Pair, e.g. BTCUSDT."),
    side: z.enum(["long", "short"]).describe("Trade direction."),
    entry_price: z.number().positive().describe("Entry price."),
    quantity: z.number().positive().default(1).describe("Position size."),
    stop_loss: z.number().positive().optional().describe("Stop loss price."),
    take_profit: z.number().positive().optional().describe("Take profit price."),
    notes: z.string().max(2000).optional().describe("Trade rationale or notes."),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("trades")
      .insert({
        user_id: ctx.getUserId(),
        symbol: normalizeSymbol(input.symbol),
        side: input.side,
        entry_price: input.entry_price,
        quantity: input.quantity,
        stop_loss: input.stop_loss ?? null,
        take_profit: input.take_profit ?? null,
        notes: input.notes ?? null,
        status: "open",
      })
      .select("id, symbol, side, entry_price, quantity, status, opened_at");
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data?.[0] ?? {}, null, 2) }],
      structuredContent: { trade: data?.[0] },
    };
  },
});
