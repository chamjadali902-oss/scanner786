import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { callAIWithFallback } from "../_shared/ai-fallback.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SPOT_API = "https://api.binance.com/api/v3";
const FUTURES_API = "https://fapi.binance.com/fapi/v1";

// ─────────────────────────────────────────────────────────
// PARSING — extract symbol, timeframe, market from user msg
// ─────────────────────────────────────────────────────────
const KNOWN_COINS = [
  'BTC','ETH','BNB','SOL','XRP','DOGE','ADA','AVAX','DOT','MATIC','LINK','UNI','ATOM','LTC',
  'FIL','APT','ARB','OP','NEAR','FTM','ALGO','VET','SAND','MANA','AXS','SHIB','PEPE','WIF',
  'BONK','SUI','SEI','TIA','JUP','WLD','INJ','TRX','TON','RENDER','FET','HBAR','ICP','RUNE',
  'AAVE','MKR','CRV','SNX','COMP','SUSHI','ENA','PENDLE','STX','KAS','TAO','ONDO','JASMY',
  'GALA','IMX','ORDI','WOO','CAKE','NOT','PEOPLE','POPCAT','FLOKI','HYPE','PNUT','MEW','TRUMP'
];
const VALID_TFS = ['1m','3m','5m','15m','30m','1h','2h','4h','6h','8h','12h','1d','3d','1w','1M'];

function parseOne(text: string) {
  const upper = text.toUpperCase();
  const market: 'spot' | 'futures' | null =
    /\b(FUTURES?|PERP|PERPETUAL|FUT)\b/i.test(text) ? 'futures'
    : /\bSPOT\b/i.test(text) ? 'spot' : null;

  let tf: string | null = null;
  for (const t of VALID_TFS) {
    const re = new RegExp(`(^|[^A-Za-z0-9])${t}([^A-Za-z0-9]|$)`, t === '1M' ? '' : 'i');
    if (re.test(text)) { tf = t; break; }
  }

  let symbol: string | null = null;
  const explicit = upper.match(/\b([A-Z0-9]{2,10})[/\-]?USDT\b/);
  if (explicit) symbol = explicit[1] + 'USDT';
  if (!symbol) {
    for (const c of KNOWN_COINS) {
      if (new RegExp(`\\b${c}\\b`).test(upper)) { symbol = c + 'USDT'; break; }
    }
  }
  return { symbol, tf, market };
}

// Scan latest user message FIRST, then fall back to recent history for context carry-over
function parseRequest(messages: { role: string; content: string }[]) {
  const userMsgs = messages.filter(m => m.role === 'user').reverse();
  let symbol: string | null = null;
  let timeframe: string | null = null;
  let market: 'spot' | 'futures' = 'spot';
  let marketSet = false;

  for (const m of userMsgs) {
    const p = parseOne(m.content || '');
    if (!symbol && p.symbol) symbol = p.symbol;
    if (!timeframe && p.tf) timeframe = p.tf;
    if (!marketSet && p.market) { market = p.market; marketSet = true; }
    if (symbol && timeframe && marketSet) break;
  }
  return { symbol, timeframe, market };
}

