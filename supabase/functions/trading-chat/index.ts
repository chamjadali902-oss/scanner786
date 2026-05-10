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

function parseRequest(messages: { role: string; content: string }[]) {
  const lastUser = [...messages].reverse().find(m => m.role === 'user');
  const text = (lastUser?.content || '').trim();
  const upper = text.toUpperCase();

  // Market detection
  const market: 'spot' | 'futures' = /\b(FUTURES?|PERP|PERPETUAL|FUT)\b/i.test(text) ? 'futures' : 'spot';

  // Timeframe detection (case-sensitive for "M" vs "m")
  let tf: string | null = null;
  for (const t of VALID_TFS) {
    const re = new RegExp(`(^|[^A-Za-z0-9])${t}([^A-Za-z0-9]|$)`, t === '1M' ? '' : 'i');
    if (re.test(text)) { tf = t; break; }
  }

  // Symbol detection
  let symbol: string | null = null;
  // Pattern XXXUSDT / XXX/USDT / XXX-USDT
  const explicit = upper.match(/\b([A-Z0-9]{2,10})[/\-]?USDT\b/);
  if (explicit) symbol = explicit[1] + 'USDT';
  if (!symbol) {
    for (const c of KNOWN_COINS) {
      const re = new RegExp(`\\b${c}\\b`);
      if (re.test(upper)) { symbol = c + 'USDT'; break; }
    }
  }

  return { symbol, timeframe: tf, market };
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
  const [klines, ticker] = await Promise.all([
    fetchKlines(symbol, tf, market),
    fetchTicker(symbol, market),
  ]);
  if (!klines || klines.length < 50) return null;

  const candles: Candle[] = klines.map(k => ({ t: +k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4] }));
  const closes = candles.map(c => c.c);
  const highs = candles.map(c => c.h);
  const lows = candles.map(c => c.l);
  const last = candles[candles.length - 1];
  const price = last.c;

  // Indicators
  const rsi = wildersRSI(closes);
  const e9 = ema(closes, 9), e20 = ema(closes, 20), e50 = ema(closes, 50), e200 = ema(closes, 200);
  const m = macd(closes);
  const bb = bbands(closes);
  const sr = stochRSI(closes);
  const st = supertrend(highs, lows, closes);
  const atr = atrWilder(highs, lows, closes);

  // SMC
  const struct = detectStructure(candles);
  const fvgs = findFVGs(candles);
  const obs = findOrderBlocks(candles);
  const sweeps = detectLiquiditySweeps(candles);
  const eq = equalLevels(candles);

  // Premium / discount zones (last leg)
  let zone = 'N/A';
  if (struct.lastSwingHigh && struct.lastSwingLow) {
    const mid = (struct.lastSwingHigh + struct.lastSwingLow) / 2;
    zone = price > mid ? 'PREMIUM (sell zone)' : 'DISCOUNT (buy zone)';
  }

  // Last 5 candles
  const last5 = candles.slice(-5).map((c, i) => {
    const body = c.c - c.o;
    const range = c.h - c.l;
    const upper = c.h - Math.max(c.o, c.c);
    const lower = Math.min(c.o, c.c) - c.l;
    let label = body > 0 ? 'Green' : 'Red';
    if (Math.abs(body) / range < 0.15) label = 'Doji';
    else if (lower > Math.abs(body) * 2 && body > 0) label = 'Hammer (bull)';
    else if (upper > Math.abs(body) * 2 && body < 0) label = 'Shooting Star (bear)';
    return `#${i + 1} ${label} O:${c.o} H:${c.h} L:${c.l} C:${c.c}`;
  });

  const fmt = (v: number | null | undefined, d = 4) => (v == null ? 'N/A' : (+v).toFixed(d));
  const change = ticker ? (+ticker.priceChangePercent).toFixed(2) : 'N/A';
  const vol = ticker ? (+ticker.quoteVolume / 1e6).toFixed(2) : 'N/A';

  return `
═══════════════════════════════════════════════════════════
LIVE BINANCE ${market.toUpperCase()} DATA — ${symbol} @ ${tf}
Computed on 500 fresh candles (TradingView-accurate)
═══════════════════════════════════════════════════════════

PRICE
• Current: $${price}
• 24h Change: ${change}%  | 24h Quote Vol: $${vol}M
• ATR(14): ${fmt(atr)}

TECHNICAL INDICATORS
• RSI(14) Wilder: ${fmt(rsi, 2)} ${rsi && rsi > 70 ? '(OVERBOUGHT)' : rsi && rsi < 30 ? '(OVERSOLD)' : ''}
• Stoch RSI: K=${fmt(sr?.k, 2)} D=${fmt(sr?.d, 2)} ${sr && sr.k > 80 ? '(OB)' : sr && sr.k < 20 ? '(OS)' : ''}
• MACD(12,26,9): MACD=${fmt(m?.macd)} Signal=${fmt(m?.signal)} Hist=${fmt(m?.histogram)} ${m ? (m.histogram > 0 ? '(Bullish)' : '(Bearish)') : ''}
• EMA9=${fmt(e9)} | EMA20=${fmt(e20)} | EMA50=${fmt(e50)} | EMA200=${fmt(e200)}
• Price vs EMAs: ${e20 ? (price > e20 ? 'Above EMA20' : 'Below EMA20') : ''} | ${e50 ? (price > e50 ? 'Above EMA50' : 'Below EMA50') : ''} | ${e200 ? (price > e200 ? 'Above EMA200' : 'Below EMA200') : ''}
• Bollinger(20,2): U=${fmt(bb?.upper)} M=${fmt(bb?.middle)} L=${fmt(bb?.lower)} BW=${fmt(bb?.bandwidth, 2)}%
• Supertrend(10,3): ${st ? `${st.direction} @ $${fmt(st.value)}` : 'N/A'}

MARKET STRUCTURE (SMC/ICT)
• Most Recent Event: ${struct.event}
• Last Swing High: $${fmt(struct.lastSwingHigh)} | Prev: $${fmt(struct.prevSwingHigh)}
• Last Swing Low:  $${fmt(struct.lastSwingLow)}  | Prev: $${fmt(struct.prevSwingLow)}
• Recent Swing Highs: ${struct.recentHighs.map(p => '$' + p.toFixed(4)).join(', ')}
• Recent Swing Lows:  ${struct.recentLows.map(p => '$' + p.toFixed(4)).join(', ')}
• Current Zone: ${zone}
• Equal Highs (EQH): ${eq.eqh ? 'YES — buy-side liquidity above' : 'No'}
• Equal Lows  (EQL): ${eq.eql ? 'YES — sell-side liquidity below' : 'No'}

LIQUIDITY
• Buy-side pool (recent high): $${fmt(sweeps.prevHigh)}
• Sell-side pool (recent low): $${fmt(sweeps.prevLow)}
• Sweep High this candle: ${sweeps.sweepHigh ? `YES — wicked $${sweeps.sweepHigh.toFixed(4)} then closed back below (bearish reversal signal)` : 'No'}
• Sweep Low  this candle: ${sweeps.sweepLow  ? `YES — wicked $${sweeps.sweepLow.toFixed(4)}  then closed back above (bullish reversal signal)` : 'No'}

UNFILLED FAIR VALUE GAPS (FVG)
${fvgs.length === 0 ? '• None active' : fvgs.map(f => `• ${f.type === 'bull' ? 'Bullish' : 'Bearish'} FVG: $${f.bottom.toFixed(4)} – $${f.top.toFixed(4)} (age ${f.age} candles)`).join('\n')}

ACTIVE ORDER BLOCKS
${obs.length === 0 ? '• None detected' : obs.map(o => `• ${o.type === 'bull' ? 'Bullish' : 'Bearish'} OB: $${o.bottom.toFixed(4)} – $${o.top.toFixed(4)}`).join('\n')}

PRICE ACTION — Last 5 Candles (oldest → newest)
${last5.join('\n')}
═══════════════════════════════════════════════════════════`;
}

