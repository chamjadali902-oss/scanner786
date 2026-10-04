// Chat scanner: mirrors the app scanner conditions (RSI, MACD, EMA, Supertrend,
// Bollinger, volume, breakout + fake/real breakout, sweeps, impulse moves) and
// enriches matches with futures funding + OI delta. Returns a LIVE DATA block.

const SPOT = "https://api.binance.com/api/v3";
const FUT = "https://fapi.binance.com";

type C = { o: number; h: number; l: number; c: number; v: number };

function emaArr(v: number[], p: number): number[] {
  const out: number[] = new Array(v.length).fill(NaN);
  if (v.length < p) return out;
  const k = 2 / (p + 1);
  let a = v.slice(0, p).reduce((x, y) => x + y, 0) / p;
  out[p - 1] = a;
  for (let i = p; i < v.length; i++) { a = v[i] * k + a * (1 - k); out[i] = a; }
  return out;
}
function rsiArr(v: number[], p = 14): number[] {
  const out: number[] = new Array(v.length).fill(NaN);
  if (v.length < p + 1) return out;
  let g = 0, l = 0;
  for (let i = 1; i <= p; i++) { const d = v[i] - v[i - 1]; if (d >= 0) g += d; else l -= d; }
  g /= p; l /= p; out[p] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
  for (let i = p + 1; i < v.length; i++) {
    const d = v[i] - v[i - 1];
    g = (g * (p - 1) + Math.max(d, 0)) / p; l = (l * (p - 1) + Math.max(-d, 0)) / p;
    out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
  }
  return out;
}
function atrArr(cs: C[], p = 14): number[] {
  const tr = cs.map((x, i) => i === 0 ? x.h - x.l : Math.max(x.h - x.l, Math.abs(x.h - cs[i - 1].c), Math.abs(x.l - cs[i - 1].c)));
  const out: number[] = new Array(cs.length).fill(NaN);
  if (cs.length <= p) return out;
  let a = tr.slice(1, p + 1).reduce((x, y) => x + y, 0) / p; out[p] = a;
  for (let i = p + 1; i < cs.length; i++) { a = (a * (p - 1) + tr[i]) / p; out[i] = a; }
  return out;
}
function supertrendDir(cs: C[], p = 10, m = 3): number[] {
  const atr = atrArr(cs, p);
  const dir: number[] = new Array(cs.length).fill(1);
  let up = 0, dn = 0;
  for (let i = 0; i < cs.length; i++) {
    if (isNaN(atr[i])) continue;
    const hl2 = (cs[i].h + cs[i].l) / 2;
    const bu = hl2 - m * atr[i], bd = hl2 + m * atr[i];
    const pc = cs[i - 1]?.c ?? cs[i].c;
    up = up && pc > up ? Math.max(bu, up) : bu;
    dn = dn && pc < dn ? Math.min(bd, dn) : bd;
    const pd = dir[i - 1] ?? 1;
    dir[i] = pd === -1 && cs[i].c > dn ? 1 : pd === 1 && cs[i].c < up ? -1 : pd;
  }
  return dir;
}

export type ScanRow = { s: string; price: number; chg: number; rsi: number; vr: number; tags: string[]; notes: string[]; funding?: number | null; oi24h?: number | null; oi1h?: number | null };

