import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { ema, fetchCandles, fetchTicker, normalizeSymbol, rsi, swingLevels } from "../market";

export default defineTool({
  name: "get_market_snapshot",
  title: "Get market snapshot",
  description:
    "Fetch a live Binance snapshot for a coin and timeframe: current price, 24h stats, EMA20/EMA50, RSI(14), swing high/low and the last candles. Works for spot and futures.",
  inputSchema: {
    symbol: z.string().min(2).describe("Coin or pair, e.g. BTC, BTCUSDT, SOLUSDT."),
    timeframe: z
      .string()
      .default("1h")
      .describe("Binance interval such as 15m, 1h, 4h, 1d."),
    market: z.enum(["spot", "futures"]).default("spot").describe("Binance market."),
  },
  annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: true },
  handler: async ({ symbol, timeframe, market }) => {
    const pair = normalizeSymbol(symbol);
    try {
      const [ticker, candles] = await Promise.all([
        fetchTicker(pair, market),
        fetchCandles(pair, timeframe, 500, market),
      ]);
      const closes = candles.map((c) => c.close);
      const snapshot = {
        symbol: pair,
        market,
        timeframe,
        ...ticker,
        ema20: ema(closes, 20),
        ema50: ema(closes, 50),
        ema200: ema(closes, 200),
        rsi14: rsi(closes, 14),
        ...swingLevels(candles),
        candleCount: candles.length,
        lastCandles: candles.slice(-5),
      };
      return {
        content: [{ type: "text", text: JSON.stringify(snapshot, null, 2) }],
        structuredContent: snapshot,
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Could not load market data for ${pair}: ${(error as Error).message}` }],
        isError: true,
      };
    }
  },
});
