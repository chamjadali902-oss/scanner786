import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { normalizeSymbol } from "../market";
import { fetchFuturesContext } from "../futures";

export default defineTool({
  name: "get_futures_data",
  title: "Get futures positioning",
  description:
    "Live perpetual futures positioning for a coin: mark price, funding rate and APR, open interest with 1h/4h/24h change, top-trader long/short ratio, taker buy/sell ratio and derived positioning signals.",
  inputSchema: {
    symbol: z.string().min(2).describe("Coin or pair, e.g. BTC, PEPEUSDT."),
  },
  annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: true },
  handler: async ({ symbol }) => {
    const pair = normalizeSymbol(symbol);
    try {
      const data = await fetchFuturesContext(pair);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }], structuredContent: data };
    } catch (e) {
      return { content: [{ type: "text", text: (e as Error).message }], isError: true };
    }
  },
});
