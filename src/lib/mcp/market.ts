// Binance blocks some server regions (HTTP 451). data-api.binance.vision is the
// public market-data mirror that is not geo-restricted, so it is tried first.
const SPOT_HOSTS = [
  "https://data-api.binance.vision",
  "https://api.binance.com",
  "https://api1.binance.com",
  "https://api4.binance.com",
];
const FUTURES_HOSTS = ["https://fapi.binance.com"];

export type Candle = { openTime: number; open: number; high: number; low: number; close: number; volume: number };

export function normalizeSymbol(input: string): string {
  const s = input.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /USDT$|USDC$|BTC$|ETH$/.test(s) ? s : `${s}USDT`;
}

async function tryHosts(hosts: string[], pathQuery: string): Promise<any> {
  let lastErr = "";
  for (const h of hosts) {
    try {
      const res = await fetch(`${h}${pathQuery}`);
      if (res.ok) return res.json();
      lastErr = `[${res.status}] ${(await res.text()).slice(0, 200)}`;
      if (res.status === 400) break; // bad symbol, no point retrying
    } catch (e) {
      lastErr = (e as Error).message;
    }
  }
  throw new Error(`Binance request failed ${lastErr}`);
}

// Futures first, then fall back to spot mirror (same price action for USDT pairs).
async function getMarket(market: "spot" | "futures", endpoint: string, query: string) {
  if (market === "futures") {
    try {
      return await tryHosts(FUTURES_HOSTS, `/fapi/v1${endpoint}?${query}`);
    } catch {
      /* geo-blocked: fall through to spot */
    }
  }
  return tryHosts(SPOT_HOSTS, `/api/v3${endpoint}?${query}`);
}

export async function fetchTicker(symbol: string, market: "spot" | "futures") {
  const [price, stats] = await Promise.all([
    getMarket(market, "/ticker/price", `symbol=${symbol}`),
    getMarket(market, "/ticker/24hr", `symbol=${symbol}`),
  ]);
  return {
    price: Number(price.price),
    changePercent24h: Number(stats.priceChangePercent),
    high24h: Number(stats.highPrice),
    low24h: Number(stats.lowPrice),
    quoteVolume24h: Number(stats.quoteVolume),
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchCandles(
  symbol: string,
  interval: string,
  limit: number,
  market: "spot" | "futures",
): Promise<Candle[]> {
  const raw: any[] = await getMarket(market, "/klines", `symbol=${symbol}&interval=${interval}&limit=${limit}`);
  return raw.map((k) => ({
    openTime: k[0],
    open: Number(k[1]),
    high: Number(k[2]),
    low: Number(k[3]),
    close: Number(k[4]),
    volume: Number(k[5]),
  }));
}

export function ema(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const k = 2 / (period + 1);
  let acc = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) acc = values[i] * k + acc * (1 - k);
  return acc;
}

// Wilder's smoothing RSI (TradingView parity).
export function rsi(values: number[], period = 14): number | null {
  if (values.length < period + 1) return null;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  gain /= period;
  loss /= period;
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    gain = (gain * (period - 1) + Math.max(d, 0)) / period;
    loss = (loss * (period - 1) + Math.max(-d, 0)) / period;
  }
  if (loss === 0) return 100;
  return 100 - 100 / (1 + gain / loss);
}

export function swingLevels(candles: Candle[], lookback = 60) {
  const window = candles.slice(-lookback);
  const high = Math.max(...window.map((c) => c.high));
  const low = Math.min(...window.map((c) => c.low));
  return { swingHigh: high, swingLow: low, range: high - low };
}
