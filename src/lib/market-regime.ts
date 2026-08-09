/**
 * Market Regime Filter
 * --------------------
 * Purani strategies isliye fail hoti hain ke same setup trending aur ranging
 * market me chalaya jata hai. Ye module BTC structure + volatility + sentiment
 * se market ka regime nikaalta hai aur batata hai aaj kaunse setups chalenge.
 */

import { Candle } from '@/types/scanner';
import { fetchKlines } from '@/lib/binance';
import { calculateADX, calculateATR, calculateEMA } from '@/lib/indicators';

export type RegimeKey = 'trending_bull' | 'trending_bear' | 'ranging' | 'volatile_chop';

export interface MarketRegime {
  key: RegimeKey;
  label: string;
  summary: string;
  btcPrice: number;
  btcChange24h: number;
  trendStrength: number;      // ADX daily
  volatilityPercentile: number; // 0-100
  fearGreed?: { value: number; label: string };
  favored: string[];          // playbook ids jo is regime me best chalte hain
  avoid: string[];            // kya avoid karna hai
}

const REGIME_META: Record<RegimeKey, { label: string; summary: string; favored: string[]; avoid: string[] }> = {
  trending_bull: {
    label: 'Trending Bull',
    summary: 'BTC structure bullish aur trend strong hai. Dips khareedne wale setups sab se behtar chalte hain, counter-trend shorts mehngay parte hain.',
    favored: ['fvg-continuation-long', 'htf-ob-retest-long', 'impulse-base-long', 'sweep-choch-long'],
    avoid: ['Counter-trend shorts', 'Top picking'],
  },
  trending_bear: {
    label: 'Trending Bear',
    summary: 'BTC downtrend me hai. Rally sell karne wale setups edge dete hain, longs sirf strong reclaim par.',
    favored: ['upthrust-short', 'fvg-continuation-short', 'premium-rejection-short'],
    avoid: ['Blind dip buying', 'Breakout longs'],
  },
  ranging: {
    label: 'Ranging / Mean Reversion',
    summary: 'Trend strength kam hai — price range me hai. Range extremes se reversal (sweep + reclaim) setups chalte hain, breakouts mostly fail hote hain.',
    favored: ['spring-reclaim-long', 'sweep-choch-long', 'upthrust-short'],
    avoid: ['Breakout continuation', 'Trend following'],
  },
  volatile_chop: {
    label: 'High Volatility Chop',
    summary: 'Volatility bohot high hai aur direction confuse. Size chhota rakhein, sirf A+ grade setups lein aur stop ATR ke hisaab se wide rakhein.',
    favored: ['spring-reclaim-long', 'upthrust-short'],
    avoid: ['Tight stops', 'Low grade (C/D) setups', 'Over-leverage'],
  },
};

async function fetchFearGreed(): Promise<{ value: number; label: string } | undefined> {
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1');
    if (!res.ok) return undefined;
    const json = await res.json();
    const d = json?.data?.[0];
    if (!d) return undefined;
    return { value: parseInt(d.value, 10), label: d.value_classification };
  } catch {
    return undefined;
  }
}

function percentileOfLast(values: number[], window = 100): number {
  const w = values.slice(-window).filter(v => !isNaN(v));
  if (w.length < 5) return 50;
  const current = w[w.length - 1];
  const below = w.filter(v => v <= current).length;
  return Math.round((below / w.length) * 100);
}

export async function detectMarketRegime(): Promise<MarketRegime> {
  const [daily, fearGreed] = await Promise.all([
    fetchKlines('BTCUSDT', '1d', 250),
    fetchFearGreed(),
  ]);

  const closes = daily.map(c => c.close);
  const price = closes[closes.length - 1];
  const prev = closes[closes.length - 2] ?? price;
  const change24h = prev ? ((price - prev) / prev) * 100 : 0;

  const ema20 = calculateEMA(daily, 20);
  const ema50 = calculateEMA(daily, 50);
  const adxArr = calculateADX(daily, 14);
  const adx = adxArr[adxArr.length - 1] ?? 0;

  const atrArr = calculateATR(daily, 14);
  const atrPct = atrArr.map((v, i) => (daily[i] ? (v / daily[i].close) * 100 : NaN));
  const volPercentile = percentileOfLast(atrPct, 120);

  const e20 = ema20[ema20.length - 1] ?? price;
  const e50 = ema50[ema50.length - 1] ?? price;

  let key: RegimeKey;
  if (volPercentile >= 88 && adx < 25) key = 'volatile_chop';
  else if (adx >= 22 && price > e20 && e20 > e50) key = 'trending_bull';
  else if (adx >= 22 && price < e20 && e20 < e50) key = 'trending_bear';
  else key = 'ranging';

  const meta = REGIME_META[key];

  return {
    key,
    label: meta.label,
    summary: meta.summary,
    btcPrice: price,
    btcChange24h: change24h,
    trendStrength: adx,
    volatilityPercentile: volPercentile,
    fearGreed,
    favored: meta.favored,
    avoid: meta.avoid,
  };
}

/** Regime ke hisaab se minimum grade suggestion. */
export function minGradeForRegime(key: RegimeKey): 'A' | 'B' {
  return key === 'volatile_chop' ? 'A' : 'B';
}

export type { Candle };
