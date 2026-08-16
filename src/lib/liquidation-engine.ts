/**
 * Liquidation & Positioning Engine
 * --------------------------------
 * 1) Leverage-cluster heatmap PROXY:
 *    Binance public API liquidation levels expose nahi karta, is liye hum
 *    volume-weighted entry zones (last N candles ke typical price + volume)
 *    par common leverage tiers (10x/25x/50x/100x) ke liquidation prices
 *    calculate kar ke price buckets me aggregate karte hain. Jahan sabse zyada
 *    weight banta hai wahan liquidation "magnet" hota hai.
 *
 * 2) Funding / OI-delta divergence:
 *    Price direction ko funding rate aur open-interest change ke against compare
 *    kar ke batata hai kaun trapped hai (crowded longs vs shorts, squeeze fuel).
 */

import { Candle } from '@/types/scanner';

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

export interface LiqCluster {
  /** Bucket ka center price. */
  price: number;
  /** Kis side ke positions yahan liquidate honge. */
  side: 'long' | 'short';
  /** Dominant leverage tier is bucket me. */
  leverage: number;
  /** 0-100 relative intensity (heatmap ke liye). */
  intensity: number;
  /** Current price se distance %. */
  distancePct: number;
}

export type PositioningVerdict =
  | 'crowded_longs'
  | 'crowded_shorts'
  | 'long_squeeze_risk'
  | 'short_squeeze_fuel'
  | 'healthy_trend'
  | 'neutral';

export interface DivergenceSignal {
  key: string;
  label: string;
  bias: 'long' | 'short' | 'neutral';
  strength: number; // 0-10
  note: string;
}

export interface PositioningData {
  symbol: string;
  price: number;
  fundingRate: number | null;      // decimal (0.0001 = 0.01%)
  fundingAnnualPct: number | null;
  oiChange1h: number | null;       // %
  oiChange4h: number | null;       // %
  oiChange24h: number | null;      // %
  priceChange1h: number | null;    // %
  priceChange24h: number | null;   // %
  takerBuySellRatio: number | null;
  topTraderLongShort: number | null;
  clusters: LiqCluster[];
  /** Nearest heavy cluster (magnet). */
  magnet: LiqCluster | null;
  signals: DivergenceSignal[];
  verdict: PositioningVerdict;
  verdictNote: string;
  /** -10..+10 — long ke favour me positive. */
  biasScore: number;
}

const LEVERAGES = [10, 25, 50, 100];
const MAINT_MARGIN = 0.005; // ~0.5% average maintenance margin

/** Volume-weighted entry proxies se liquidation clusters banata hai. */
export function buildLeverageClusters(candles: Candle[], livePrice?: number): LiqCluster[] {
  if (candles.length < 30) return [];
  const price = livePrice ?? candles[candles.length - 1].close;
  const window = candles.slice(-200);

  // bucket size = 0.4% of price
  const bucketSize = price * 0.004;
  type Bucket = { weight: number; levWeight: Record<number, number> };
  const longBuckets = new Map<number, Bucket>();
  const shortBuckets = new Map<number, Bucket>();

  const totalVol = window.reduce((a, c) => a + c.volume, 0) || 1;

  for (const c of window) {
    const entry = (c.high + c.low + c.close) / 3;
    const w = c.volume / totalVol;
    if (w <= 0) continue;
    for (const lev of LEVERAGES) {
      const liqDist = 1 / lev - MAINT_MARGIN;
      if (liqDist <= 0) continue;
      // higher leverage = zyada retail crowding weight
      const levWeight = w * (lev >= 50 ? 1.3 : lev >= 25 ? 1.1 : 0.8);

      const longLiq = entry * (1 - liqDist);
      const shortLiq = entry * (1 + liqDist);

      for (const [map, liq] of [[longBuckets, longLiq], [shortBuckets, shortLiq]] as const) {
        // sirf un liquidations ka matlab hai jo abhi tak trigger nahi hui
        const isLong = map === longBuckets;
        if (isLong && liq >= price) continue;   // long liq price ke neeche hoti hai
        if (!isLong && liq <= price) continue;  // short liq price ke upar
        if (Math.abs((liq - price) / price) > 0.18) continue;
        const key = Math.round(liq / bucketSize);
        const b = map.get(key) ?? { weight: 0, levWeight: {} };
        b.weight += levWeight;
        b.levWeight[lev] = (b.levWeight[lev] ?? 0) + levWeight;
        map.set(key, b);
      }
    }
  }

  const out: LiqCluster[] = [];
  const collect = (map: Map<number, Bucket>, side: 'long' | 'short') => {
    const entries = [...map.entries()];
    if (!entries.length) return;
    const max = Math.max(...entries.map(([, b]) => b.weight)) || 1;
    for (const [key, b] of entries) {
      const p = key * bucketSize;
      const lev = Number(Object.entries(b.levWeight).sort((a, z) => z[1] - a[1])[0][0]);
      out.push({
        price: p,
        side,
        leverage: lev,
        intensity: Math.round((b.weight / max) * 100),
        distancePct: ((p - price) / price) * 100,
      });
    }
  };
  collect(longBuckets, 'long');
  collect(shortBuckets, 'short');

  return out
    .filter(c => c.intensity >= 25)
    .sort((a, b) => b.intensity - a.intensity)
    .slice(0, 12);
}

