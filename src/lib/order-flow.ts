/**
 * Order Flow Engine (CVD / Delta / Absorption)
 * --------------------------------------------
 * Purana ICT/SMC sirf price structure dekhta hai. Ye module actual buying/selling
 * pressure (taker delta) nikaalta hai taake pata chale sweep real tha ya fake.
 *
 * Data source: Binance klines ka takerBuyBaseAssetVolume field (live, per candle).
 *   delta      = takerBuy - takerSell
 *   CVD        = cumulative delta
 *   absorption = bohot bara volume lekin price move na hua (bade orders absorb ho rahe)
 */

import { resolveInterval } from '@/lib/binance';

const BINANCE_DATA_API = 'https://data-api.binance.vision/api/v3';

export interface FlowBar {
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  buyVolume: number;
  sellVolume: number;
  delta: number;
}

export type FlowVerdict = 'confirms' | 'divergent' | 'absorbing' | 'neutral';

export interface OrderFlowSignal {
  bars: FlowBar[];
  cvd: number[];
  /** CVD ka slope (last 10 bars) — normalized. */
  cvdSlope: number;
  /** Last bar ka delta, average delta ke muqable (z-score). */
  deltaZScore: number;
  /** Last bar me taker buy share, 0-100. */
  buyPressure: number;
  /** Price naya high/low bana raha hai lekin CVD nahi (ya ulta) → divergence. */
  divergence: 'bullish' | 'bearish' | null;
  /** Bara volume, chhota body → absorption. */
  absorption: 'at_lows' | 'at_highs' | null;
  /** Efficiency: price move per unit delta (kam = heavy resistance). */
  efficiency: number;
  verdict: FlowVerdict;
  /** Setup direction ke hisaab se -10..+10 adjustment. */
  scoreAdjust: number;
  notes: string[];
}

async function fetchFlowKlines(symbol: string, interval: string, limit: number): Promise<FlowBar[]> {
  const { base, factor } = resolveInterval(interval);
  const baseLimit = Math.min(1000, Math.max(limit, limit * factor));
  const res = await fetch(`${BINANCE_DATA_API}/klines?symbol=${symbol}&interval=${base}&limit=${baseLimit}`);
  if (!res.ok) throw new Error('Flow data fetch failed');
  const raw = (await res.json()) as any[][];

  const bars: FlowBar[] = raw.map(k => {
    const volume = parseFloat(k[5]);
    const buyVolume = parseFloat(k[9]);
    const sellVolume = Math.max(0, volume - buyVolume);
    return {
      openTime: k[0],
      closeTime: k[6],
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume,
      buyVolume,
      sellVolume,
      delta: buyVolume - sellVolume,
    };
  });

  if (factor <= 1) return bars;

  // Non-native timeframe: base bars ko merge karo
  const out: FlowBar[] = [];
  const start = bars.length % factor;
  for (let i = start; i + factor <= bars.length; i += factor) {
    const slice = bars.slice(i, i + factor);
    const first = slice[0];
    const lastBar = slice[slice.length - 1];
    let high = -Infinity, low = Infinity, volume = 0, buyVolume = 0;
    for (const b of slice) {
      if (b.high > high) high = b.high;
      if (b.low < low) low = b.low;
      volume += b.volume;
      buyVolume += b.buyVolume;
    }
    out.push({
      openTime: first.openTime,
      closeTime: lastBar.closeTime,
      open: first.open,
      high,
      low,
      close: lastBar.close,
      volume,
      buyVolume,
      sellVolume: Math.max(0, volume - buyVolume),
      delta: buyVolume - (volume - buyVolume),
    });
  }
  return out;
}

function mean(a: number[]): number {
  return a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;
}

function stdev(a: number[]): number {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(mean(a.map(v => (v - m) ** 2)));
}

