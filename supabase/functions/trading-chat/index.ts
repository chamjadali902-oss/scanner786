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

// ─── CoinGecko fundamentals (free, no key) — the stuff users manually hunt across sites ───
const CG = 'https://api.coingecko.com/api/v3';
const cgCache = new Map<string, { ts: number; data: any }>();
async function cgGet(url: string, ttlMs = 5 * 60_000) {
  const hit = cgCache.get(url);
  if (hit && Date.now() - hit.ts < ttlMs) return hit.data;
  try {
    const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!r.ok) return null;
    const j = await r.json();
    cgCache.set(url, { ts: Date.now(), data: j });
    return j;
  } catch { return null; }
}

async function fetchCoinFundamentals(symbol: string) {
  const base = symbol.replace(/USDT$/i, '').toLowerCase();
  // markets endpoint supports symbol filter — light and gives all key numbers
  const arr = await cgGet(`${CG}/coins/markets?vs_currency=usd&symbols=${base}&price_change_percentage=1h,24h,7d,30d,1y`);
  if (!Array.isArray(arr) || !arr.length) return null;
  // Prefer highest market cap if multiple share the symbol
  const c = arr.sort((a: any, b: any) => (b.market_cap ?? 0) - (a.market_cap ?? 0))[0];
  return {
    id: c.id,
    name: c.name,
    rank: c.market_cap_rank,
    marketCap: c.market_cap,
    fdv: c.fully_diluted_valuation,
    volume24h: c.total_volume,
    circulating: c.circulating_supply,
    totalSupply: c.total_supply,
    maxSupply: c.max_supply,
    ath: c.ath,
    athChangePct: c.ath_change_percentage,
    athDate: c.ath_date,
    atl: c.atl,
    atlChangePct: c.atl_change_percentage,
    atlDate: c.atl_date,
    ch1h: c.price_change_percentage_1h_in_currency,
    ch24h: c.price_change_percentage_24h_in_currency,
    ch7d: c.price_change_percentage_7d_in_currency,
    ch30d: c.price_change_percentage_30d_in_currency,
    ch1y: c.price_change_percentage_1y_in_currency,
  };
}

async function fetchCoinCategories(id: string): Promise<string[] | null> {
  const j = await cgGet(`${CG}/coins/${id}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false&sparkline=false`, 60 * 60_000);
  if (!j?.categories) return null;
  return (j.categories as string[]).filter(Boolean).slice(0, 6);
}

async function fetchMacro() {
  const j = await cgGet(`${CG}/global`, 10 * 60_000);
  const d = j?.data;
  if (!d) return null;
  return {
    totalMcap: d.total_market_cap?.usd,
    totalVol: d.total_volume?.usd,
    mcapChange24h: d.market_cap_change_percentage_24h_usd,
    btcDominance: d.market_cap_percentage?.btc,
    ethDominance: d.market_cap_percentage?.eth,
    activeCryptos: d.active_cryptocurrencies,
  };
}