// ─────────────────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────────────────
const DEFAULT_SYSTEM = `You are CryptoMentor AI — an elite crypto trading analyst with LIVE Binance data access. Use the supplied LIVE DATA block as the single source of truth. Never invent numbers. Provide structured analysis: Market Structure (SMC/ICT) → Liquidity → OB/FVG → Price Action → Technicals → Confluence Bias → Trade Plan (entry, SL, TPs, R:R) → Bull/Bear scenarios. End with: *Educational only — not financial advice.*`;

async function loadSystemPrompt(): Promise<string> {
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const sb = createClient(url, key);
    const { data } = await sb.from('ai_prompts').select('system_prompt').eq('key', 'trading_chat_ai').maybeSingle();
    return (data?.system_prompt as string) || DEFAULT_SYSTEM;
  } catch { return DEFAULT_SYSTEM; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();

    const { symbol, timeframe, market } = parseRequest(messages);
    let liveData = '';

    if (symbol && timeframe) {
      console.log(`[trading-chat] Analyzing ${symbol} ${timeframe} ${market}`);
      const ctx = await buildAnalysisContext(symbol, timeframe, market);
      if (ctx) liveData = `\n\n${ctx}\n`;
      else liveData = `\n\n[NOTE: Could not fetch ${symbol} ${timeframe} ${market} data. Symbol may not exist on Binance ${market}.]\n`;
    } else if (symbol && !timeframe) {
      // Symbol only — give multi-tf snapshot on common TFs
      const tfs = ['15m', '1h', '4h', '1d'];
      const ctxs = await Promise.all(tfs.map(t => buildAnalysisContext(symbol, t, market)));
      const valid = ctxs.filter(Boolean);
      if (valid.length) liveData = `\n\n${valid.join('\n\n')}\n`;
    }

    const systemPrompt = await loadSystemPrompt();
    const finalSystem = systemPrompt + liveData + (liveData
      ? `\n\nIMPORTANT: All numbers above are FRESHLY computed from 500 live candles. Quote them exactly. Do not estimate.`
      : '');

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