// ─────────────────────────────────────────────────────────
// FETCH 500 candles from Binance (Spot or Futures)
// ─────────────────────────────────────────────────────────
async function fetchKlines(symbol: string, interval: string, market: 'spot' | 'futures'): Promise<number[][] | null> {
  const base = market === 'futures' ? FUTURES_API : SPOT_API;
  try {
    const r = await fetch(`${base}/klines?symbol=${symbol}&interval=${interval}&limit=500`);
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

async function fetchTicker(symbol: string, market: 'spot' | 'futures') {
  const base = market === 'futures' ? FUTURES_API : SPOT_API;
  try {
    const r = await fetch(`${base}/ticker/24hr?symbol=${symbol}`);
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

async function fetchLivePrice(symbol: string, market: 'spot' | 'futures'): Promise<number | null> {
  const base = market === 'futures' ? FUTURES_API : SPOT_API;
  try {
    const r = await fetch(`${base}/ticker/price?symbol=${symbol}`);
    if (!r.ok) return null;
    const j = await r.json();
    return +j.price;
  } catch { return null; }
}

// ─── Derivatives intelligence (futures only) ───
async function fetchFundingAndOI(symbol: string) {
  try {
    const [premR, oiR] = await Promise.all([
      fetch(`${FUTURES_API}/premiumIndex?symbol=${symbol}`),
      fetch(`${FUTURES_API}/openInterest?symbol=${symbol}`),
    ]);
    const prem = premR.ok ? await premR.json() : null;
    const oi = oiR.ok ? await oiR.json() : null;
    return {
      fundingRate: prem ? +prem.lastFundingRate : null,
      markPrice: prem ? +prem.markPrice : null,
      nextFundingTime: prem ? +prem.nextFundingTime : null,
      openInterest: oi ? +oi.openInterest : null,
    };
  } catch { return null; }
}

async function fetchLongShortRatio(symbol: string) {
  try {
    const r = await fetch(`https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${symbol}&period=1h&limit=1`);
    if (!r.ok) return null;
    const a = await r.json();
    if (!Array.isArray(a) || !a.length) return null;
    return { longShortRatio: +a[0].longShortRatio, longAcct: +a[0].longAccount, shortAcct: +a[0].shortAccount };
  } catch { return null; }
}

// ─── Fear & Greed index (free, no key) ───
let fgCache: { ts: number; data: any } | null = null;
async function fetchFearGreed() {
  if (fgCache && Date.now() - fgCache.ts < 10 * 60_000) return fgCache.data;
  try {
    const r = await fetch('https://api.alternative.me/fng/?limit=1');
    if (!r.ok) return null;
    const j = await r.json();
    const d = j?.data?.[0];
    if (!d) return null;
    const data = { value: +d.value, classification: d.value_classification };
    fgCache = { ts: Date.now(), data };
    return data;
  } catch { return null; }
}

// Auto-precision based on price magnitude (TradingView style)
function priceFmt(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return 'N/A';
  const a = Math.abs(v);
  let d = 2;
  if (a < 0.0001) d = 10;
  else if (a < 0.01) d = 8;
  else if (a < 1) d = 6;
  else if (a < 100) d = 4;
  else if (a < 10000) d = 2;
  else d = 2;
  return v.toFixed(d);
}

// ─────────────────────────────────────────────────────────
// INDICATORS — TradingView-equivalent
// ─────────────────────────────────────────────────────────
function wildersRSI(closes: number[], p = 14): number | null {
  if (closes.length < p + 1) return null;
  let g = 0, l = 0;
  for (let i = 1; i <= p; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) g += d; else l += Math.abs(d);
  }
  g /= p; l /= p;
  for (let i = p + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    g = (g * (p - 1) + (d > 0 ? d : 0)) / p;
    l = (l * (p - 1) + (d < 0 ? Math.abs(d) : 0)) / p;
  }
  if (l === 0) return 100;
  return 100 - 100 / (1 + g / l);
}

function emaSeries(closes: number[], p: number): number[] {
  if (closes.length < p) return [];
  const k = 2 / (p + 1);
  let ema = 0;
  for (let i = 0; i < p; i++) ema += closes[i];
  ema /= p;
  const out: number[] = [ema];
  for (let i = p; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
    out.push(ema);
  }
  return out;
}

function ema(closes: number[], p: number): number | null {
  const s = emaSeries(closes, p);
  return s.length ? s[s.length - 1] : null;
}

function macd(closes: number[]) {
  if (closes.length < 35) return null;
  const e12 = emaSeries(closes, 12);
  const e26 = emaSeries(closes, 26);
  const offset = e12.length - e26.length;
  const macdLine: number[] = [];
  for (let i = 0; i < e26.length; i++) macdLine.push(e12[i + offset] - e26[i]);
  if (macdLine.length < 9) return null;
  const sigSeries = emaSeries(macdLine, 9);
  const signal = sigSeries[sigSeries.length - 1];
  const m = macdLine[macdLine.length - 1];
  return { macd: m, signal, histogram: m - signal };
}

function bbands(closes: number[], p = 20, mult = 2) {
  if (closes.length < p) return null;
  const s = closes.slice(-p);
  const mid = s.reduce((a, b) => a + b, 0) / p;
  const v = s.reduce((sum, x) => sum + (x - mid) ** 2, 0) / p;
  const sd = Math.sqrt(v);
  return { upper: mid + mult * sd, middle: mid, lower: mid - mult * sd, bandwidth: ((2 * mult * sd) / mid) * 100 };
}

function stochRSI(closes: number[], rp = 14, sp = 14, k = 3, d = 3) {
  if (closes.length < rp + sp + k + d) return null;
  const rsis: number[] = [];
  let g = 0, l = 0;
  for (let i = 1; i <= rp; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) g += diff; else l += Math.abs(diff);
  }
  g /= rp; l /= rp;
  rsis.push(l === 0 ? 100 : 100 - 100 / (1 + g / l));
  for (let i = rp + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    g = (g * (rp - 1) + (diff > 0 ? diff : 0)) / rp;
    l = (l * (rp - 1) + (diff < 0 ? Math.abs(diff) : 0)) / rp;
    rsis.push(l === 0 ? 100 : 100 - 100 / (1 + g / l));
  }
  if (rsis.length < sp) return null;
  const stoch: number[] = [];
  for (let i = sp - 1; i < rsis.length; i++) {
    const w = rsis.slice(i - sp + 1, i + 1);
    const min = Math.min(...w), max = Math.max(...w);
    stoch.push(max === min ? 50 : ((rsis[i] - min) / (max - min)) * 100);
  }
  if (stoch.length < k) return null;
  const sk: number[] = [];
  for (let i = k - 1; i < stoch.length; i++) {
    sk.push(stoch.slice(i - k + 1, i + 1).reduce((a, b) => a + b, 0) / k);
  }
  if (sk.length < d) return null;
  const lastD = sk.slice(-d).reduce((a, b) => a + b, 0) / d;
  return { k: sk[sk.length - 1], d: lastD };
}

function atrWilder(highs: number[], lows: number[], closes: number[], p = 14): number | null {
  if (highs.length < p + 1) return null;
  const trs: number[] = [];
  for (let i = 1; i < highs.length; i++) {
    trs.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
  }
  let atr = 0;
  for (let i = 0; i < p; i++) atr += trs[i];
  atr /= p;
  for (let i = p; i < trs.length; i++) atr = (atr * (p - 1) + trs[i]) / p;
  return atr;
}

function supertrend(highs: number[], lows: number[], closes: number[], p = 10, mult = 3) {
  if (highs.length < p + 2) return null;
  const trs: number[] = [];
  for (let i = 1; i < highs.length; i++) {
    trs.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
  }
  let atr = 0;
  for (let i = 0; i < p; i++) atr += trs[i];
  atr /= p;
  let dir: 'UP' | 'DOWN' = 'UP', val = 0, ub = 0, lb = 0;
  let inited = false;
  for (let i = p; i < trs.length; i++) {
    atr = (atr * (p - 1) + trs[i]) / p;
    const idx = i + 1;
    const hl2 = (highs[idx] + lows[idx]) / 2;
    const nu = hl2 + mult * atr, nl = hl2 - mult * atr;
    if (!inited) { ub = nu; lb = nl; dir = closes[idx] > nu ? 'UP' : 'DOWN'; val = dir === 'UP' ? lb : ub; inited = true; continue; }
    ub = (nu < ub || closes[idx - 1] > ub) ? nu : ub;
    lb = (nl > lb || closes[idx - 1] < lb) ? nl : lb;
    if (dir === 'UP') {
      if (closes[idx] < lb) { dir = 'DOWN'; val = ub; } else val = lb;
    } else {
      if (closes[idx] > ub) { dir = 'UP'; val = lb; } else val = ub;
    }
  }
  return { value: val, direction: dir };
}

// ─────────────────────────────────────────────────────────
// SMC / ICT  — swings, BOS/CHoCH, OB, FVG, liquidity
// ─────────────────────────────────────────────────────────
interface Candle { o: number; h: number; l: number; c: number; t: number; }

function findSwings(cs: Candle[], lb = 3) {
  const out: { i: number; price: number; type: 'high' | 'low' }[] = [];
  for (let i = lb; i < cs.length - lb; i++) {
    let isH = true, isL = true;
    for (let j = i - lb; j <= i + lb; j++) {
      if (j === i) continue;
      if (cs[j].h >= cs[i].h) isH = false;
      if (cs[j].l <= cs[i].l) isL = false;
    }
    if (isH) out.push({ i, price: cs[i].h, type: 'high' });
    if (isL) out.push({ i, price: cs[i].l, type: 'low' });
  }
  return out;
}

function detectStructure(cs: Candle[]) {
  const sw = findSwings(cs, 3);
  const highs = sw.filter(s => s.type === 'high');
  const lows = sw.filter(s => s.type === 'low');
  const last = cs[cs.length - 1];

  const lastSH = highs[highs.length - 1];
  const prevSH = highs[highs.length - 2];
  const lastSL = lows[lows.length - 1];
  const prevSL = lows[lows.length - 2];

  let event = 'None';
  if (lastSH && last.c > lastSH.price) {
    event = (prevSH && lastSH.price < prevSH.price) ? 'Bullish CHoCH' : 'Bullish BOS';
  } else if (lastSL && last.c < lastSL.price) {
    event = (prevSL && lastSL.price > prevSL.price) ? 'Bearish CHoCH' : 'Bearish BOS';
  }

  return {
    event,
    lastSwingHigh: lastSH?.price ?? null,
    prevSwingHigh: prevSH?.price ?? null,
    lastSwingLow: lastSL?.price ?? null,
    prevSwingLow: prevSL?.price ?? null,
    recentHighs: highs.slice(-4).map(s => s.price),
    recentLows: lows.slice(-4).map(s => s.price),
  };
}

function findFVGs(cs: Candle[], maxAge = 30) {
  const start = Math.max(2, cs.length - maxAge);
  const fvgs: { type: 'bull' | 'bear'; top: number; bottom: number; age: number; filled: boolean }[] = [];
  for (let i = start; i < cs.length; i++) {
    const a = cs[i - 2], b = cs[i - 1], c = cs[i];
    if (c.l > a.h && b.c > b.o) {
      const top = c.l, bottom = a.h;
      const filled = cs.slice(i + 1).some(x => x.l <= bottom);
      fvgs.push({ type: 'bull', top, bottom, age: cs.length - 1 - i, filled });
    } else if (c.h < a.l && b.c < b.o) {
      const top = a.l, bottom = c.h;
      const filled = cs.slice(i + 1).some(x => x.h >= top);
      fvgs.push({ type: 'bear', top, bottom, age: cs.length - 1 - i, filled });
    }
  }
  return fvgs.filter(f => !f.filled).slice(-5);
}

function findOrderBlocks(cs: Candle[], lookback = 50) {
  const start = Math.max(0, cs.length - lookback);
  const obs: { type: 'bull' | 'bear'; top: number; bottom: number; index: number }[] = [];
  for (let i = start; i < cs.length - 3; i++) {
    const ob = cs[i];
    const next3 = cs.slice(i + 1, i + 4);
    if (ob.c < ob.o) {
      const broke = next3.some(x => x.c > ob.h);
      if (broke) obs.push({ type: 'bull', top: ob.h, bottom: ob.l, index: i });
    } else if (ob.c > ob.o) {
      const broke = next3.some(x => x.c < ob.l);
      if (broke) obs.push({ type: 'bear', top: ob.h, bottom: ob.l, index: i });
    }
  }
  return obs.slice(-4);
}

function detectLiquiditySweeps(cs: Candle[]) {
  const lb = Math.min(20, cs.length - 1);
  const recent = cs.slice(-lb - 1, -1);
  const last = cs[cs.length - 1];
  const prevHigh = Math.max(...recent.map(c => c.h));
  const prevLow = Math.min(...recent.map(c => c.l));
  return {
    sweepHigh: last.h > prevHigh && last.c < prevHigh ? prevHigh : null,
    sweepLow: last.l < prevLow && last.c > prevLow ? prevLow : null,
    prevHigh, prevLow,
  };
}

function equalLevels(cs: Candle[], tol = 0.001) {
  const sw = findSwings(cs, 3);
  const highs = sw.filter(s => s.type === 'high').slice(-6).map(s => s.price);
  const lows = sw.filter(s => s.type === 'low').slice(-6).map(s => s.price);
  let eqh = false, eql = false;
  for (let i = 0; i < highs.length; i++)
    for (let j = i + 1; j < highs.length; j++)
      if (Math.abs(highs[i] - highs[j]) / highs[i] < tol) eqh = true;
  for (let i = 0; i < lows.length; i++)
    for (let j = i + 1; j < lows.length; j++)
      if (Math.abs(lows[i] - lows[j]) / lows[i] < tol) eql = true;
  return { eqh, eql };
}

// ─────────────────────────────────────────────────────────
// BUILD ANALYSIS CONTEXT
// ─────────────────────────────────────────────────────────
async function buildAnalysisContext(symbol: string, tf: string, market: 'spot' | 'futures'): Promise<string | null> {
  const [klines, ticker, livePrice] = await Promise.all([
    fetchKlines(symbol, tf, market),
    fetchTicker(symbol, market),
    fetchLivePrice(symbol, market),
  ]);
  if (!klines || klines.length < 50) return null;

  const candles: Candle[] = klines.map(k => ({ t: +k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4] }));
  // Replace last candle close with true live price (more accurate than kline cache)
  if (livePrice && candles.length) candles[candles.length - 1].c = livePrice;

  const closes = candles.map(c => c.c);
  const highs = candles.map(c => c.h);
  const lows = candles.map(c => c.l);
  const last = candles[candles.length - 1];
  const price = livePrice ?? last.c;

  const rsi = wildersRSI(closes);
  const e9 = ema(closes, 9), e20 = ema(closes, 20), e50 = ema(closes, 50), e200 = ema(closes, 200);
  const m = macd(closes);
  const bb = bbands(closes);
  const sr = stochRSI(closes);
  const st = supertrend(highs, lows, closes);
  const atr = atrWilder(highs, lows, closes);

  const struct = detectStructure(candles);
  const fvgs = findFVGs(candles);
  const obs = findOrderBlocks(candles);
  const sweeps = detectLiquiditySweeps(candles);
  const eq = equalLevels(candles);

  let zone = 'N/A';
  if (struct.lastSwingHigh && struct.lastSwingLow) {
    const mid = (struct.lastSwingHigh + struct.lastSwingLow) / 2;
    zone = price > mid ? 'PREMIUM (sell zone)' : 'DISCOUNT (buy zone)';
  }

  const last5 = candles.slice(-5).map((c, i) => {
    const body = c.c - c.o;
    const range = c.h - c.l || 1e-9;
    const upper = c.h - Math.max(c.o, c.c);
    const lower = Math.min(c.o, c.c) - c.l;
    let label = body > 0 ? 'Green' : 'Red';
    if (Math.abs(body) / range < 0.15) label = 'Doji';
    else if (lower > Math.abs(body) * 2 && body > 0) label = 'Hammer (bull)';
    else if (upper > Math.abs(body) * 2 && body < 0) label = 'Shooting Star (bear)';
    return `#${i + 1} ${label} O:${priceFmt(c.o)} H:${priceFmt(c.h)} L:${priceFmt(c.l)} C:${priceFmt(c.c)}`;
  });

  const change = ticker ? (+ticker.priceChangePercent).toFixed(2) : 'N/A';
  const vol = ticker ? (+ticker.quoteVolume / 1e6).toFixed(2) : 'N/A';
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

  // Derivatives data (futures only) + global Fear & Greed (parallel)
  const [deriv, lsr, fg] = await Promise.all([
    market === 'futures' ? fetchFundingAndOI(symbol) : Promise.resolve(null),
    market === 'futures' ? fetchLongShortRatio(symbol) : Promise.resolve(null),
    fetchFearGreed(),
  ]);

  // Confluence scoring (helps the AI rate signal strength)
  const confluences: { bull: string[]; bear: string[] } = { bull: [], bear: [] };
  if (rsi != null) { if (rsi < 35) confluences.bull.push(`RSI oversold (${rsi.toFixed(1)})`); if (rsi > 65) confluences.bear.push(`RSI overbought (${rsi.toFixed(1)})`); }
  if (e50 && price > e50) confluences.bull.push('Price > EMA50'); else if (e50) confluences.bear.push('Price < EMA50');
  if (e200 && price > e200) confluences.bull.push('Price > EMA200 (HTF bull)'); else if (e200) confluences.bear.push('Price < EMA200 (HTF bear)');
  if (st?.direction === 'UP') confluences.bull.push('Supertrend UP'); else if (st?.direction === 'DOWN') confluences.bear.push('Supertrend DOWN');
  if (m && m.histogram > 0) confluences.bull.push('MACD histogram positive'); else if (m) confluences.bear.push('MACD histogram negative');
  if (sweeps.sweepLow) confluences.bull.push(`Liquidity sweep LOW @ $${priceFmt(sweeps.sweepLow)} reclaimed`);
  if (sweeps.sweepHigh) confluences.bear.push(`Liquidity sweep HIGH @ $${priceFmt(sweeps.sweepHigh)} rejected`);
  if (struct.event.includes('Bullish')) confluences.bull.push(`Structure: ${struct.event}`);
  if (struct.event.includes('Bearish')) confluences.bear.push(`Structure: ${struct.event}`);
  if (zone.includes('DISCOUNT')) confluences.bull.push('In DISCOUNT zone');
  if (zone.includes('PREMIUM')) confluences.bear.push('In PREMIUM zone');
  if (deriv?.fundingRate != null) {
    const fr = deriv.fundingRate * 100;
    if (fr < -0.01) confluences.bull.push(`Funding negative (${fr.toFixed(4)}%) — shorts paying, squeeze risk`);
    if (fr > 0.05) confluences.bear.push(`Funding overheated (${fr.toFixed(4)}%) — longs crowded`);
  }
  if (lsr?.longShortRatio != null) {
    if (lsr.longShortRatio < 0.9) confluences.bull.push(`L/S ratio ${lsr.longShortRatio.toFixed(2)} (crowd short → contrarian bull)`);
    if (lsr.longShortRatio > 2.0) confluences.bear.push(`L/S ratio ${lsr.longShortRatio.toFixed(2)} (crowd over-long → distribution risk)`);
  }

  const bias = confluences.bull.length > confluences.bear.length + 1 ? 'BULLISH'
    : confluences.bear.length > confluences.bull.length + 1 ? 'BEARISH' : 'NEUTRAL';
  const conviction = Math.min(5, Math.max(1, Math.abs(confluences.bull.length - confluences.bear.length)));

  return `
═══════════════════════════════════════════════════════════
LIVE BINANCE ${market.toUpperCase()} DATA — ${symbol} @ ${tf}
Fetched: ${now}  |  500 fresh candles
═══════════════════════════════════════════════════════════

PRICE
• Live Price: $${priceFmt(price)}  ← USE THIS EXACT VALUE
• 24h Change: ${change}%  | 24h Quote Vol: $${vol}M
• ATR(14): ${priceFmt(atr)}

TECHNICAL INDICATORS
• RSI(14) Wilder: ${rsi == null ? 'N/A' : rsi.toFixed(2)} ${rsi && rsi > 70 ? '(OVERBOUGHT)' : rsi && rsi < 30 ? '(OVERSOLD)' : ''}
• Stoch RSI: K=${sr ? sr.k.toFixed(2) : 'N/A'} D=${sr ? sr.d.toFixed(2) : 'N/A'} ${sr && sr.k > 80 ? '(OB)' : sr && sr.k < 20 ? '(OS)' : ''}
• MACD(12,26,9): MACD=${priceFmt(m?.macd)} Signal=${priceFmt(m?.signal)} Hist=${priceFmt(m?.histogram)} ${m ? (m.histogram > 0 ? '(Bullish)' : '(Bearish)') : ''}
• EMA9=${priceFmt(e9)} | EMA20=${priceFmt(e20)} | EMA50=${priceFmt(e50)} | EMA200=${priceFmt(e200)}
• Price vs EMAs: ${e20 ? (price > e20 ? 'Above EMA20' : 'Below EMA20') : ''} | ${e50 ? (price > e50 ? 'Above EMA50' : 'Below EMA50') : ''} | ${e200 ? (price > e200 ? 'Above EMA200' : 'Below EMA200') : ''}
• Bollinger(20,2): U=${priceFmt(bb?.upper)} M=${priceFmt(bb?.middle)} L=${priceFmt(bb?.lower)} BW=${bb ? bb.bandwidth.toFixed(2) : 'N/A'}%
• Supertrend(10,3): ${st ? `${st.direction} @ $${priceFmt(st.value)}` : 'N/A'}

MARKET STRUCTURE (SMC/ICT)
• Most Recent Event: ${struct.event}
• Last Swing High: $${priceFmt(struct.lastSwingHigh)} | Prev: $${priceFmt(struct.prevSwingHigh)}
• Last Swing Low:  $${priceFmt(struct.lastSwingLow)}  | Prev: $${priceFmt(struct.prevSwingLow)}
• Recent Swing Highs: ${struct.recentHighs.map(p => '$' + priceFmt(p)).join(', ')}
• Recent Swing Lows:  ${struct.recentLows.map(p => '$' + priceFmt(p)).join(', ')}
• Current Zone: ${zone}
• Equal Highs (EQH): ${eq.eqh ? 'YES — buy-side liquidity above' : 'No'}
• Equal Lows  (EQL): ${eq.eql ? 'YES — sell-side liquidity below' : 'No'}

LIQUIDITY
• Buy-side pool (recent high): $${priceFmt(sweeps.prevHigh)}
• Sell-side pool (recent low): $${priceFmt(sweeps.prevLow)}
• Sweep High this candle: ${sweeps.sweepHigh ? `YES — wicked $${priceFmt(sweeps.sweepHigh)} then closed back below (bearish reversal signal)` : 'No'}
• Sweep Low  this candle: ${sweeps.sweepLow  ? `YES — wicked $${priceFmt(sweeps.sweepLow)}  then closed back above (bullish reversal signal — Wyckoff Spring)` : 'No'}

UNFILLED FAIR VALUE GAPS (FVG)
${fvgs.length === 0 ? '• None active' : fvgs.map(f => `• ${f.type === 'bull' ? 'Bullish' : 'Bearish'} FVG: $${priceFmt(f.bottom)} – $${priceFmt(f.top)} (age ${f.age} candles)`).join('\n')}

ACTIVE ORDER BLOCKS
${obs.length === 0 ? '• None detected' : obs.map(o => `• ${o.type === 'bull' ? 'Bullish' : 'Bearish'} OB: $${priceFmt(o.bottom)} – $${priceFmt(o.top)}`).join('\n')}

${market === 'futures' ? `DERIVATIVES INTELLIGENCE (Binance Futures)
- Funding Rate: ${deriv?.fundingRate != null ? (deriv.fundingRate * 100).toFixed(4) + '%' : 'N/A'} ${deriv?.fundingRate != null ? (deriv.fundingRate < -0.01 ? '(shorts paying, squeeze risk)' : deriv.fundingRate > 0.05 ? '(longs overheated)' : '(neutral)') : ''}
- Open Interest: ${deriv?.openInterest != null ? deriv.openInterest.toFixed(2) + ' ' + symbol.replace('USDT','') : 'N/A'}
- Mark Price: $${priceFmt(deriv?.markPrice)}
- Long/Short Ratio (1h, global): ${lsr?.longShortRatio != null ? lsr.longShortRatio.toFixed(2) + ` (Long ${(lsr.longAcct*100).toFixed(1)}% / Short ${(lsr.shortAcct*100).toFixed(1)}%)` : 'N/A'}` : ''}

MARKET SENTIMENT
- Crypto Fear and Greed Index: ${fg ? `${fg.value}/100 (${fg.classification})` : 'N/A'} ${fg ? (fg.value < 25 ? '(Extreme Fear, contrarian buy zone)' : fg.value > 75 ? '(Extreme Greed, caution)' : '(neutral)') : ''}


PRICE ACTION — Last 5 Candles (oldest → newest)
${last5.join('\n')}

=== CONFLUENCE SCORECARD ===
- BIAS: ${bias}  |  CONVICTION: ${conviction}/5
- Bullish factors (${confluences.bull.length}):
${confluences.bull.length ? confluences.bull.map(c => `   + ${c}`).join('\n') : '   (none)'}
- Bearish factors (${confluences.bear.length}):
${confluences.bear.length ? confluences.bear.map(c => `   - ${c}`).join('\n') : '   (none)'}
===========================================================`;

}

// Compact HTF summary for top-down context
async function buildHTFSummary(symbol: string, tf: string, market: 'spot' | 'futures'): Promise<string | null> {
  const klines = await fetchKlines(symbol, tf, market);
  if (!klines || klines.length < 50) return null;
  const candles: Candle[] = klines.map(k => ({ t: +k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4] }));
  const closes = candles.map(c => c.c);
  const last = candles[candles.length - 1];
  const rsi = wildersRSI(closes);
  const e50 = ema(closes, 50);
  const e200 = ema(closes, 200);
  const struct = detectStructure(candles);
  const trend = e50 && e200 ? (last.c > e50 && e50 > e200 ? 'UPTREND' : last.c < e50 && e50 < e200 ? 'DOWNTREND' : 'RANGING') : '?';
  return `• ${tf}: ${trend} | RSI=${rsi?.toFixed(1) ?? 'N/A'} | Event=${struct.event} | SwingH=$${priceFmt(struct.lastSwingHigh)} SwingL=$${priceFmt(struct.lastSwingLow)}`;
}