function pct(a: number, b: number) {
  if (!b) return null;
  return ((a - b) / b) * 100;
}

/** Funding + OI + taker positioning fetch kar ke divergence signals banata hai. */
export async function fetchPositioning(symbol: string, candles?: Candle[], livePrice?: number): Promise<PositioningData> {
  const [premium, oiHist, taker, topTrader, ticker] = await Promise.all([
    getJson<{ lastFundingRate: string; markPrice: string }>(`${FAPI}/fapi/v1/premiumIndex?symbol=${symbol}`),
    getJson<Array<{ sumOpenInterest: string; timestamp: number }>>(`${FAPI}/futures/data/openInterestHist?symbol=${symbol}&period=1h&limit=25`),
    getJson<Array<{ buySellRatio: string }>>(`${FAPI}/futures/data/takerlongshortRatio?symbol=${symbol}&period=1h&limit=1`),
    getJson<Array<{ longShortRatio: string }>>(`${FAPI}/futures/data/topLongShortPositionRatio?symbol=${symbol}&period=1h&limit=1`),
    getJson<{ lastPrice: string; priceChangePercent: string }>(`${FAPI}/fapi/v1/ticker/24hr?symbol=${symbol}`),
  ]);

  const price = livePrice
    ?? (ticker ? parseFloat(ticker.lastPrice) : undefined)
    ?? (premium ? parseFloat(premium.markPrice) : undefined)
    ?? (candles?.length ? candles[candles.length - 1].close : 0);

  const fundingRate = premium ? parseFloat(premium.lastFundingRate) : null;
  const fundingAnnualPct = fundingRate != null ? fundingRate * 3 * 365 * 100 : null;

  let oiChange1h: number | null = null, oiChange4h: number | null = null, oiChange24h: number | null = null;
  if (oiHist && oiHist.length > 2) {
    const vals = oiHist.map(o => parseFloat(o.sumOpenInterest)).filter(v => !isNaN(v));
    const last = vals[vals.length - 1];
    oiChange1h = vals.length >= 2 ? pct(last, vals[vals.length - 2]) : null;
    oiChange4h = vals.length >= 5 ? pct(last, vals[vals.length - 5]) : null;
    oiChange24h = pct(last, vals[0]);
  }

  let priceChange1h: number | null = null;
  if (candles && candles.length > 2) {
    const lastC = candles[candles.length - 1].close;
    // approx 1h back: agar candles chhote tf ke hain to index adjust nahi karte, generic 4 candles
    const back = candles[Math.max(0, candles.length - 5)].close;
    priceChange1h = pct(lastC, back);
  }
  const priceChange24h = ticker ? parseFloat(ticker.priceChangePercent) : null;

  const takerBuySellRatio = taker?.length ? parseFloat(taker[0].buySellRatio) : null;
  const topTraderLongShort = topTrader?.length ? parseFloat(topTrader[0].longShortRatio) : null;

  const signals: DivergenceSignal[] = [];
  let biasScore = 0;

  const up = (priceChange1h ?? priceChange24h ?? 0) > 0;
  const oi = oiChange1h ?? oiChange4h ?? oiChange24h;

  // ---- Funding / OI delta divergences ----
  if (fundingRate != null && oi != null) {
    if (up && oi > 1 && fundingRate > 0.0004) {
      signals.push({ key: 'crowded_longs', label: 'Crowded longs', bias: 'short', strength: 7,
        note: `Price up + OI +${oi.toFixed(2)}% + funding ${(fundingRate * 100).toFixed(4)}% — late longs leverage par, long-squeeze fuel banta ja raha hai.` });
      biasScore -= 6;
    }
    if (up && oi < -1) {
      signals.push({ key: 'short_covering', label: 'Short covering rally', bias: 'neutral', strength: 5,
        note: `Price up par OI ${oi.toFixed(2)}% gir gaya — ye short covering hai, naya buying nahi. Continuation weak.` });
      biasScore -= 2;
    }
    if (!up && oi > 1 && fundingRate < -0.0002) {
      signals.push({ key: 'crowded_shorts', label: 'Crowded shorts', bias: 'long', strength: 7,
        note: `Price down + OI +${oi.toFixed(2)}% + negative funding ${(fundingRate * 100).toFixed(4)}% — shorts stacked, short-squeeze fuel ready.` });
      biasScore += 6;
    }
    if (!up && oi < -1) {
      signals.push({ key: 'long_flush', label: 'Long flush complete', bias: 'long', strength: 4,
        note: `Price down + OI ${oi.toFixed(2)}% — leveraged longs flush ho chuke, downside fuel kam.` });
      biasScore += 3;
    }
    if (up && oi > 1 && Math.abs(fundingRate) < 0.0002) {
      signals.push({ key: 'healthy_trend', label: 'Healthy expansion', bias: 'long', strength: 5,
        note: `OI +${oi.toFixed(2)}% ke sath funding neutral — spot-led move, trend healthy.` });
      biasScore += 4;
    }
  }

  // Funding extreme (contrarian)
  if (fundingRate != null) {
    if (fundingRate > 0.001) { signals.push({ key: 'funding_hot', label: 'Funding extreme +', bias: 'short', strength: 6, note: `Funding ${(fundingRate * 100).toFixed(4)}% (${fundingAnnualPct?.toFixed(0)}% APR) — longs pay heavy, mean-reversion risk.` }); biasScore -= 4; }
    else if (fundingRate < -0.0005) { signals.push({ key: 'funding_cold', label: 'Funding extreme -', bias: 'long', strength: 6, note: `Funding ${(fundingRate * 100).toFixed(4)}% — shorts pay, squeeze probability high.` }); biasScore += 4; }
  }

  // Taker aggression vs price divergence
  if (takerBuySellRatio != null) {
    if (takerBuySellRatio > 1.15 && !up) { signals.push({ key: 'taker_div_bull', label: 'Taker buy divergence', bias: 'long', strength: 5, note: `Taker buy/sell ${takerBuySellRatio.toFixed(2)} par price down — sellers absorbed ho rahe.` }); biasScore += 3; }
    if (takerBuySellRatio < 0.87 && up) { signals.push({ key: 'taker_div_bear', label: 'Taker sell divergence', bias: 'short', strength: 5, note: `Taker buy/sell ${takerBuySellRatio.toFixed(2)} par price up — rally distribution me ho rahi.` }); biasScore -= 3; }
  }

  // Top trader positioning (smart money proxy)
  if (topTraderLongShort != null) {
    if (topTraderLongShort > 2) { signals.push({ key: 'top_long', label: 'Top traders long', bias: 'long', strength: 4, note: `Top trader position ratio ${topTraderLongShort.toFixed(2)} — bade accounts long side par.` }); biasScore += 2; }
    if (topTraderLongShort < 0.6) { signals.push({ key: 'top_short', label: 'Top traders short', bias: 'short', strength: 4, note: `Top trader position ratio ${topTraderLongShort.toFixed(2)} — bade accounts short side par.` }); biasScore -= 2; }
  }

  const clusters = candles ? buildLeverageClusters(candles, price) : [];
  const magnet = clusters.length
    ? [...clusters].sort((a, b) =>
        (Math.abs(a.distancePct) / Math.max(a.intensity, 1)) - (Math.abs(b.distancePct) / Math.max(b.intensity, 1)))[0]
    : null;

  if (magnet) {
    const dir = magnet.side === 'long' ? 'neeche' : 'upar';
    signals.push({
      key: 'liq_magnet',
      label: `Liquidation magnet ${magnet.distancePct >= 0 ? '+' : ''}${magnet.distancePct.toFixed(2)}%`,
      bias: magnet.side === 'long' ? 'short' : 'long',
      strength: Math.round(magnet.intensity / 12),
      note: `${magnet.price.toPrecision(6)} par heavy ${magnet.leverage}x ${magnet.side} liquidation cluster (${dir}, intensity ${magnet.intensity}) — price wahan magnet ki tarah kheenchta hai.`,
    });
    biasScore += magnet.side === 'long' ? -2 : 2;
  }

  let verdict: PositioningVerdict = 'neutral';
  if (signals.some(s => s.key === 'crowded_longs')) verdict = 'crowded_longs';
  else if (signals.some(s => s.key === 'crowded_shorts')) verdict = 'crowded_shorts';
  else if (signals.some(s => s.key === 'funding_hot')) verdict = 'long_squeeze_risk';
  else if (signals.some(s => s.key === 'funding_cold' || s.key === 'long_flush')) verdict = 'short_squeeze_fuel';
  else if (signals.some(s => s.key === 'healthy_trend')) verdict = 'healthy_trend';

  const verdictNote: Record<PositioningVerdict, string> = {
    crowded_longs: 'Longs crowded aur leveraged — upar chase karna mehnga, dips par liquidity grab expect karein.',
    crowded_shorts: 'Shorts crowded — upar ki taraf squeeze ka fuel maujood hai.',
    long_squeeze_risk: 'Funding overheated — long positions ke liye squeeze risk elevated.',
    short_squeeze_fuel: 'Short side stress me — squeeze / reversal probability zyada.',
    healthy_trend: 'Positioning healthy — trend continuation ke sath jaana theek hai.',
    neutral: 'Positioning balanced — koi clear crowded side nahi.',
  };

  return {
    symbol, price, fundingRate, fundingAnnualPct,
    oiChange1h, oiChange4h, oiChange24h,
    priceChange1h, priceChange24h,
    takerBuySellRatio, topTraderLongShort,
    clusters, magnet, signals, verdict,
    verdictNote: verdictNote[verdict],
    biasScore: Math.max(-10, Math.min(10, biasScore)),
  };
}
