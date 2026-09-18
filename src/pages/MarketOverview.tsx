import { useEffect, useMemo, useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { RegimeBanner } from '@/components/scanner/RegimeBanner';
import { fetchTicker24h } from '@/lib/binance';
import { TickerData } from '@/types/scanner';
import { TrendingUp, TrendingDown, Activity, Flame, Loader2, ArrowRight, Radio } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAllTickersStream } from '@/hooks/useTickerStream';

interface GlobalData {
  totalMcap: number;
  mcapChange24h: number;
  btcDominance: number;
  ethDominance: number;
  volume24h: number;
}

interface FearGreed {
  value: number;
  label: string;
}

function fmtBig(n: number) {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toFixed(0)}`;
}

function fgColor(v: number) {
  if (v <= 25) return 'text-bearish';
  if (v <= 45) return 'text-warning';
  if (v <= 55) return 'text-muted-foreground';
  if (v <= 75) return 'text-bullish';
  return 'text-bullish';
}

export default function MarketOverview() {
  const navigate = useNavigate();
  const [global, setGlobal] = useState<GlobalData | null>(null);
  const [fearGreed, setFearGreed] = useState<FearGreed | null>(null);
  const [tickers, setTickers] = useState<TickerData[]>([]);
  const [loading, setLoading] = useState(true);
  const { tickers: liveMap, connected, updatedAt } = useAllTickersStream();

  useEffect(() => {
    let cancelled = false;
    async function load(first = false) {
      if (first) setLoading(true);
      const [cg, fg, tk] = await Promise.allSettled([
        fetch('https://api.coingecko.com/api/v3/global').then(r => r.json()),
        fetch('https://api.alternative.me/fng/?limit=1').then(r => r.json()),
        fetchTicker24h(),
      ]);
      if (cancelled) return;
      if (cg.status === 'fulfilled' && cg.value?.data) {
        const d = cg.value.data;
        setGlobal({
          totalMcap: d.total_market_cap?.usd ?? 0,
          mcapChange24h: d.market_cap_change_percentage_24h_usd ?? 0,
          btcDominance: d.market_cap_percentage?.btc ?? 0,
          ethDominance: d.market_cap_percentage?.eth ?? 0,
          volume24h: d.total_volume?.usd ?? 0,
        });
      }
      if (fg.status === 'fulfilled' && fg.value?.data?.[0]) {
        setFearGreed({ value: parseInt(fg.value.data[0].value), label: fg.value.data[0].value_classification });
      }
      if (tk.status === 'fulfilled') setTickers(tk.value);
      setLoading(false);
    }
    load();
    const t = setInterval(load, 60000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  const usdt = tickers.filter(t => t.symbol.endsWith('USDT') && parseFloat(t.quoteVolume) > 5e6);
  const gainers = [...usdt].sort((a, b) => parseFloat(b.priceChangePercent) - parseFloat(a.priceChangePercent)).slice(0, 10);
  const losers = [...usdt].sort((a, b) => parseFloat(a.priceChangePercent) - parseFloat(b.priceChangePercent)).slice(0, 10);
  const byVolume = [...usdt].sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume)).slice(0, 10);

  const TickerRow = ({ t, rank }: { t: TickerData; rank: number }) => {
    const chg = parseFloat(t.priceChangePercent);
    return (
      <button
        onClick={() => navigate(`/coin/${t.symbol}`)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-[10px] text-muted-foreground w-5 font-mono">{rank}</span>
          <span className="font-semibold text-sm truncate">{t.symbol.replace('USDT', '')}</span>
          <span className="text-[10px] text-muted-foreground">/USDT</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="font-mono text-xs text-muted-foreground hidden sm:inline">${parseFloat(t.lastPrice).toLocaleString(undefined, { maximumFractionDigits: 6 })}</span>
          <span className={cn('font-mono text-xs font-semibold flex items-center gap-1', chg >= 0 ? 'text-bullish' : 'text-bearish')}>
            {chg >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {chg >= 0 ? '+' : ''}{chg.toFixed(2)}%
          </span>
        </div>
      </button>
    );
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">Market Overview</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Complete market intelligence in one place. No other website needed.</p>
        </div>

        {/* Global stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          <div className="rounded-xl border bg-card p-3 sm:p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Market Cap</p>
            <p className="text-lg sm:text-xl font-bold font-mono mt-1">{global ? fmtBig(global.totalMcap) : '—'}</p>
            {global && (
              <p className={cn('text-xs font-mono mt-0.5', global.mcapChange24h >= 0 ? 'text-bullish' : 'text-bearish')}>
                {global.mcapChange24h >= 0 ? '+' : ''}{global.mcapChange24h.toFixed(2)}% (24h)
              </p>
            )}
          </div>
          <div className="rounded-xl border bg-card p-3 sm:p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">24h Volume</p>
            <p className="text-lg sm:text-xl font-bold font-mono mt-1">{global ? fmtBig(global.volume24h) : '—'}</p>
          </div>
          <div className="rounded-xl border bg-card p-3 sm:p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">BTC Dominance</p>
            <p className="text-lg sm:text-xl font-bold font-mono mt-1">{global ? `${global.btcDominance.toFixed(1)}%` : '—'}</p>
            <p className="text-xs text-muted-foreground mt-0.5">ETH {global ? `${global.ethDominance.toFixed(1)}%` : '—'}</p>
          </div>
          <div className="rounded-xl border bg-card p-3 sm:p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Fear & Greed Index</p>
            <p className={cn('text-lg sm:text-xl font-bold font-mono mt-1', fearGreed ? fgColor(fearGreed.value) : '')}>
              {fearGreed ? fearGreed.value : '—'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{fearGreed?.label ?? ''}</p>
          </div>
        </div>

        {/* Market regime */}
        <RegimeBanner />

        {loading && (
          <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading market data...
          </div>
        )}

        {/* Gainers / Losers / Volume */}
        {!loading && tickers.length > 0 && (
          <div className="grid md:grid-cols-3 gap-3 sm:gap-4">
            <div className="rounded-xl border bg-card p-3">
              <div className="flex items-center gap-2 mb-2 px-1">
                <TrendingUp className="w-4 h-4 text-bullish" />
                <h2 className="text-sm font-bold">Top Gainers (24h)</h2>
              </div>
              {gainers.map((t, i) => <TickerRow key={t.symbol} t={t} rank={i + 1} />)}
            </div>
            <div className="rounded-xl border bg-card p-3">
              <div className="flex items-center gap-2 mb-2 px-1">
                <TrendingDown className="w-4 h-4 text-bearish" />
                <h2 className="text-sm font-bold">Top Losers (24h)</h2>
              </div>
              {losers.map((t, i) => <TickerRow key={t.symbol} t={t} rank={i + 1} />)}
            </div>
            <div className="rounded-xl border bg-card p-3">
              <div className="flex items-center gap-2 mb-2 px-1">
                <Flame className="w-4 h-4 text-warning" />
                <h2 className="text-sm font-bold">Highest Volume (24h)</h2>
              </div>
              {byVolume.map((t, i) => <TickerRow key={t.symbol} t={t} rank={i + 1} />)}
            </div>
          </div>
        )}

        {/* Quick links */}
        <div className="grid sm:grid-cols-2 gap-3">
          <button
            onClick={() => navigate('/heatmap')}
            className="rounded-xl border bg-card p-4 flex items-center justify-between hover:border-primary/50 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <Activity className="w-5 h-5 text-primary" />
              <div>
                <p className="font-bold text-sm">Market Heatmap</p>
                <p className="text-xs text-muted-foreground">Full market + funding rates heatmap</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
          </button>
          <button
            onClick={() => navigate('/news')}
            className="rounded-xl border bg-card p-4 flex items-center justify-between hover:border-primary/50 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <Flame className="w-5 h-5 text-primary" />
              <div>
                <p className="font-bold text-sm">News & Events</p>
                <p className="text-xs text-muted-foreground">Latest crypto news + economic calendar</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
