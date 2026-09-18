import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { fetchTicker24h } from '@/lib/binance';
import { TickerData } from '@/types/scanner';
import { Loader2, RefreshCw, Radio } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAllTickersStream } from '@/hooks/useTickerStream';

interface FundingItem {
  symbol: string;
  fundingRate: number;
  markPrice: number;
}

function tileColor(pct: number) {
  if (pct >= 8) return 'bg-bullish/90 text-white';
  if (pct >= 4) return 'bg-bullish/70 text-white';
  if (pct >= 1.5) return 'bg-bullish/40 text-bullish';
  if (pct >= 0) return 'bg-bullish/15 text-bullish';
  if (pct > -1.5) return 'bg-bearish/15 text-bearish';
  if (pct > -4) return 'bg-bearish/40 text-bearish';
  if (pct > -8) return 'bg-bearish/70 text-white';
  return 'bg-bearish/90 text-white';
}

function fundingColor(f: number) {
  const p = f * 100; // to %
  if (p >= 0.1) return 'bg-bearish/80 text-white';     // extreme long crowding
  if (p >= 0.03) return 'bg-bearish/40 text-bearish';
  if (p >= 0.005) return 'bg-bearish/15 text-bearish';
  if (p > -0.005) return 'bg-muted text-muted-foreground';
  if (p > -0.03) return 'bg-bullish/15 text-bullish';
  if (p > -0.1) return 'bg-bullish/40 text-bullish';
  return 'bg-bullish/80 text-white';                    // extreme short crowding
}

export default function MarketHeatmap() {
  const navigate = useNavigate();
  const [tickers, setTickers] = useState<TickerData[]>([]);
  const [funding, setFunding] = useState<FundingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'market' | 'funding'>('market');
  const [count, setCount] = useState(60);
  const { tickers: liveMap, connected, updatedAt } = useAllTickersStream();

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    const [tk, fd] = await Promise.allSettled([
      fetchTicker24h(),
      fetch('https://fapi.binance.com/fapi/v1/premiumIndex').then(r => r.json()),
    ]);
    if (tk.status === 'fulfilled') setTickers(tk.value);
    if (fd.status === 'fulfilled' && Array.isArray(fd.value)) {
      setFunding(fd.value
        .filter((f: { symbol: string; lastFundingRate: string }) => f.symbol.endsWith('USDT'))
        .map((f: { symbol: string; lastFundingRate: string; markPrice: string }) => ({
          symbol: f.symbol,
          fundingRate: parseFloat(f.lastFundingRate),
          markPrice: parseFloat(f.markPrice),
        })));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load(true);
    // Funding/OI style data refreshes every 30s; prices come from the live stream.
    const t = setInterval(() => load(false), 30000);
    return () => clearInterval(t);
  }, [load]);

  const merged = useMemo(() => {
    const base = new Map<string, TickerData>(tickers.map(t => [t.symbol, t]));
    liveMap.forEach((v, k) => base.set(k, v));
    return Array.from(base.values());
  }, [tickers, liveMap]);

  const marketTiles = useMemo(() => {
    return merged
      .filter(t => t.symbol.endsWith('USDT') && parseFloat(t.quoteVolume) > 1e6)
      .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
      .slice(0, count);
  }, [merged, count]);

  const fundingTiles = useMemo(() => {
    const volMap = new Map(merged.map(t => [t.symbol, parseFloat(t.quoteVolume)]));
    return funding
      .filter(f => (volMap.get(f.symbol) ?? 0) > 1e6)
      .sort((a, b) => (volMap.get(b.symbol) ?? 0) - (volMap.get(a.symbol) ?? 0))
      .slice(0, count);
  }, [funding, merged, count]);

  const maxVol = useMemo(() => {
    const list = tab === 'market' ? marketTiles.map(t => parseFloat(t.quoteVolume)) : [];
    return Math.max(...list, 1);
  }, [marketTiles, tab]);

  return (
    <AppLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">Market Heatmap</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Volume-weighted market tiles + funding rate crowding. Click any coin for full details.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn('flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-semibold',
              connected ? 'border-bullish/40 bg-bullish/10 text-bullish' : 'border-border bg-muted text-muted-foreground')}>
              <Radio className={cn('w-3 h-3', connected && 'animate-pulse')} />
              {connected ? 'Live' : 'Connecting'}
              {updatedAt && <span className="font-mono font-normal">{new Date(updatedAt).toLocaleTimeString()}</span>}
            </span>
            <Button variant="outline" size="sm" onClick={() => load()} disabled={loading} className="gap-1.5">
              <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} /> Refresh
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border overflow-hidden">
            <button
              onClick={() => setTab('market')}
              className={cn('px-3 py-1.5 text-xs font-semibold transition-colors', tab === 'market' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground')}
            >
              Market (24h)
            </button>
            <button
              onClick={() => setTab('funding')}
              className={cn('px-3 py-1.5 text-xs font-semibold transition-colors', tab === 'funding' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground')}
            >
              Funding Rates
            </button>
          </div>
          <div className="flex rounded-lg border overflow-hidden">
            {[30, 60, 100].map(n => (
              <button
                key={n}
                onClick={() => setCount(n)}
                className={cn('px-3 py-1.5 text-xs font-semibold transition-colors', count === n ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground')}
              >
                Top {n}
              </button>
            ))}
          </div>
        </div>

        {tab === 'funding' && (
          <p className="text-[11px] text-muted-foreground">
            Red = crowded longs (positive funding, longs pay shorts — squeeze risk). Green = crowded shorts (negative funding — short squeeze fuel).
          </p>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading heatmap...
          </div>
        ) : tab === 'market' ? (
          <div className="flex flex-wrap gap-1">
            {marketTiles.map(t => {
              const pct = parseFloat(t.priceChangePercent);
              const vol = parseFloat(t.quoteVolume);
              const size = 0.5 + 0.5 * Math.sqrt(vol / maxVol);
              return (
                <button
                  key={t.symbol}
                  onClick={() => navigate(`/coin/${t.symbol}`)}
                  className={cn('rounded-md flex flex-col items-center justify-center transition-transform hover:scale-[1.03] hover:z-10', tileColor(pct))}
                  style={{
                    width: `calc(${(size * 16).toFixed(2)}% + ${(size * 60).toFixed(0)}px)`,
                    minWidth: 72,
                    height: 48 + size * 44,
                  }}
                  title={`${t.symbol} ${pct.toFixed(2)}% · Vol $${(vol / 1e6).toFixed(1)}M`}
                >
                  <span className="font-bold leading-tight" style={{ fontSize: 9 + size * 6 }}>{t.symbol.replace('USDT', '')}</span>
                  <span className="font-mono leading-tight" style={{ fontSize: 8 + size * 4 }}>{pct >= 0 ? '+' : ''}{pct.toFixed(1)}%</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1">
            {fundingTiles.map(f => {
              const p = f.fundingRate * 100;
              return (
                <button
                  key={f.symbol}
                  onClick={() => navigate(`/coin/${f.symbol}`)}
                  className={cn('rounded-md flex flex-col items-center justify-center transition-transform hover:scale-[1.03] hover:z-10', fundingColor(f.fundingRate))}
                  style={{ width: 'calc(12.5% - 4px)', minWidth: 76, height: 64 }}
                  title={`${f.symbol} funding ${p.toFixed(4)}%`}
                >
                  <span className="text-xs font-bold leading-tight">{f.symbol.replace('USDT', '')}</span>
                  <span className="text-[10px] font-mono leading-tight">{p >= 0 ? '+' : ''}{p.toFixed(3)}%</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