export function analyzeFlow(bars: FlowBar[], direction: 'long' | 'short'): OrderFlowSignal {
  const notes: string[] = [];
  const cvd: number[] = [];
  let run = 0;
  for (const b of bars) {
    run += b.delta;
    cvd.push(run);
  }

  const lastBar = bars[bars.length - 1];
  const deltas = bars.slice(-60).map(b => b.delta);
  const sd = stdev(deltas);
  const deltaZScore = sd > 0 ? (lastBar.delta - mean(deltas)) / sd : 0;
  const buyPressure = lastBar.volume > 0 ? (lastBar.buyVolume / lastBar.volume) * 100 : 50;

  // CVD slope (last 10 bars, price se normalize)
  const win = cvd.slice(-10);
  const slopeRaw = win.length > 1 ? win[win.length - 1] - win[0] : 0;
  const volBase = mean(bars.slice(-20).map(b => b.volume)) || 1;
  const cvdSlope = slopeRaw / (volBase * 10);

  // Divergence: last 20 bars me price ka extreme vs CVD ka extreme
  const seg = bars.slice(-20);
  const segCvd = cvd.slice(-20);
  let divergence: 'bullish' | 'bearish' | null = null;
  if (seg.length >= 12) {
    const half = Math.floor(seg.length / 2);
    const priceHigh1 = Math.max(...seg.slice(0, half).map(b => b.high));
    const priceHigh2 = Math.max(...seg.slice(half).map(b => b.high));
    const priceLow1 = Math.min(...seg.slice(0, half).map(b => b.low));
    const priceLow2 = Math.min(...seg.slice(half).map(b => b.low));
    const cvdHigh1 = Math.max(...segCvd.slice(0, half));
    const cvdHigh2 = Math.max(...segCvd.slice(half));
    const cvdLow1 = Math.min(...segCvd.slice(0, half));
    const cvdLow2 = Math.min(...segCvd.slice(half));

    if (priceHigh2 > priceHigh1 && cvdHigh2 < cvdHigh1) {
      divergence = 'bearish';
      notes.push('Price naya high bana raha hai lekin CVD lower high — buying weak (bearish divergence)');
    } else if (priceLow2 < priceLow1 && cvdLow2 > cvdLow1) {
      divergence = 'bullish';
      notes.push('Price naya low bana raha hai lekin CVD higher low — selling exhausted (bullish divergence)');
    }
  }

  // Absorption: bara volume + chhota body + lamba wick
  let absorption: 'at_lows' | 'at_highs' | null = null;
  const recent = bars.slice(-3);
  const avgVol = mean(bars.slice(-23, -3).map(b => b.volume)) || 1;
  for (const b of recent) {
    const range = b.high - b.low;
    if (range <= 0) continue;
    const body = Math.abs(b.close - b.open);
    const bigVol = b.volume / avgVol >= 1.8;
    const smallBody = body / range <= 0.4;
    if (!bigVol || !smallBody) continue;
    const lowerWick = Math.min(b.open, b.close) - b.low;
    const upperWick = b.high - Math.max(b.open, b.close);
    if (lowerWick > upperWick * 1.5) absorption = 'at_lows';
    else if (upperWick > lowerWick * 1.5) absorption = 'at_highs';
  }
  if (absorption === 'at_lows') notes.push('Lows par heavy volume absorb hua — sellers ko buyers utha rahe hain');
  if (absorption === 'at_highs') notes.push('Highs par heavy volume absorb hua — sellers supply de rahe hain');

  // Efficiency: price move per unit delta
  const segMove = seg.length ? Math.abs(seg[seg.length - 1].close - seg[0].close) / seg[0].close * 100 : 0;
  const segDelta = Math.abs(segCvd[segCvd.length - 1] - segCvd[0]) / volBase;
  const efficiency = segDelta > 0 ? segMove / segDelta : 0;

  // Scoring
  const long = direction === 'long';
  let adjust = 0;

  if (long ? cvdSlope > 0.05 : cvdSlope < -0.05) { adjust += 4; notes.push(`CVD ${long ? 'rising' : 'falling'} — flow setup ke sath`); }
  else if (long ? cvdSlope < -0.05 : cvdSlope > 0.05) { adjust -= 4; notes.push(`CVD ${long ? 'falling' : 'rising'} — flow setup ke khilaf`); }
  else notes.push('CVD flat — koi clear flow nahi');

  if (long ? buyPressure >= 55 : buyPressure <= 45) { adjust += 2; notes.push(`Last candle me ${long ? 'buy' : 'sell'} pressure ${buyPressure.toFixed(0)}%`); }
  else adjust -= 1;

  if (Math.abs(deltaZScore) >= 2) {
    const sameSide = long ? deltaZScore > 0 : deltaZScore < 0;
    adjust += sameSide ? 3 : -3;
    notes.push(`Delta spike (z=${deltaZScore.toFixed(1)}) ${sameSide ? 'setup ke sath' : 'setup ke khilaf'}`);
  }

  if (divergence) adjust += (long ? divergence === 'bullish' : divergence === 'bearish') ? 4 : -4;
  if (absorption) adjust += (long ? absorption === 'at_lows' : absorption === 'at_highs') ? 3 : -3;

  adjust = Math.max(-10, Math.min(10, adjust));

  let verdict: FlowVerdict = 'neutral';
  if (absorption && (long ? absorption === 'at_lows' : absorption === 'at_highs')) verdict = 'absorbing';
  if (adjust >= 4) verdict = 'confirms';
  else if (adjust <= -4) verdict = 'divergent';

  return {
    bars,
    cvd,
    cvdSlope,
    deltaZScore,
    buyPressure,
    divergence,
    absorption,
    efficiency,
    verdict,
    scoreAdjust: adjust,
    notes,
  };
}

export async function getOrderFlow(
  symbol: string,
  interval: string,
  direction: 'long' | 'short',
  limit = 150
): Promise<OrderFlowSignal> {
  const bars = await fetchFlowKlines(symbol, interval, limit);
  if (bars.length < 25) throw new Error('Flow data insufficient');
  return analyzeFlow(bars, direction);
}
