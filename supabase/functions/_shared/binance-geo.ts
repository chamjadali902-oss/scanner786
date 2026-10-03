// Side-effect module: patches global fetch so Binance calls survive the
// HTTP 451 "restricted location" block on server regions.
// Spot -> data-api.binance.vision mirror first. Futures -> real fapi first,
// then spot mirror (klines/tickers) or OKX perpetual data reshaped to Binance format.

const origFetch: typeof fetch = globalThis.fetch.bind(globalThis);
const MIRROR = "https://data-api.binance.vision";
const OKX = "https://www.okx.com/api/v5";

const json = (data: unknown) =>
  new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json" } });

async function okx(path: string): Promise<any[] | null> {
  try {
    const r = await origFetch(`${OKX}${path}`);
    if (!r.ok) return null;
    const j = await r.json();
    return Array.isArray(j?.data) && j.data.length ? j.data : null;
  } catch { return null; }
}

function okxPeriod(p: string | null) {
  if (!p) return "1H";
  if (/m$/.test(p)) return "5m";
  if (/d$|w$/i.test(p)) return "1D";
  return "1H";
}

async function futuresFallback(u: URL): Promise<Response | null> {
  const q = u.searchParams;
  const symbol = (q.get("symbol") || "").toUpperCase();
  const base = symbol.replace(/USDT$|USDC$/, "");
  const inst = `${base}-USDT-SWAP`;
  const limit = Number(q.get("limit") || 30);
  const period = okxPeriod(q.get("period"));
  const p = u.pathname;

  if (/\/fapi\/v1\/(klines|ticker\/24hr|ticker\/price|aggTrades|depth|trades)$/.test(p)) {
    const r = await origFetch(`${MIRROR}/api/v3/${p.split("/fapi/v1/")[1]}${u.search}`).catch(() => null);
    return r && r.ok ? r : null;
  }
  if (p.endsWith("/premiumIndex")) {
    const [t, f] = await Promise.all([okx(`/market/ticker?instId=${inst}`), okx(`/public/funding-rate?instId=${inst}`)]);
    if (!t) return null;
    return json({
      symbol, markPrice: t[0].last, indexPrice: t[0].last,
      lastFundingRate: f?.[0]?.fundingRate ?? "0",
      nextFundingTime: Number(f?.[0]?.fundingTime ?? Date.now()),
      time: Date.now(), source: "okx",
    });
  }
  if (p.endsWith("/fundingRate")) {
    const h = await okx(`/public/funding-rate-history?instId=${inst}&limit=${Math.min(limit, 100)}`);
    if (!h) return null;
    return json(h.reverse().map((x: any) => ({ symbol, fundingRate: x.fundingRate, fundingTime: Number(x.fundingTime), markPrice: "0" })));
  }
  if (p.endsWith("/fapi/v1/openInterest")) {
    const o = await okx(`/public/open-interest?instType=SWAP&instId=${inst}`);
    if (!o) return null;
    return json({ symbol, openInterest: o[0].oiCcy, time: Number(o[0].ts) });
  }
  if (p.endsWith("/openInterestHist")) {
    const [d, t] = await Promise.all([okx(`/rubik/stat/contracts/open-interest-volume?ccy=${base}&period=${period}`), okx(`/market/ticker?instId=${inst}`)]);
    if (!d) return null;
    const px = Number(t?.[0]?.last) || 1;
    return json(d.slice(0, limit).reverse().map((r: any[]) => ({
      symbol, sumOpenInterest: String(Number(r[1]) / px), sumOpenInterestValue: r[1], timestamp: Number(r[0]),
    })));
  }
  if (/LongShort(Account|Position)Ratio$/.test(p)) {
    const d = await okx(`/rubik/stat/contracts/long-short-account-ratio?ccy=${base}&period=${period}`);
    if (!d) return null;
    return json(d.slice(0, limit).reverse().map((r: any[]) => {
      const ratio = Number(r[1]);
      return { symbol, longShortRatio: r[1], longAccount: String(ratio / (1 + ratio)), shortAccount: String(1 / (1 + ratio)), timestamp: Number(r[0]) };
    }));
  }
  if (p.endsWith("/takerlongshortRatio")) {
    const d = await okx(`/rubik/stat/taker-volume?ccy=${base}&instType=CONTRACTS&period=${period}`);
    if (!d) return null;
    return json(d.slice(0, limit).reverse().map((r: any[]) => ({
      buySellRatio: String(Number(r[1]) ? Number(r[2]) / Number(r[1]) : 1), sellVol: r[1], buyVol: r[2], timestamp: Number(r[0]),
    })));
  }
  return null;
}

async function patchedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  let u: URL;
  try { u = new URL(raw); } catch { return origFetch(input, init); }

  if (/^api\d?\.binance\.com$/.test(u.hostname) && u.pathname.startsWith("/api/v3")) {
    try {
      const r = await origFetch(`${MIRROR}${u.pathname}${u.search}`, init);
      if (r.ok || r.status === 400) return r;
    } catch { /* fall through */ }
    return origFetch(input, init);
  }

  if (u.hostname === "fapi.binance.com") {
    try {
      const r = await origFetch(input, init);
      if (r.ok || r.status === 400) return r;
    } catch { /* blocked */ }
    const fb = await futuresFallback(u).catch(() => null);
    if (fb) return fb;
    return new Response(JSON.stringify({ msg: "futures data unavailable" }), { status: 451 });
  }

  return origFetch(input, init);
}

if (!(globalThis as any).__binanceGeoPatched) {
  (globalThis as any).__binanceGeoPatched = true;
  globalThis.fetch = patchedFetch as typeof fetch;
}

export {};
