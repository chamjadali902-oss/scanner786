/**
 * Pro Playbooks — ready-made modern trading setups.
 * User ko manually conditions banane ki zarurat nahi; ek click me scan.
 */

import { ScanCondition, ScanPool, Timeframe } from '@/types/scanner';

export interface Playbook {
  id: string;
  name: string;
  direction: 'long' | 'short';
  style: string;              // e.g. "Reversal", "Continuation"
  description: string;
  pool: ScanPool;
  timeframe: Timeframe;
  mtfTimeframes?: Timeframe[];
  optionalMinMatch: number;
  conditions: ScanCondition[];
}

let seq = 0;
const c = (
  feature: string,
  category: ScanCondition['category'],
  group: 'must' | 'optional',
  extra: Partial<ScanCondition> = {},
): ScanCondition => ({
  id: `pb-${feature}-${++seq}`,
  feature,
  category,
  mode: extra.mode ?? 'value',
  enabled: true,
  group,
  ...extra,
});

export const PLAYBOOKS: Playbook[] = [
  {
    id: 'sweep-choch-long',
    name: 'Sweep + CHoCH Reversal',
    direction: 'long',
    style: 'Reversal',
    description:
      'Price ne sell-side liquidity sweep ki aur phir structure bullish taraf shift kiya. Institutional entry model — smart money low sweep karke reverse karta hai.',
    pool: 'losers',
    timeframe: '15m',
    mtfTimeframes: ['15m', '1h'],
    optionalMinMatch: 2,
    conditions: [
      c('liquidity_sweep_low', 'smc', 'must'),
      c('choch_bullish', 'smc', 'must'),
      c('bullish_ob', 'smc', 'optional'),
      c('bullish_fvg', 'smc', 'optional'),
      c('volume_spike', 'smc', 'optional'),
      c('discount_zone', 'smc', 'optional'),
      c('rsi', 'indicator', 'optional', { mode: 'range', minValue: 20, maxValue: 45, rsiPeriod: 14 }),
    ],
  },
  {
    id: 'spring-reclaim-long',
    name: 'Spring Reclaim (Wyckoff)',
    direction: 'long',
    style: 'Reversal',
    description:
      'Tested support wick se toota lekin price ne foran reclaim kiya. Range markets ka sab se reliable long setup.',
    pool: 'all',
    timeframe: '1h',
    optionalMinMatch: 1,
    conditions: [
      c('spring_bullish', 'smc', 'must'),
      c('volume_spike', 'smc', 'optional'),
      c('hammer', 'pattern', 'optional'),
      c('bullish_engulfing', 'pattern', 'optional'),
      c('choch_bullish', 'smc', 'optional'),
    ],
  },
  {
    id: 'fvg-continuation-long',
    name: 'FVG Continuation',
    direction: 'long',
    style: 'Continuation',
    description:
      'Uptrend me imbalance (Fair Value Gap) chhoda hai aur price wahan retest de raha hai. Trending market ka highest win-rate setup.',
    pool: 'volume',
    timeframe: '1h',
    mtfTimeframes: ['1h', '4h'],
    optionalMinMatch: 2,
    conditions: [
      c('uptrend', 'smc', 'must'),
      c('bullish_fvg', 'smc', 'must'),
      c('bos_bullish', 'smc', 'optional'),
      c('discount_zone', 'smc', 'optional'),
      c('ema', 'indicator', 'optional', { mode: 'cross', period: 50, pricePosition: 'above' }),
      c('volume_spike', 'smc', 'optional'),
    ],
  },
  {
    id: 'htf-ob-retest-long',
    name: 'HTF Order Block Retest',
    direction: 'long',
    style: 'Continuation',
    description:
      'Higher timeframe bullish order block par price discount me wapas aaya hai. Bade risk-reward wale swing entries.',
    pool: 'all',
    timeframe: '4h',
    mtfTimeframes: ['4h', '1d'],
    optionalMinMatch: 1,
    conditions: [
      c('bullish_ob', 'smc', 'must'),
      c('discount_zone', 'smc', 'must'),
      c('bos_bullish', 'smc', 'optional'),
      c('uptrend', 'smc', 'optional'),
      c('rsi', 'indicator', 'optional', { mode: 'range', minValue: 30, maxValue: 55, rsiPeriod: 14 }),
    ],
  },
  {
    id: 'impulse-base-long',
    name: 'Impulse Base (Untested)',
    direction: 'long',
    style: 'Breakout',
    description:
      'Ek red candle ke baad strong green impulse ne level break kiya aur base abhi tak retest nahi hua. Fresh demand zone.',
    pool: 'gainers',
    timeframe: '15m',
    optionalMinMatch: 1,
    conditions: [
      c('impulse_bullish', 'pattern', 'must', { impulseMinCandles: 2, impulseLookback: 30, impulseMaxAge: 10 }),
      c('volume_spike', 'smc', 'optional'),
      c('bos_bullish', 'smc', 'optional'),
      c('uptrend', 'smc', 'optional'),
    ],
  },
  {
    id: 'upthrust-short',
    name: 'Upthrust Rejection',
    direction: 'short',
    style: 'Reversal',
    description:
      'Resistance ke upar wick se buy-side liquidity li gayi aur price reject hua. Distribution short setup.',
    pool: 'gainers',
    timeframe: '15m',
    mtfTimeframes: ['15m', '1h'],
    optionalMinMatch: 2,
    conditions: [
      c('upthrust_bearish', 'smc', 'must'),
      c('choch_bearish', 'smc', 'optional'),
      c('bearish_ob', 'smc', 'optional'),
      c('premium_zone', 'smc', 'optional'),
      c('rsi', 'indicator', 'optional', { mode: 'range', minValue: 60, maxValue: 90, rsiPeriod: 14 }),
    ],
  },
  {
    id: 'fvg-continuation-short',
    name: 'Bear FVG Continuation',
    direction: 'short',
    style: 'Continuation',
    description: 'Downtrend me bearish imbalance ka retest — trend ke sath continuation short.',
    pool: 'volume',
    timeframe: '1h',
    mtfTimeframes: ['1h', '4h'],
    optionalMinMatch: 1,
    conditions: [
      c('downtrend', 'smc', 'must'),
      c('bearish_fvg', 'smc', 'must'),
      c('bos_bearish', 'smc', 'optional'),
      c('premium_zone', 'smc', 'optional'),
      c('bearish_ob', 'smc', 'optional'),
    ],
  },
  {
    id: 'premium-rejection-short',
    name: 'Premium Zone Rejection',
    direction: 'short',
    style: 'Reversal',
    description: 'Price premium zone me pohncha aur buy-side sweep ke baad bearish structure bana.',
    pool: 'gainers',
    timeframe: '1h',
    optionalMinMatch: 2,
    conditions: [
      c('premium_zone', 'smc', 'must'),
      c('liquidity_sweep_high', 'smc', 'must'),
      c('bearish_engulfing', 'pattern', 'optional'),
      c('shooting_star', 'pattern', 'optional'),
      c('choch_bearish', 'smc', 'optional'),
      c('bearish_ob', 'smc', 'optional'),
    ],
  },
];

export function getPlaybook(id: string): Playbook | undefined {
  return PLAYBOOKS.find(p => p.id === id);
}

/** Playbook ki fresh copy (unique condition ids ke sath). */
export function instantiatePlaybook(pb: Playbook): ScanCondition[] {
  return pb.conditions.map((cond, i) => ({ ...cond, id: `${pb.id}-${i}-${Date.now()}` }));
}
