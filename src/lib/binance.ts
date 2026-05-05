import { Candle, TickerData, ScanPool, Timeframe } from '@/types/scanner';

// Binance data API has better CORS support for public endpoints
// https://data-api.binance.vision is specifically for public data access
const BINANCE_DATA_API = 'https://data-api.binance.vision/api/v3';

interface RateLimitState {
  retryAfter: number;
  isLimited: boolean;
}

let rateLimitState: RateLimitState = { retryAfter: 0, isLimited: false };

// Cache for valid trading symbols
let validSymbolsCache: Set<string> | null = null;
let symbolsCacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Exclusion patterns
const EXCLUDED_SUFFIXES = ['UP', 'DOWN', 'BULL', 'BEAR'];
const EXCLUDED_PAIRS = ['USDCUSDT', 'TUSDUSDT', 'FDUSDUSDT', 'BUSDUSDT', 'USDPUSDT', 'EURUSDT', 'GBPUSDT'];

async function fetchWithRetry<T>(
  url: string,
  options: RequestInit = {},
  maxRetries = 3
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Wait if rate limited
    if (rateLimitState.isLimited) {
      const waitTime = Math.max(0, rateLimitState.retryAfter - Date.now());
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      rateLimitState.isLimited = false;
    }
    
    try {
      const response = await fetch(url, {
        ...options,
        mode: 'cors',
        headers: {
          'Accept': 'application/json',
          ...options.headers,
        },
      });
      
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
        rateLimitState = {
          isLimited: true,
          retryAfter: Date.now() + retryAfter * 1000,
        };
        throw new Error('Rate limited');
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxRetries - 1) {
        // Exponential backoff
        await new Promise(resolve => 
          setTimeout(resolve, Math.pow(2, attempt) * 500)
        );
      }
    }
  }
  
  throw lastError || new Error('Failed after max retries');
}

// Fetch valid trading symbols from exchangeInfo
export async function fetchValidTradingSymbols(): Promise<Set<string>> {
  // Return cached if still valid
  if (validSymbolsCache && Date.now() - symbolsCacheTime < CACHE_DURATION) {
    return validSymbolsCache;
  }

  const data = await fetchWithRetry<{
    symbols: Array<{
      symbol: string;
      status: string;
      quoteAsset: string;
      baseAsset: string;
    }>;
  }>(`${BINANCE_DATA_API}/exchangeInfo`);

  const validSymbols = new Set<string>();

  for (const symbolInfo of data.symbols) {
    // Filter: status === "TRADING" AND quoteAsset === "USDT"
    if (symbolInfo.status !== 'TRADING' || symbolInfo.quoteAsset !== 'USDT') {
      continue;
    }

    // Exclude leveraged tokens (UP, DOWN, BULL, BEAR)
    const baseAsset = symbolInfo.baseAsset;
    if (EXCLUDED_SUFFIXES.some(suffix => baseAsset.endsWith(suffix))) {
      continue;
    }

    // Exclude stablecoin pairs
    if (EXCLUDED_PAIRS.includes(symbolInfo.symbol)) {
      continue;
    }

    validSymbols.add(symbolInfo.symbol);
  }

  validSymbolsCache = validSymbols;
  symbolsCacheTime = Date.now();

  return validSymbols;
}

export async function fetchTicker24h(): Promise<TickerData[]> {
  // Fetch both ticker data and valid symbols in parallel
  const [tickerData, validSymbols] = await Promise.all([
    fetchWithRetry<TickerData[]>(`${BINANCE_DATA_API}/ticker/24hr`),
    fetchValidTradingSymbols(),
  ]);
  
  // Filter to only valid USDT trading pairs
  return tickerData.filter(t => validSymbols.has(t.symbol));
}

export function getTopCoins(tickers: TickerData[], pool: ScanPool, limit = 100): TickerData[] {
  const sorted = [...tickers];
  
  switch (pool) {
    case 'losers':
      sorted.sort((a, b) => parseFloat(a.priceChangePercent) - parseFloat(b.priceChangePercent));
      break;
    case 'gainers':
      sorted.sort((a, b) => parseFloat(b.priceChangePercent) - parseFloat(a.priceChangePercent));
      break;
    case 'volume':
      sorted.sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume));
      break;
  }
  
  return sorted.slice(0, limit);
}

// Map any timeframe to a native Binance interval + aggregation factor.
// Examples: 9m -> {base:'1m', factor:9}, 45m -> {base:'15m',factor:3}, 3h -> {base:'1h',factor:3}
function resolveInterval(tf: Timeframe): { base: Timeframe; factor: number } {
  const NATIVE: Timeframe[] = ['1m','3m','5m','15m','30m','1h','2h','4h','6h','8h','12h','1d','3d','1w','1M'];
  if (NATIVE.includes(tf)) return { base: tf, factor: 1 };
  const m = /^(\d+)(m|h|d|w|M)$/.exec(tf);
  if (!m) return { base: tf, factor: 1 };
  const n = parseInt(m[1], 10);
  const unit = m[2] as 'm'|'h'|'d'|'w'|'M';

  if (unit === 'm') {
    // pick largest native minute interval that divides n
    const mins = [30, 15, 5, 3, 1];
    for (const b of mins) if (n % b === 0) return { base: `${b}m`, factor: n / b };
    return { base: '1m', factor: n };
  }
  if (unit === 'h') {
    const hrs = [12, 8, 6, 4, 2, 1];
    for (const b of hrs) if (n % b === 0) return { base: `${b}h`, factor: n / b };
    return { base: '1h', factor: n };
  }
  if (unit === 'd') {
    if (n % 3 === 0) return { base: '3d', factor: n / 3 };
    return { base: '1d', factor: n };
  }
  if (unit === 'w') return { base: '1w', factor: n };
  if (unit === 'M') return { base: '1M', factor: n };
  return { base: tf, factor: 1 };
}