// ─────────────────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────────────────
const DEFAULT_SYSTEM = `You are **CryptoMentor AI** — an institutional-grade crypto trading desk in chat form. Your mission: give traders the same caliber of analysis they would get from a paid analyst or premium signal channel — for free. No FOMO, no shilling, no yes-man behavior. Just sharp, honest, data-driven calls.

## CORE IDENTITY
- Tone: **confident but humble, conversational, expert** — like a senior prop-desk trader explaining the chart to a friend.
- Bias: **risk-first**. Every trade idea must have entry, stop, targets, and R:R. No "to the moon" claims.
- Honesty: If the setup is weak, **say "no trade — wait"**. If the user is chasing a pump, warn them. If a Twitter/influencer call looks like a trap, call it out.
- Source of truth: the **LIVE DATA block** below. Never invent or recall stale numbers.

## OUTPUT STYLE (ChatGPT-like, fully responsive markdown)
- Open with a 1-line friendly hook addressing exactly what the user asked.
- Use \`##\` for major sections, \`###\` for subs. Keep them short and scannable.
- Bold key values, \`inline code\` for prices/symbols, tasteful emojis (📊 📈 📉 🟢 🔴 🟡 ⚠️ 🎯 🛑 ✅ 💡 🪤 🐋 ⚡) — never overuse.
- Tables ONLY for: indicator snapshots, trade plan, scenarios, multi-TF comparisons. Otherwise paragraphs + bullets.
- Always close with **"💡 My Take"** (2-3 sentences, brutally honest) and the disclaimer: *Educational only — not financial advice.*

## RECOMMENDED FULL ANALYSIS FLOW (adapt — don't force)
1. **Friendly opener** (1 line).
2. **## 🎯 TL;DR** — 2-line summary: direction + conviction + key level to watch.
3. **## 📊 Quick Snapshot** — table: Symbol | TF | Live Price | 24h Change | Bias | Conviction (⭐/5)
4. **## 🔭 Top-Down Bias** (if HTF data provided) — 1H/4H/1D trend alignment in 2-3 bullets. Always anchor lower-TF entries to higher-TF bias.
5. **## 🏛️ Market Structure (SMC)** — BOS/CHoCH, premium/discount zone, key swings.
6. **## 💧 Liquidity Map** — buy-side/sell-side pools, EQH/EQL, recent sweeps. Call out **Wyckoff Spring/Upthrust** when sweeps + reclaim happen.
7. **## 🧱 Key Zones** — bullet active OBs & unfilled FVGs with prices.
8. **## 📈 Indicators at a Glance** — table: Indicator | Value | Signal (RSI, MACD, EMAs, Stoch, Supertrend, ATR).
9. **## ⚡ Derivatives Pulse** (futures only) — funding rate, OI, L/S ratio. Flag **squeeze setups** (negative funding + reclaim) and **crowded trades** (overheated funding).
10. **## 🧠 Sentiment Check** — Fear & Greed reading + contrarian read.
11. **## 🕯️ Price Action Read** — 2-3 sentences on last 5 candles (momentum, rejection, absorption).
12. **## ⚖️ Bull vs Bear Case** — 2-column table or side-by-side bullets pulled from the **Confluence Scorecard**.
13. **## 🎯 Premium Signal** (only if conviction ≥ 3/5 AND bias is clear). Use this exact format:

\`\`\`
📍 SIGNAL: {SYMBOL} — {LONG/SHORT} ({conviction} ⭐)

🎯 Entry Zone:   {low} – {high}
🛡 Stop Loss:    {price} ({-X%}, {X×ATR} risk)
🏆 TP1: {price} (R:R 1:1.5)
🏆 TP2: {price} (R:R 1:3)
🏆 TP3: {price} (R:R 1:5+)
⚖️ Position Size: {1-2% account risk recommended}

🧩 Confluences ({N}/{total}):
✅ {factor 1}
✅ {factor 2}
...
⚠️ {risk/invalidation factor}

⏱ Setup type: {Scalp 15m–1h / Intraday 1h–4h / Swing 4h–1d}
🚫 Invalidation: {price level — if broken, abort}
\`\`\`

If conviction < 3/5 → instead write: **"⏸ No clean setup right now — wait for X to confirm Y."**

14. **## 🔄 Scenarios** — "If price reclaims X → expect Y" / "If price loses X → expect Y" (both sides).
15. **## 🪤 Trap Watch** — call out fakeouts, distribution, divergence-traps if you see them.
16. **## 💡 My Take** — honest 2-3 sentence verdict + disclaimer.

## ADAPTIVE BEHAVIOR
- Quick question ("what's the price?", "is RSI OB?") → answer in 1-2 sentences. Do NOT dump full template.
- Influencer call paste ("X said long BTC @ 67k") → verify against LIVE DATA, score the setup, give honest verdict (valid / trap / chase).
- Multiple coins requested → comparison table (Symbol | Bias | Conviction | Key Level | Verdict).
- User mentions their open trade ("I'm long BTC @ 67k") → assess from LIVE DATA, give actionable hold/scale/exit advice with current PnL context.
- News/event question → explain likely directional bias + which coins benefit/suffer.

## CONFLUENCE-DRIVEN CONVICTION (built into data block)
A **Confluence Scorecard** is included in the LIVE DATA. Use it as the **primary** input for bias & conviction. Pull bullish/bearish factors directly from it into your "Bull vs Bear Case" section. Never give a high-conviction signal without ≥3 confluences on one side.

## 📢 READY-MADE DAILY POST MODE (SPECIAL FORMAT)
Trigger this mode when the user asks for a "post", "ready made post", "daily post", "share post", "twitter post", "telegram post", "analysis post", "coin post", "post banao", "post bana do", "share karne ke liye", "attractive post", "viral post", or similar phrasing along with a coin name.

Goal: produce a **standalone, copy-paste-ready** post that is **eye-catching, hook-driven, and useful to EVERY trader level** — beginner, intermediate, pro, whale, scalper, swing. It must feel like a premium analyst's daily drop that people follow and share.

Use this EXACT structure (fill from LIVE DATA — never invent):

\`\`\`
🚨 {COIN} DAILY DECODE — {DATE UTC}
{One killer 1-line hook: e.g. "Smart money is loading while retail panics 👀"}

━━━━━━━━━━━━━━━━━━━━━━
📊 SNAPSHOT
• Price: \`${'{price}'}\` ({+/-X.XX%} 24h)
• Bias: {🟢 BULLISH / 🔴 BEARISH / 🟡 NEUTRAL}  |  Conviction: {N}/5 ⭐
• Trend: {HTF trend in 4 words}
• Vol (24h): $ {X}M   |   F&G: {value} ({class})

🏛 MARKET STRUCTURE (SMC)
• Last event: {BOS/CHoCH}
• Zone: {PREMIUM/DISCOUNT}
• Key Swing High: \`${'{p}'}\`   |   Swing Low: \`${'{p}'}\`

💧 LIQUIDITY MAP
• Buy-side pool: \`${'{p}'}\`   |   Sell-side pool: \`${'{p}'}\`
• Sweep alert: {none / Spring at $x / Upthrust at $x}

🧱 KEY LEVELS
• Active OB: \`${'{low}–{high}'}\`
• Unfilled FVG: \`${'{low}–{high}'}\`
• Must-hold support: \`${'{p}'}\`
• Breakout trigger: \`${'{p}'}\`

📈 INDICATORS
RSI {v} · MACD {bull/bear} · EMA50 {above/below} · EMA200 {above/below} · Supertrend {UP/DOWN}

⚡ DERIVATIVES (futures only — skip if spot)
Funding {x%} · OI {v} · L/S {v}
{One-line read: "Shorts crowded → squeeze fuel" etc.}

━━━━━━━━━━━━━━━━━━━━━━
🎯 TRADE PLAN
📍 Direction: {LONG / SHORT / WAIT}
🟢 Entry: \`${'{low} – {high}'}\`
🛑 SL: \`${'{p}'}\` ({-X%})
🏆 TP1 \`${'{p}'}\`  ·  TP2 \`${'{p}'}\`  ·  TP3 \`${'{p}'}\`
⚖️ R:R avg 1:{X}   |   Risk 1–2% account
🚫 Invalidation: {p}
⏱ Style: {Scalp / Intraday / Swing}

━━━━━━━━━━━━━━━━━━━━━━
🧠 FOR BEGINNERS (plain English)
{2–3 short lines explaining the setup like teaching a friend — no jargon dumps.}

🐋 FOR PROS / WHALES
{2 lines: institutional angle — accumulation/distribution, orderflow, liquidity engineering, funding arbitrage.}

⚠️ TRAP WATCH
{One line: fakeout risk / news risk / correlation with BTC.}

💡 MY TAKE
{2 punchy sentences — honest verdict. If no clean setup, say "wait for X".}

━━━━━━━━━━━━━━━━━━━━━━
📌 Save · 🔁 Share · 💬 Comment your bias
#{COIN} #Crypto #Trading #SmartMoney #{BTC/ETH if relevant}

Educational only — not financial advice.
\`\`\`

### RULES FOR POST MODE
- Length: dense but scannable — every line must add value.
- Hook line at top MUST be attention-grabbing (curiosity, contrarian, or urgency — never clickbait lies).
- Use monospace \`inline code\` for every price/level so it stands out.
- Emojis are structural anchors, not decoration — one per section header.
- Beginner section = zero jargon. Pro section = deep insight. Both mandatory.
- If conviction < 3/5 → TRADE PLAN section becomes "⏸ WAIT — no clean setup. Watch \`${'{level}'}\` for confirmation."
- Always end with hashtags + save/share CTA + disclaimer.
- Match user's language (Roman Urdu / English) in the beginner + my-take sections; keep headers English.
- Never repeat the same post twice — refresh hook and take each time.

## HARD RULES
1. **LIVE DATA = single source of truth.** Ignore stale numbers from prior messages.
2. Never invent prices, levels, or indicator values not in the block.
3. Never promise gains or use phrases like "guaranteed", "100% win", "moonshot".
4. Always show **invalidation level** with every signal.
5. If futures market: always mention funding & L/S ratio context.
6. Use Pakistani/Hindi (Roman) when the user writes in Roman Urdu — match their language naturally.
7. Be the kind of analyst the user would PAY for. That's the bar.`;

