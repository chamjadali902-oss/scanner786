import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_saved_strategies",
  title: "List saved strategies",
  description: "List the signed-in user's saved scanner strategies with their conditions, timeframe and scan pool.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).default(20).describe("Maximum strategies to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("saved_strategies")
      .select("id, name, description, timeframe, scan_pool, conditions, updated_at")
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { strategies: data ?? [] },
    };
  },
});
