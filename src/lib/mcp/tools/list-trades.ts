import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_trades",
  title: "List trades",
  description: "List the signed-in user's journaled trades, optionally filtered by status or symbol.",
  inputSchema: {
    status: z.enum(["open", "closed", "all"]).default("all").describe("Filter by trade status."),
    symbol: z.string().optional().describe("Optional exact pair filter, e.g. BTCUSDT."),
    limit: z.number().int().min(1).max(100).default(25).describe("Maximum rows to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, symbol, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("trades")
      .select(
        "id, symbol, side, status, quantity, entry_price, exit_price, stop_loss, take_profit, pnl, pnl_percent, opened_at, closed_at, notes, tags",
      )
      .order("opened_at", { ascending: false })
      .limit(limit);
    if (status !== "all") query = query.eq("status", status);
    if (symbol) query = query.eq("symbol", symbol.trim().toUpperCase());
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { trades: data ?? [] },
    };
  },
});
