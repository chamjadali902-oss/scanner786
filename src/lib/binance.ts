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

export async function fetchKlines(
  symbol: string,
  interval: Timeframe,
  limit = 500
): Promise<Candle[]> {
  const data = await fetchWithRetry<any[][]>(
    `${BINANCE_DATA_API}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
  );
  
  return data.map(k => ({
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
  const tvInterval = {
    '1m': '1',
    '3m': '3',
    '5m': '5',
    '15m': '15',
    '1h': '60',
    '4h': '240',
    '1d': 'D',
  }[interval];
  
  return `https://www.tradingview.com/chart/?symbol=BINANCE:${pair}USDT&interval=${tvInterval}`;
}

export function isRateLimited(): boolean {
  return rateLimitState.isLimited && rateLimitState.retryAfter > Date.now();
}

export function getRateLimitWaitTime(): number {
  return Math.max(0, rateLimitState.retryAfter - Date.now());
}