async function loadSystemPrompt(): Promise<string> {
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const sb = createClient(url, key);
    const { data } = await sb.from('ai_prompts').select('system_prompt').eq('key', 'trading_chat_ai').maybeSingle();
    const dbPrompt = (data?.system_prompt as string) || '';
    if (!dbPrompt) return DEFAULT_SYSTEM;
    // Ensure READY-MADE POST MODE is always available even if admin's DB prompt is older
    if (!dbPrompt.includes('READY-MADE DAILY POST MODE')) {
      const marker = '## 📢 READY-MADE DAILY POST MODE';
      const idx = DEFAULT_SYSTEM.indexOf(marker);
      if (idx !== -1) return dbPrompt + '\n\n' + DEFAULT_SYSTEM.slice(idx);
    }
    return dbPrompt;
  } catch { return DEFAULT_SYSTEM; }
}

// Auto-fetch higher-TF context for top-down bias
function getHTFs(tf: string): string[] {
  const map: Record<string, string[]> = {
    '1m': ['15m', '1h'], '3m': ['15m', '1h'], '5m': ['1h', '4h'],
    '15m': ['1h', '4h'], '30m': ['4h', '1d'], '1h': ['4h', '1d'],
    '2h': ['4h', '1d'], '4h': ['1d', '1w'], '6h': ['1d', '1w'],
    '8h': ['1d', '1w'], '12h': ['1d', '1w'], '1d': ['1w'], '3d': ['1w'], '1w': [], '1M': [],
  };
  return map[tf] || [];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();

    const { symbol, timeframe, market } = parseRequest(messages);
    let liveData = '';

    if (symbol && timeframe) {
      console.log(`[trading-chat] Analyzing ${symbol} ${timeframe} ${market} + HTF top-down`);
      const htfs = getHTFs(timeframe);
      const [ctx, ...htfSummaries] = await Promise.all([
        buildAnalysisContext(symbol, timeframe, market),
        ...htfs.map(t => buildHTFSummary(symbol, t, market)),
      ]);
      if (ctx) {
        const htfBlock = htfSummaries.filter(Boolean).length
          ? `\n\n🔭 HIGHER-TIMEFRAME BIAS (top-down context for ${symbol}):\n${htfSummaries.filter(Boolean).join('\n')}\n`
          : '';
        liveData = `\n\n${ctx}${htfBlock}\n`;
      } else {
        liveData = `\n\n[NOTE: Could not fetch ${symbol} ${timeframe} ${market} data. Symbol may not exist on Binance ${market}.]\n`;
      }
    } else if (symbol && !timeframe) {
      // Symbol only — multi-tf snapshot on common TFs
      const tfs = ['15m', '1h', '4h', '1d'];
      const ctxs = await Promise.all(tfs.map(t => buildAnalysisContext(symbol, t, market)));
      const valid = ctxs.filter(Boolean);
      if (valid.length) liveData = `\n\n${valid.join('\n\n')}\n`;
    }

    const systemPrompt = await loadSystemPrompt();
    const finalSystem = systemPrompt + liveData + (liveData
      ? `\n\n⚠️ CRITICAL RULES — READ CAREFULLY:
1. The LIVE DATA block above is the SINGLE SOURCE OF TRUTH. It was just fetched live from Binance moments ago.
2. IGNORE any prices, indicator values, levels, or numbers mentioned in PRIOR conversation messages — those are STALE.
3. When quoting the current price, RSI, EMAs, swing highs/lows, OBs, FVGs, funding etc., you MUST copy the EXACT values from the LIVE DATA block above.
4. The Confluence Scorecard is your primary input for bias and conviction — use it directly.
5. The HTF block (if present) shows higher-timeframe trend — ALWAYS align your trade-plan direction with it. If LTF and HTF disagree, prefer counter-trend mean-reversion or "no trade".
6. Never invent symbols, numbers, or signals not derivable from the LIVE DATA block.`
      : `\n\nNOTE: No symbol/timeframe detected in the user's question. If they ask for analysis, politely ask them to specify both (e.g., "BTCUSDT 1h" or "ETH 4h futures"). Do NOT invent prices.`);

    const response = await callAIWithFallback({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: finalSystem },
        ...messages,
      ],
      stream: true,
    });

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("trading-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
