/**
 * Market data API configuration.
 * Change BINANCE_API_BASE to switch data providers.
 */

export const BINANCE_API_BASE = 'https://api.binance.com/api/v3';

// Timeframes used for live trade analysis
export const SHORT_TIMEFRAMES = ['1m', '5m', '15m', '30m'] as const;
export const LONG_TIMEFRAMES = ['1h', '4h', '1d'] as const;
export const ALL_TIMEFRAMES = [...SHORT_TIMEFRAMES, ...LONG_TIMEFRAMES] as const;

export interface RawCandle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Fetch klines/candles for a symbol from Binance.
 */
export async function fetchKlinesRaw(
  symbol: string,
  interval: string,
  limit = 500
): Promise<RawCandle[] | null> {
  try {
    const res = await fetch(
      `${BINANCE_API_BASE}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
    );
    if (!res.ok) return null;
    const raw: any[][] = await res.json();
    return raw.map(c => ({
      open: +c[1],
      high: +c[2],
      low: +c[3],
      close: +c[4],
      volume: +c[5],
    }));
  } catch {
    return null;
  }
}