function analyse(cs: C[]) {
  const n = cs.length, last = cs[n - 1];
  const c = cs.map(x => x.c), v = cs.map(x => x.v);
  const r = rsiArr(c), e9 = emaArr(c, 9), e20 = emaArr(c, 20), e21 = emaArr(c, 21), e50 = emaArr(c, 50), e200 = emaArr(c, 200);
  const m12 = emaArr(c, 12), m26 = emaArr(c, 26);
  const macd = c.map((_, i) => m12[i] - m26[i]);
  const sig = emaArr(macd.map(x => isNaN(x) ? 0 : x), 9);
  const st = supertrendDir(cs);
  const tags: string[] = [], notes: string[] = [];
  const R = r[n - 1], Rp = r[n - 2];
  if (R < 30) tags.push("rsi_oversold");
  if (R > 70) tags.push("rsi_overbought");
  if (Rp < 30 && R >= 30) tags.push("rsi_bounce");
  if (Rp > 70 && R <= 70) tags.push("rsi_rejection");
  // RSI divergence (last 30 bars, two lows/highs)
  const w = 30;
  const lowIdx = cs.slice(-w).reduce((b, x, i, a) => x.l < a[b].l ? i : b, 0) + n - w;
  if (lowIdx < n - 3 && last.l <= cs[lowIdx].l * 1.005 && R > r[lowIdx] + 3) tags.push("bullish_divergence");
  const hiIdx = cs.slice(-w).reduce((b, x, i, a) => x.h > a[b].h ? i : b, 0) + n - w;
  if (hiIdx < n - 3 && last.h >= cs[hiIdx].h * 0.995 && R < r[hiIdx] - 3) tags.push("bearish_divergence");
  // MACD
  if (macd[n - 2] <= sig[n - 2] && macd[n - 1] > sig[n - 1]) tags.push("macd_bull_cross");
  if (macd[n - 2] >= sig[n - 2] && macd[n - 1] < sig[n - 1]) tags.push("macd_bear_cross");
  // EMA
  if (e9[n - 2] <= e21[n - 2] && e9[n - 1] > e21[n - 1]) tags.push("ema_9_21_bull_cross");
  if (e9[n - 2] >= e21[n - 2] && e9[n - 1] < e21[n - 1]) tags.push("ema_9_21_bear_cross");
  if (e50[n - 2] <= e200[n - 2] && e50[n - 1] > e200[n - 1]) tags.push("golden_cross");
  if (e50[n - 2] >= e200[n - 2] && e50[n - 1] < e200[n - 1]) tags.push("death_cross");
  if (last.c > e20[n - 1] && e20[n - 1] > e50[n - 1]) tags.push("uptrend");
  if (last.c < e20[n - 1] && e20[n - 1] < e50[n - 1]) tags.push("downtrend");
  if (last.c > e200[n - 1]) tags.push("above_ema200"); else if (!isNaN(e200[n - 1])) tags.push("below_ema200");
  // Supertrend
  if (st[n - 2] === -1 && st[n - 1] === 1) tags.push("supertrend_flip_bull");
  if (st[n - 2] === 1 && st[n - 1] === -1) tags.push("supertrend_flip_bear");
  // Bollinger squeeze
  const bw = (i: number) => { const s = c.slice(i - 19, i + 1); const m = s.reduce((a, b) => a + b, 0) / 20; const sd = Math.sqrt(s.reduce((a, b) => a + (b - m) ** 2, 0) / 20); return (4 * sd) / m; };
  const bws = Array.from({ length: 100 }, (_, k) => bw(n - 1 - k)).filter(x => !isNaN(x));
  if (bws.length > 50 && bws[0] <= Math.min(...bws) * 1.1) tags.push("bb_squeeze");
  // Volume
  const avgV = v.slice(-21, -1).reduce((a, b) => a + b, 0) / 20;
  const vr = avgV ? last.v / avgV : 0;
  if (vr >= 2) tags.push("volume_spike");
  // Breakout family (20-bar range, checked on last 3 bars)
  const look = 20;
  for (let age = 0; age < 3; age++) {
    const i = n - 1 - age;
    const prev = cs.slice(i - look, i);
    const hh = Math.max(...prev.map(x => x.h)), ll = Math.min(...prev.map(x => x.l));
    const b = cs[i];
    const bvr = avgV ? b.v / avgV : 0;
    const body = Math.abs(b.c - b.o) / Math.max(b.h - b.l, 1e-12);
    const st = age === 0 ? "live now" : `${age}c ago`;
    if (b.h > hh) {
      if (last.c < hh) { tags.push("fake_breakout"); notes.push(`fake breakout above ${hh} (${st}), now back below, reverse SHORT idea`); }
      else if (b.c > hh && bvr >= 1.5 && body >= 0.5) { tags.push("real_breakout"); notes.push(`real breakout above ${hh} (${st}), vol x${bvr.toFixed(2)}`); }
      else if (age === 0 && b.c > hh) tags.push("breakout_up");
    }
    if (b.l < ll) {
      if (last.c > ll) { tags.push("fake_breakdown"); notes.push(`fake breakdown below ${ll} (${st}), now reclaimed, reverse LONG idea`); }
      else if (b.c < ll && bvr >= 1.5 && body >= 0.5) { tags.push("real_breakdown"); notes.push(`real breakdown below ${ll} (${st}), vol x${bvr.toFixed(2)}`); }
      else if (age === 0 && b.c < ll) tags.push("breakdown");
    }
  }
  // Sweeps (Spring / Upthrust) on last candle
  const p20 = cs.slice(-21, -1);
  const hh = Math.max(...p20.map(x => x.h)), ll = Math.min(...p20.map(x => x.l));
  if (last.l < ll && last.c > ll) tags.push("spring_sweep_reclaim");
  if (last.h > hh && last.c < hh) tags.push("upthrust_sweep_reject");
  // Impulse: opposite base candle then 2+ same-direction candles closing beyond base, no retest
  for (let base = n - 8; base <= n - 3; base++) {
    const bc = cs[base];
    const after = cs.slice(base + 1);
    if (bc.c < bc.o && after.length >= 2 && after.slice(0, 2).every(x => x.c > x.o && x.c > bc.h) && after.every(x => x.l > bc.h)) { tags.push("impulse_bullish"); notes.push(`bullish impulse from base ${bc.l}-${bc.h}, untested`); break; }
    if (bc.c > bc.o && after.length >= 2 && after.slice(0, 2).every(x => x.c < x.o && x.c < bc.l) && after.every(x => x.h < bc.l)) { tags.push("impulse_bearish"); notes.push(`bearish impulse from base ${bc.l}-${bc.h}, untested`); break; }
  }
  return { price: last.c, rsi: R, vr, tags: [...new Set(tags)], notes };
}

