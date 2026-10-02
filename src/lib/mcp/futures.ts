// Futures positioning data. Binance futures is geo-blocked (451) in some server
// regions, so OKX public perpetual-swap data is used as a fallback source.

async function getJson(url: string): Promise<any | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const pct = (a: number | null, b: number | null) => (a && b ? ((b - a) / a) * 100 : null);

async function fromBinance(symbol: string) {
  const F = "https://fapi.binance.com";
  const [prem, oiH, ls, taker] = await Promise.all([
    getJson(`${F}/fapi/v1/premiumIndex?symbol=${symbol}`),
    getJson(`${F}/futures/data/openInterestHist?symbol=${symbol}&period=1h&limit=25`),
    getJson(`${F}/futures/data/topLongShortAccountRatio?symbol=${symbol}&period=1h&limit=1`),
    getJson(`${F}/futures/data/takerlongshortRatio?symbol=${symbol}&period=1h&limit=4`),
  ]);
  if (!prem || !prem.markPrice) return null;
  const oi = Array.isArray(oiH) ? oiH.map((x: any) => num(x.sumOpenInterestValue)) : [];
  const last = oi[oi.length - 1] ?? null;
  return {
    source: "binance-futures",
    markPrice: num(prem.markPrice),
    indexPrice: num(prem.indexPrice),
    fundingRatePct: num(prem.lastFundingRate) !== null ? num(prem.lastFundingRate)! * 100 : null,
    nextFundingTime: prem.nextFundingTime ? new Date(prem.nextFundingTime).toISOString() : null,
    openInterestUsd: last,
    oiChange1hPct: pct(oi[oi.length - 2] ?? null, last),
    oiChange4hPct: pct(oi[oi.length - 5] ?? null, last),
    oiChange24hPct: pct(oi[0] ?? null, last),
    topTraderLongShortRatio: Array.isArray(ls) && ls[0] ? num(ls[0].longShortRatio) : null,
    takerBuySellRatio1h: Array.isArray(taker) && taker.length ? num(taker[taker.length - 1].buySellRatio) : null,
  };
}

async function fromOkx(symbol: string) {
  const base = symbol.replace(/USDT$|USDC$/, "");
  const inst = `${base}-USDT-SWAP`;
  const O = "https://www.okx.com/api/v5";
  const [tick, fund, oiH, ls, taker] = await Promise.all([
    getJson(`${O}/market/ticker?instId=${inst}`),
    getJson(`${O}/public/funding-rate?instId=${inst}`),
    getJson(`${O}/rubik/stat/contracts/open-interest-volume?ccy=${base}&period=1H`),
    getJson(`${O}/rubik/stat/contracts/long-short-account-ratio?ccy=${base}&period=1H`),
    getJson(`${O}/rubik/stat/taker-volume?ccy=${base}&instType=CONTRACTS&period=1H`),
  ]);
  const t = tick?.data?.[0];
  if (!t) return null;
  // rubik data is newest-first
  const oi: (number | null)[] = Array.isArray(oiH?.data) ? oiH.data.map((r: any[]) => num(r[1])) : [];
  const now = oi[0] ?? null;
  const tk = taker?.data?.[0];
  const f = fund?.data?.[0];
  return {
    source: "okx-perpetual (Binance futures unavailable from server region)",
    markPrice: num(t.last),
    indexPrice: null,
    fundingRatePct: f ? num(f.fundingRate)! * 100 : null,
    nextFundingTime: f?.fundingTime ? new Date(Number(f.fundingTime)).toISOString() : null,
    openInterestUsd: now,
    oiChange1hPct: pct(oi[1] ?? null, now),
    oiChange4hPct: pct(oi[4] ?? null, now),
    oiChange24hPct: pct(oi[24] ?? null, now),
    topTraderLongShortRatio: ls?.data?.[0] ? num(ls.data[0][1]) : null,
    takerBuySellRatio1h: tk && num(tk[1]) ? num(tk[2])! / num(tk[1])! : null,
  };
}

export async function fetchFuturesContext(symbol: string) {
  const data = (await fromBinance(symbol)) ?? (await fromOkx(symbol));
  if (!data) throw new Error(`No futures market found for ${symbol} on Binance or OKX`);
  const signals: string[] = [];
  const fr = data.fundingRatePct ?? 0;
  const oi = data.oiChange24hPct ?? 0;
  if (fr > 0.05) signals.push("Funding extreme positive: crowded longs, squeeze-down risk");
  if (fr < -0.03) signals.push("Funding negative: crowded shorts, short-squeeze potential");
  if (oi > 10 && fr > 0.02) signals.push("OI rising with positive funding: leveraged long build-up");
  if (oi < -10) signals.push("OI dropping sharply: positions being closed or liquidated");
  if ((data.takerBuySellRatio1h ?? 1) > 1.2) signals.push("Aggressive taker buying last hour");
  if ((data.takerBuySellRatio1h ?? 1) < 0.83) signals.push("Aggressive taker selling last hour");
  return { symbol, ...data, fundingAprPct: data.fundingRatePct !== null ? data.fundingRatePct * 3 * 365 : null, signals };
}