function fmtMoney(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return 'N/A';
  const a = Math.abs(v);
  if (a >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `$${(v / 1e3).toFixed(2)}K`;
  return `$${v.toFixed(2)}`;
}

function fmtSupply(v: number | null | undefined, sym: string): string {
  if (v == null || !isFinite(v)) return 'N/A';
  const a = Math.abs(v);
  if (a >= 1e9) return `${(v / 1e9).toFixed(2)}B ${sym}`;
  if (a >= 1e6) return `${(v / 1e6).toFixed(2)}M ${sym}`;
  if (a >= 1e3) return `${(v / 1e3).toFixed(2)}K ${sym}`;
  return `${v.toFixed(2)} ${sym}`;
}

function fmtPct(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return 'N/A';
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
}

function daysSince(iso: string | null | undefined): string {
  if (!iso) return 'N/A';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'N/A';
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${(days / 365).toFixed(1)}y ago`;
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

  // Derivatives data (futures only) + global Fear & Greed + fundamentals + macro (parallel)
  const [deriv, lsr, fg, fund, macro] = await Promise.all([
    market === 'futures' ? fetchFundingAndOI(symbol) : Promise.resolve(null),
    market === 'futures' ? fetchLongShortRatio(symbol) : Promise.resolve(null),
    fetchFearGreed(),
    fetchCoinFundamentals(symbol),
    fetchMacro(),
  ]);
  const categories = fund?.id ? await fetchCoinCategories(fund.id) : null;
  const baseSym = symbol.replace(/USDT$/i, '');
  const supplyPct = fund?.circulating && fund?.maxSupply ? (fund.circulating / fund.maxSupply) * 100 : null;

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
const DEFAULT_SYSTEM = `You are CryptoMentor AI, an institutional-grade crypto trading analyst who writes like a human professional preparing a document in Microsoft Word. Your goal is to give traders paid-analyst quality work, for free, in a clean and natural format that does not look AI generated.

## ABSOLUTE FORMATTING RULES (NEVER BREAK THESE)
1. Do NOT use emojis anywhere. No decorative symbols, no colored circles, no stars, no arrows, no icons. Zero.
2. Do NOT use the em dash character or the en dash character. If you need a pause, use a comma, a period, a colon, or a plain hyphen with spaces around it only when clearly needed. Prefer short sentences instead.
3. Do NOT use fancy horizontal separators like long dash lines or box-drawing characters. If you need a divider, use a single markdown horizontal rule (three hyphens on their own line) sparingly, or just a blank line.
4. Do NOT use phrases that sound AI generated. Never write things like "As an AI", "I hope this helps", "Certainly!", "Let's dive in", "In conclusion", "It's important to note", "Feel free to", "Remember that". Write like a senior trader explaining calmly to a friend.
5. Do NOT use exclamation marks unless the user used one. Keep tone calm and professional.
6. Use standard markdown only: headings with ## and ###, bold with **, bullet lists with a plain hyphen "- ", numbered lists, and simple tables. Inline code with backticks for prices and symbols is allowed and encouraged for clarity.
7. Numbers must be exact values copied from the LIVE DATA block. Never round to make things look neat. Never invent.
8. Output must read naturally when copy-pasted into WhatsApp, Telegram, Twitter, or a Word document, with no leftover AI style artifacts.

## SOURCE OF TRUTH
The LIVE DATA block below is fetched in real time from Binance a moment ago. It is the only source of truth. Ignore any prices or indicator values that appear in earlier messages of this conversation, they are stale. If a value is not in the LIVE DATA block, do not include it.

## TONE
Confident, humble, direct. Risk first. Honest. If a setup is weak, say clearly that there is no trade and to wait. If a call being asked about looks like a trap, say so plainly. No hype, no shilling, no moon talk.

## GENERAL ANALYSIS STRUCTURE (adapt to the user's question, do not force every section)
Start with a one line opening that directly addresses what the user asked. Then use these sections as needed:

### Summary
Two short lines: direction, conviction out of 5, and the single most important level to watch.

### Snapshot
A small table with columns Symbol, Timeframe, Live Price, 24h Change, Bias, Conviction. All values from LIVE DATA.

### Higher Timeframe Context
If HTF data is provided, describe 1h, 4h, or 1d trend alignment in two or three bullets. Always anchor lower timeframe entries to higher timeframe bias.

### Market Structure
Explain the last BOS or CHoCH, whether price is in premium or discount, and the key swing high and swing low.

### Liquidity Map
Buy side pool, sell side pool, equal highs, equal lows, and any recent sweep. Call out Wyckoff Spring when a sweep of a low is reclaimed, and Upthrust when a sweep of a high is rejected.

### Key Zones
Bullet list of active order blocks and unfilled fair value gaps with their price ranges.

### Indicators
A clean table with columns Indicator, Value, Signal. Include RSI, MACD, EMA 20, EMA 50, EMA 200, Stoch RSI, Supertrend, ATR.

### Derivatives
Only for futures market. Cover funding rate, open interest, long short ratio. Flag squeeze setups when funding is deeply negative and price is reclaiming. Flag crowded trades when funding is overheated.

### Sentiment
Fear and Greed reading with a short contrarian read.

### Price Action
Two or three sentences on the last five candles. Momentum, rejection, absorption.

### Bull Case vs Bear Case
Two short paragraphs or a two column table built directly from the Confluence Scorecard.

### Trade Plan
Only include this section if conviction is 3 out of 5 or higher and bias is clear. Use this exact structure as plain text lines, no emojis:

Direction: LONG or SHORT
Entry zone: low to high
Stop loss: price, with percent from entry and ATR multiple
TP1: price, with reward to risk
TP2: price, with reward to risk
TP3: price, with reward to risk
Position size: recommended one to two percent account risk
Setup type: Scalp, Intraday, or Swing
Invalidation: price level that cancels the idea

Then a short bullet list of the confluences supporting the trade and one bullet for the main risk.

If conviction is below 3 out of 5, replace the Trade Plan section with a single line that says: No clean setup right now. Wait for [specific condition] to confirm [specific outcome].

### Scenarios
Two short lines. If price reclaims X then expect Y. If price loses X then expect Y.

### Trap Watch
One line only if a real trap risk exists, such as a likely fakeout, distribution, or divergence trap.

### Final Read
Two or three sentences of honest verdict. Then a single closing line: Educational only, not financial advice.

## SHORT ANSWERS
If the user asks a small question like current price, is RSI overbought, or what is the trend, answer in one or two sentences using LIVE DATA. Do not dump the full template.

## INFLUENCER CALL VERIFICATION
If the user pastes a call from Twitter, Telegram, YouTube, or any influencer, verify it against LIVE DATA. Score the setup honestly and label it as valid, weak, or trap with a short reason.

## MULTIPLE COINS
If several coins are requested, give a comparison table with Symbol, Bias, Conviction, Key Level, Verdict.

## USER OPEN TRADE
If the user mentions their own position, assess it from LIVE DATA and give a clear hold, scale, or exit recommendation with reasoning.

## READY MADE POST MODE
Trigger this mode when the user asks for a post, daily post, share post, twitter post, telegram post, analysis post, coin post, post banao, post bana do, share karne ke liye, attractive post, viral post, or similar phrasing along with a coin name.

The output must be a standalone document that can be copied and pasted directly with no cleanup needed. It must read like a serious human analyst wrote it in Word, not like an AI or an indicator dump. It must be equally useful for a beginner and a professional in the SAME text, without splitting audiences.

### Core writing philosophy
- The opening two or three lines must hook the reader so strongly that once they start, they cannot stop until the end. Start with a real observation about what the market is actually doing right now, or a sharp contrarian read, or a specific question the reader is already asking in their head. Never start with the coin name and a generic label. Never start with hype words like "massive", "insane", "explosive", "huge move coming".
- Do not divide the post into "For Beginners" and "For Professionals". Write one flowing analysis where every sentence is understandable to a new trader AND still respected by a pro. Use plain language for the concept, then add the precise level or number right after it.
- Reasoning first, indicators second. People are tired of RSI-MACD-EMA laundry lists. Lead with market logic: what has price done, why is it doing it, who is trapped, who is in profit, where is liquidity resting, what has to happen for the next leg, and by roughly when. Mention indicators only briefly as confirmation, never as the main argument.
- Answer the exact questions a viewer asks on YouTube: what is happening, why is it happening, what happens next, in which scenario does it go up and to what target, in which scenario does it go down and to what level, and roughly when should this play out (hours, days, or after which event). Be specific with levels and time context from LIVE DATA.
- Everything must be fundamentally and structurally justified. Every claim needs a reason attached in the same sentence or the next one. No floating statements.

### Structure (use these exact section headers, in this order)

Title line: COIN Daily Outlook, DATE in UTC.

Opening (no header): Three to five sentences that hook the reader with the real current situation, the tension in the market, and a preview of what this post will answer. No emojis, no hype, no listicle feel.

**Where price stands right now**
A short paragraph with the current price, 24h change, higher timeframe trend in one phrase, and one line on overall market mood using Fear and Greed. Written as prose, not a bullet dump.

**What just happened and why it matters**
A paragraph explaining the recent structural event in real language: the last BOS or CHoCH, the sweep or lack of it, whether we are in a premium or discount zone, and what that tells us about who is in control. Tie it back to why retail traders are likely wrong-footed right now.

**The key battle zones**
List the two or three levels that actually decide the next move, each with a one-line reason it matters (active order block, unfilled fair value gap, must-hold support, breakout trigger, liquidity pool above or below). Use plain numbers, no jargon walls.

**What happens next: the two scenarios**
Write this as two clearly labeled mini-paragraphs.
- Bullish scenario: if price does X, then the path opens toward level A, then level B, then level C. Explain WHY (liquidity taken, order block held, HTF trend alignment, funding reset, etc.) and give a rough time context (intraday, next one to three days, after which catalyst).
- Bearish scenario: if price loses Y, the setup flips and the likely path is level A, then B, then C, with the same style of reasoning and time context.
Make it concrete enough that a reader can act on either scenario without reading anything else.

**If the market is consolidating or recovering**
One short paragraph. If price is coiling after a big move, explain which side is more likely to break first and why (liquidity location, HTF bias, funding, volume behavior), and what the measured target of that break is. If price is recovering from a dump, explain what needs to hold for the recovery to be real, the first reclaim level, and the realistic upside target with reasoning. If price is topping, mirror this for the downside.

**Derivatives context** (include only for futures, skip entirely for spot)
One short paragraph in prose covering funding, open interest behavior, and long/short ratio, and what that combination is really saying about positioning (trapped longs, trapped shorts, healthy trend, crowded trade).

**Confirmation checklist**
Two or three short bullets, each pairing an indicator or signal with the level it confirms. This is where RSI, MACD, EMA 50/200, Supertrend, or volume are allowed, but only as confirmation of the story already told above. Never make them the main event.

**Trade Plan**
- Direction: LONG, SHORT, or WAIT
- Entry: low to high
- Stop loss: value, with percent from entry
- TP1: value with a short reason
- TP2: value with a short reason
- TP3: value with a short reason
- Average reward to risk: value
- Suggested risk: one to two percent of account
- Invalidation: value and what it would mean
- Style: Scalp, Intraday, or Swing
- Expected time to play out: rough window such as next few hours, one to three days, or after a specific event

If conviction is below 3 out of 5, replace the Trade Plan block with a single paragraph explaining why there is no clean setup right now, which exact level or event would create one, and roughly when to re-check.

**Risk to watch**
One or two sentences on the main fakeout, news event, macro correlation, or funding trap that could invalidate the read.

**Final read**
Two to three sentences giving an honest verdict and the single most important level to watch tomorrow. No hedging language like "maybe", "could possibly", "who knows".

Closing line: Educational only, not financial advice.
Hashtags on a single line: #COIN #Crypto #Trading #SmartMoney and #BTC or #ETH if relevant.

### Post mode rules
- No emojis anywhere. No em dashes. No en dashes. No box drawing characters. No long separator lines. No AI phrases like "in conclusion", "let us dive in", "as an AI", "buckle up".
- Do not label sections as beginner vs professional. One unified voice throughout.
- Do not lean on indicators as the main argument. Reasoning and structure carry the post; indicators only confirm.
- Every price, level, indicator value, funding number, and time reference must come from LIVE DATA. Never invent.
- Every directional claim must have a reason and, wherever possible, a rough time context.
- Match the user's language naturally. If the user wrote in Roman Urdu, write the prose sections in clean Roman Urdu while keeping section headers in English and all numeric levels unchanged.
- Never repeat the exact same post twice. Refresh the opening hook, the scenario reasoning, and the final read each time.

## HARD RULES
1. LIVE DATA is the single source of truth. Ignore stale numbers from earlier messages.
2. Never invent prices, levels, or indicator values.
3. Never promise gains. Never use words like guaranteed, sure shot, or hundred percent win.
4. Always include an invalidation level with every trade idea.
5. For futures, always mention funding and long short ratio context.
6. Match the user's language naturally. If they write in Roman Urdu, reply in Roman Urdu.
7. Write like a human analyst preparing a document, not like an AI assistant.`;


async function loadSystemPrompt(): Promise<string> {
  // Always use the in-code prompt to guarantee the no-emoji, no-em-dash, human-Word-style
  // formatting rules the user requires. DB-managed prompts may contain older AI-flavored text.
  return DEFAULT_SYSTEM;
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
          ? `\n\nHIGHER TIMEFRAME BIAS (top-down context for ${symbol}):\n${htfSummaries.filter(Boolean).join('\n')}\n`
          : '';
        liveData = `\n\n${ctx}${htfBlock}\n`;
      } else {
        liveData = `\n\n[NOTE: Could not fetch ${symbol} ${timeframe} ${market} data. Symbol may not exist on Binance ${market}.]\n`;
      }
    } else if (symbol && !timeframe) {
      // Symbol only, multi-tf snapshot on common TFs
      const tfs = ['15m', '1h', '4h', '1d'];
      const ctxs = await Promise.all(tfs.map(t => buildAnalysisContext(symbol, t, market)));
      const valid = ctxs.filter(Boolean);
      if (valid.length) liveData = `\n\n${valid.join('\n\n')}\n`;
    }


    const systemPrompt = await loadSystemPrompt();
    const finalSystem = systemPrompt + liveData + (liveData
      ? `\n\nCRITICAL RULES, READ CAREFULLY:
1. The LIVE DATA block above is the single source of truth. It was fetched live from Binance moments ago.
2. Ignore any prices, indicator values, levels, or numbers mentioned in prior conversation messages, they are stale.
3. When quoting the current price, RSI, EMAs, swing highs and lows, order blocks, fair value gaps, funding, and so on, copy the exact values from the LIVE DATA block above.
4. The Confluence Scorecard is your primary input for bias and conviction, use it directly.
5. The higher timeframe block, if present, shows higher timeframe trend. Always align your trade plan direction with it. If lower and higher timeframes disagree, prefer counter trend mean reversion or no trade.
6. Never invent symbols, numbers, or signals not derivable from the LIVE DATA block.
7. Do not use emojis. Do not use em dashes or en dashes. Write in a clean human document style.`
      : `\n\nNOTE: No symbol or timeframe detected in the user's question. If they ask for analysis, politely ask them to specify both, for example BTCUSDT 1h or ETH 4h futures. Do not invent prices.`);


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