const KEYWORDS: [RegExp, string][] = [
  [/oversold/, "rsi_oversold"], [/overbought/, "rsi_overbought"], [/rsi bounce/, "rsi_bounce"],
  [/bullish div/, "bullish_divergence"], [/bearish div/, "bearish_divergence"],
  [/macd.*(bull|up|above)|bullish macd/, "macd_bull_cross"], [/macd.*(bear|down|below)|bearish macd/, "macd_bear_cross"],
  [/golden cross/, "golden_cross"], [/death cross/, "death_cross"],
  [/ema.*(bull|cross up)/, "ema_9_21_bull_cross"], [/ema.*(bear|cross down)/, "ema_9_21_bear_cross"],
  [/supertrend.*(bull|buy|green)/, "supertrend_flip_bull"], [/supertrend.*(bear|sell|red)/, "supertrend_flip_bear"],
  [/squeeze|bollinger/, "bb_squeeze"], [/volume/, "volume_spike"],
  [/fake breakout|upside trap/, "fake_breakout"], [/fake breakdown|downside trap/, "fake_breakdown"],
  [/real breakout|valid breakout/, "real_breakout"], [/real breakdown|valid breakdown/, "real_breakdown"],
  [/spring|sweep.*reclaim|bullish sweep/, "spring_sweep_reclaim"], [/upthrust|bearish sweep/, "upthrust_sweep_reject"],
  [/impulse.*(bear|sell|short)/, "impulse_bearish"], [/impulse|implcive|impulsive/, "impulse_bullish"],
  [/uptrend/, "uptrend"], [/downtrend/, "downtrend"], [/above ema ?200/, "above_ema200"], [/below ema ?200/, "below_ema200"],
];

function parseWant(t: string) {
  const want: string[] = [];
  for (const [re, tag] of KEYWORDS) {
    if (re.test(t) && !want.includes(tag)) {
      if (tag === "impulse_bullish" && want.includes("impulse_bearish")) continue;
      if (tag === "volume_spike" && !/volume/.test(t)) continue;
      want.push(tag);
    }
  }
  if (/\bbreakout\b/.test(t) && !want.some(w => w.includes("breakout"))) want.push("breakout_up");
  if (/\bbreakdown\b/.test(t) && !want.some(w => w.includes("breakdown"))) want.push("breakdown");
  const futures = {
    negFunding: /(negative|low) funding|shorts? crowded|crowded shorts?/.test(t),
    posFunding: /(positive|high) funding|longs? crowded|crowded longs?/.test(t),
    oiUp: /oi (up|rising|increase|barh)|open interest (up|rising|increase)|rising oi/.test(t),
    oiDown: /oi (down|falling|drop)|open interest (down|falling|drop)|falling oi/.test(t),
  };
  const topMatch = t.match(/top\s*(\d{2,3})/);
  const topN = Math.min(Math.max(topMatch ? +topMatch[1] : 100, 20), 150);
  return { want, futures, topN };
}

async function futCtx(sym: string) {
  try {
    const [p, h] = await Promise.all([
      fetch(`${FUT}/fapi/v1/premiumIndex?symbol=${sym}`).then(r => r.ok ? r.json() : null),
      fetch(`${FUT}/futures/data/openInterestHist?symbol=${sym}&period=1h&limit=25`).then(r => r.ok ? r.json() : null),
    ]);
    const funding = p?.lastFundingRate != null ? +p.lastFundingRate * 100 : null;
    let oi1h: number | null = null, oi24h: number | null = null;
    if (Array.isArray(h) && h.length >= 2) {
      const val = (x: any) => +x.sumOpenInterestValue || +x.sumOpenInterest;
      const L = val(h[h.length - 1]);
      oi1h = ((L - val(h[h.length - 2])) / val(h[h.length - 2])) * 100;
      oi24h = ((L - val(h[0])) / val(h[0])) * 100;
    }
    return { funding, oi1h, oi24h };
  } catch { return { funding: null, oi1h: null, oi24h: null }; }
}

