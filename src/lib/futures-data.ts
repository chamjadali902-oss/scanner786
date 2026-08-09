/**
 * Binance Futures positioning data (funding, open interest, long/short ratio).
 * Sab kuch best-effort hai — fail ho to null return karta hai aur score neutral rehta hai.
 */

import type { FuturesContext } from '@/lib/setup-score';

const FAPI = 'https://fapi.binance.com';

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

let fundingCache: { at: number; map: Map<string, number> } | null = null;

/** Ek hi call me saare futures symbols ka funding rate. */
export async function fetchAllFundingRates(): Promise<Map<string, number>> {
  if (fundingCache && Date.now() - fundingCache.at < 5 * 60 * 1000) return fundingCache.map;
  const data = await getJson<Array<{ symbol: string; lastFundingRate: string }>>(`${FAPI}/fapi/v1/premiumIndex`);
  const map = new Map<string, number>();
  if (data) {
    for (const d of data) {
      const v = parseFloat(d.lastFundingRate);
      if (!isNaN(v)) map.set(d.symbol, v);
    }
  }
  fundingCache = { at: Date.now(), map };
  return map;
}

/** Per-symbol OI change % + top trader long/short ratio (thoda heavy — sirf top results ke liye). */
export async function fetchSymbolFuturesContext(symbol: string, fundingRate?: number): Promise<FuturesContext> {
  const [oiHist, lsRatio] = await Promise.all([
    getJson<Array<{ sumOpenInterest: string }>>(`${FAPI}/futures/data/openInterestHist?symbol=${symbol}&period=1h&limit=24`),
    getJson<Array<{ longShortRatio: string }>>(`${FAPI}/futures/data/topLongShortAccountRatio?symbol=${symbol}&period=1h&limit=1`),
  ]);

  const ctx: FuturesContext = { fundingRate };

  if (oiHist && oiHist.length > 2) {
    const first = parseFloat(oiHist[0].sumOpenInterest);
    const lastVal = parseFloat(oiHist[oiHist.length - 1].sumOpenInterest);
    if (first > 0 && !isNaN(lastVal)) ctx.openInterestChange = ((lastVal - first) / first) * 100;
  }

  if (lsRatio && lsRatio.length) {
    const v = parseFloat(lsRatio[0].longShortRatio);
    if (!isNaN(v)) ctx.longShortRatio = v;
  }

  return ctx;
}