function aggregateCandles(candles: Candle[], factor: number): Candle[] {
  if (factor <= 1) return candles;
  const out: Candle[] = [];
  // Drop any leading partial group so groups align to multiples of `factor` from the end
  const start = candles.length % factor;
  for (let i = start; i + factor <= candles.length; i += factor) {
    const slice = candles.slice(i, i + factor);
    const first = slice[0];
    const last = slice[slice.length - 1];
    let high = -Infinity, low = Infinity, vol = 0, qvol = 0, trades = 0;
    for (const c of slice) {
      if (c.high > high) high = c.high;
      if (c.low < low) low = c.low;
      vol += c.volume;
      qvol += c.quoteVolume;
      trades += c.trades;
    }
    out.push({
      openTime: first.openTime,
      open: first.open,
      high,
      low,
      close: last.close,
      volume: vol,
      closeTime: last.closeTime,
      quoteVolume: qvol,
      trades,
    });
  }
  return out;
}

export async function fetchKlines(
  symbol: string,
  interval: Timeframe,
  limit = 500
): Promise<Candle[]> {
  const { base, factor } = resolveInterval(interval);
  // Fetch enough base candles to produce `limit` aggregated candles (cap at 1000 per Binance limit)
  const baseLimit = Math.min(1000, Math.max(limit, limit * factor));
  const data = await fetchWithRetry<any[][]>(
    `${BINANCE_DATA_API}/klines?symbol=${symbol}&interval=${base}&limit=${baseLimit}`
  );

  const baseCandles: Candle[] = data.map(k => ({
    openTime: k[0],
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
    closeTime: k[6],
    quoteVolume: parseFloat(k[7]),
    trades: k[8],
  }));

  return aggregateCandles(baseCandles, factor);
}

export async function fetchCurrentPrice(symbol: string): Promise<number> {
  const data = await fetchWithRetry<{ price: string }>(
    `${BINANCE_DATA_API}/ticker/price?symbol=${symbol}`
  );
  return parseFloat(data.price);
}

// Batch fetch klines for multiple symbols with rate limiting
export async function batchFetchKlines(
  symbols: string[],
  interval: Timeframe,
  limit = 500,
  onProgress?: (completed: number, total: number) => void
): Promise<Map<string, Candle[]>> {
  const results = new Map<string, Candle[]>();
  const batchSize = 10; // Fetch 10 at a time to avoid rate limits
  
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    
    const promises = batch.map(async (symbol) => {
      try {
        const candles = await fetchKlines(symbol, interval, limit);
        return { symbol, candles };
      } catch (error) {
        console.error(`Failed to fetch ${symbol}:`, error);
        return { symbol, candles: null };
      }
    });
    
    const batchResults = await Promise.all(promises);
    
    batchResults.forEach(({ symbol, candles }) => {
      if (candles) {
        results.set(symbol, candles);
      }
    });
    
    if (onProgress) {
      onProgress(Math.min(i + batchSize, symbols.length), symbols.length);
    }
    
    // Small delay between batches to prevent rate limiting
    if (i + batchSize < symbols.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  return results;
}

export function getTradingViewLink(symbol: string, interval: Timeframe): string {
  // Remove USDT suffix for TradingView
  const pair = symbol.replace('USDT', '');
  const tvIntervalMap: Record<string, string> = {
    '1m': '1', '3m': '3', '5m': '5', '15m': '15', '30m': '30',
    '1h': '60', '2h': '120', '4h': '240', '6h': '360', '8h': '480', '12h': '720',
    '1d': 'D', '3d': '3D', '1w': 'W', '1M': 'M',
  };
  // For custom timeframes (e.g. 9m, 45m, 3h), TradingView supports raw minute counts as numbers
  let tvInterval = tvIntervalMap[interval];
  if (!tvInterval) {
    const m = /^(\d+)(m|h|d|w|M)$/.exec(interval);
    if (m) {
      const n = parseInt(m[1], 10);
      const unit = m[2];
      if (unit === 'm') tvInterval = String(n);
      else if (unit === 'h') tvInterval = String(n * 60);
      else if (unit === 'd') tvInterval = `${n}D`;
      else if (unit === 'w') tvInterval = `${n}W`;
      else if (unit === 'M') tvInterval = `${n}M`;
    }
  }
  if (!tvInterval) tvInterval = '60';
  
  return `https://www.tradingview.com/chart/?symbol=BINANCE:${pair}USDT&interval=${tvInterval}`;
}

export function isRateLimited(): boolean {
  return rateLimitState.isLimited && rateLimitState.retryAfter > Date.now();
}

export function getRateLimitWaitTime(): number {
  return Math.max(0, rateLimitState.retryAfter - Date.now());
}