export async function runChatScan(tf: string, text: string): Promise<string> {
  const t = text.toLowerCase();
  const { want, futures, topN } = parseWant(t);
  const needFut = Object.values(futures).some(Boolean);
  try {
    const r = await fetch(`${SPOT}/ticker/24hr`);
    if (!r.ok) throw new Error(`tickers ${r.status}`);
    const all: any[] = await r.json();
    const pool = all.filter(x => x.symbol.endsWith("USDT") && !/(UP|DOWN|BULL|BEAR)USDT$|^(USDC|FDUSD|TUSD|BUSD|DAI|EUR|USDP|AEUR)USDT$/.test(x.symbol) && +x.quoteVolume > 0)
      .sort((a, b) => +b.quoteVolume - +a.quoteVolume).slice(0, topN);
    let rows: ScanRow[] = [];
    for (let i = 0; i < pool.length; i += 25) {
      const batch = await Promise.all(pool.slice(i, i + 25).map(async (tk) => {
        try {
          const kr = await fetch(`${SPOT}/klines?symbol=${tk.symbol}&interval=${tf}&limit=500`);
          if (!kr.ok) return null;
          const k: any[] = await kr.json();
          if (k.length < 120) return null;
          const cs: C[] = k.map(x => ({ o: +x[1], h: +x[2], l: +x[3], c: +x[4], v: +x[5] }));
          const a = analyse(cs);
          if (!want.every(w => a.tags.includes(w))) return null;
          return { s: tk.symbol, chg: +tk.priceChangePercent, ...a } as ScanRow;
        } catch { return null; }
      }));
      rows.push(...(batch.filter(Boolean) as ScanRow[]));
    }
    rows.sort((a, b) => b.tags.length - a.tags.length || b.vr - a.vr);
    // futures enrichment: all candidates if futures filter requested, else top 15
    const enrich = needFut ? rows.slice(0, 40) : rows.slice(0, 15);
    await Promise.all(enrich.map(async (x) => Object.assign(x, await futCtx(x.s))));
    if (needFut) {
      rows = rows.filter(x => {
        if (futures.negFunding && !(x.funding != null && x.funding < 0)) return false;
        if (futures.posFunding && !(x.funding != null && x.funding > 0.01)) return false;
        if (futures.oiUp && !(x.oi24h != null && x.oi24h > 3)) return false;
        if (futures.oiDown && !(x.oi24h != null && x.oi24h < -3)) return false;
        return true;
      });
    }
    for (const x of rows) {
      if (x.funding == null || x.oi24h == null) continue;
      const up = x.chg > 0;
      if (up && x.oi24h > 3 && x.funding > 0.03) x.notes.push("crowded longs: price up + OI up + hot funding");
      else if (up && x.oi24h < -3) x.notes.push("short covering rally: price up, OI falling");
      else if (!up && x.oi24h > 3 && x.funding < 0) x.notes.push("crowded shorts: squeeze risk");
      else if (!up && x.oi24h < -3) x.notes.push("long flush: price down, OI falling");
      else if (up && x.oi24h > 3) x.notes.push("healthy expansion: price + OI up, funding neutral");
    }
    const f = (v: number | null | undefined, d = 2, suf = "") => v == null || isNaN(v) ? "n/a" : `${v.toFixed(d)}${suf}`;
    const lines = rows.slice(0, 20).map(x =>
      `${x.s} | price ${x.price} | 24h ${x.chg.toFixed(2)}% | RSI ${f(x.rsi, 1)} | vol x${x.vr.toFixed(2)} | funding ${f(x.funding, 4, "%")} | OI 1h ${f(x.oi1h, 2, "%")} 24h ${f(x.oi24h, 2, "%")} | tags: ${x.tags.join(", ") || "none"}${x.notes.length ? ` | notes: ${x.notes.join("; ")}` : ""}`);
    const filt = [...want, ...Object.entries(futures).filter(([, v]) => v).map(([k]) => k)];
    return `LIVE SCANNER RESULTS (app scanner engine, ${new Date().toISOString()}, timeframe ${tf}, top ${pool.length} USDT pairs by 24h volume, 500 candles each, filters: ${filt.join(" + ") || "none, ranked by signal count"}). Matched ${rows.length}.
Available scanner conditions the user can ask for: RSI oversold/overbought/bounce/rejection, bullish/bearish RSI divergence, MACD bull/bear cross, EMA 9/21 cross, golden/death cross, uptrend/downtrend, above/below EMA200, Supertrend flip, Bollinger squeeze, volume spike, breakout/breakdown, fake breakout/fake breakdown (trap reversal), real breakout/real breakdown (validated), spring sweep reclaim, upthrust sweep reject, bullish/bearish impulse, negative/positive funding, OI rising/falling, "top N".
${lines.join("\n") || "No coins matched these filters right now."}
Present the results as a clean markdown table (Symbol, Price, 24h, RSI, Vol x, Funding, OI 24h, Key signals). Then rank the best 3 setups with direction, trigger, and invalidation derived only from these numbers. Do not invent coins or values outside this list.`;
  } catch (e) {
    return `[SCANNER NOTE: live scan failed (${(e as Error).message}). Tell the user the scan could not run; do not invent results.]`;
  }
}
