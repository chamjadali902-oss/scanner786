import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { ema, fetchCandles, rsi, type Candle } from "../market";

const SPOT = ["https://data-api.binance.vision", "https://api.binance.com"];

async function tickers(): Promise<any[]> {
  for (const h of SPOT) {
    try {
      const r = await fetch(`${h}/api/v3/ticker/24hr`);
      if (r.ok) return r.json();
    } catch { /* next */ }
  }
  throw new Error("Could not load Binance tickers");
}

function analyse(c: Candle[]) {
  const closes = c.map((x) => x.close);
  const price = closes[closes.length - 1];
  const e20 = ema(closes, 20), e50 = ema(closes, 50), e200 = ema(closes, 200);
  const r = rsi(closes, 14);
  const prevR = rsi(closes.slice(0, -1), 14);
  const vols = c.slice(-21, -1).map((x) => x.volume);
  const avgVol = vols.reduce((a, b) => a + b, 0) / (vols.length || 1);
  const volRatio = avgVol ? c[c.length - 1].volume / avgVol : 0;
  const prev = c.slice(-21, -1);
  const hh = Math.max(...prev.map((x) => x.high));
  const ll = Math.min(...prev.map((x) => x.low));
  const last = c[c.length - 1];
  const trend = e20 && e50 ? (price > e20 && e20 > e50 ? "up" : price < e20 && e20 < e50 ? "down" : "range") : "range";
  const tags: string[] = [];
  if (r !== null && r < 30) tags.push("rsi_oversold");
  if (r !== null && r > 70) tags.push("rsi_overbought");
  if (r !== null && prevR !== null && prevR < 30 && r >= 30) tags.push("rsi_bounce");
  if (volRatio >= 2) tags.push("volume_spike");
  if (last.close > hh) tags.push("breakout_up");
  if (last.close < ll) tags.push("breakdown");
  if (last.low < ll && last.close > ll) tags.push("bullish_sweep_reclaim");
  if (last.high > hh && last.close < hh) tags.push("bearish_sweep_reject");
  if (trend === "up") tags.push("uptrend");
  if (trend === "down") tags.push("downtrend");
  if (e200 && price > e200) tags.push("above_ema200");
  return { price, rsi14: r, ema20: e20, ema50: e50, ema200: e200, volumeRatio: volRatio, range20High: hh, range20Low: ll, trend, tags };
}

const SETUPS = [
  "any", "rsi_oversold", "rsi_overbought", "rsi_bounce", "volume_spike", "breakout_up",
  "breakdown", "bullish_sweep_reclaim", "bearish_sweep_reject", "uptrend", "downtrend",
] as const;

export default defineTool({
  name: "run_scanner",
  title: "Run market scanner",
  description:
    "Scan the top Binance USDT pairs by 24h volume on a timeframe and return coins matching setups: RSI oversold/overbought/bounce, volume spike, 20-candle breakout/breakdown, liquidity sweep reclaim/reject, trend. All listed setups must match. Results include price, RSI, EMAs, volume ratio and tags.",
  inputSchema: {
    timeframe: z.string().default("1h").describe("Binance interval: 5m, 15m, 1h, 4h, 1d."),
    setups: z.array(z.enum(SETUPS)).default(["any"]).describe("Setups that must all match. 'any' returns all scanned coins ranked."),
    topN: z.number().int().min(10).max(150).default(60).describe("How many top-volume coins to scan."),
    maxResults: z.number().int().min(1).max(50).default(20),
  },
  annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: true },
  handler: async ({ timeframe, setups, topN, maxResults }) => {
    try {
      const all = await tickers();
      const pool = all
        .filter((t) => t.symbol.endsWith("USDT") && !/(UP|DOWN|BULL|BEAR)USDT$|^(USDC|FDUSD|TUSD|BUSD|DAI)USDT$/.test(t.symbol))
        .sort((a, b) => Number(b.quoteVolume) - Number(a.quoteVolume))
        .slice(0, topN);
      const want = setups.filter((s) => s !== "any");
      const results: any[] = [];
      for (let i = 0; i < pool.length; i += 15) {
        const batch = await Promise.all(pool.slice(i, i + 15).map(async (t) => {
          try {
            const c = await fetchCandles(t.symbol, timeframe, 250, "spot");
            if (c.length < 60) return null;
            const a = analyse(c);
            if (!want.every((s) => a.tags.includes(s))) return null;
            return { symbol: t.symbol, change24hPct: Number(t.priceChangePercent), quoteVolume24h: Number(t.quoteVolume), ...a };
          } catch { return null; }
        }));
        results.push(...batch.filter(Boolean));
      }
      results.sort((a, b) => b.tags.length - a.tags.length || b.volumeRatio - a.volumeRatio);
      const out = { timeframe, setups, scanned: pool.length, matched: results.length, results: results.slice(0, maxResults), scannedAt: new Date().toISOString() };
      return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }], structuredContent: out };
    } catch (e) {
      return { content: [{ type: "text", text: `Scan failed: ${(e as Error).message}` }], isError: true };
    }
  },
});
