import { useEffect, useMemo, useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, TrendingDown, Loader2, Radio } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Timeframe } from '@/types/scanner';
import { LiquidationPanel } from '@/components/scanner/LiquidationPanel';
import { FlowStatsPanel } from '@/components/scanner/FlowStatsPanel';
import { TradingViewModal } from '@/components/scanner/TradingViewModal';
import { BarChart3 } from 'lucide-react';
import { useSymbolTickerStream } from '@/hooks/useTickerStream';

interface HistPoint { time: number; value: number }

const TIMEFRAMES: Timeframe[] = ['5m', '15m', '1h', '4h', '1d'];

export default function CoinDetail() {
  const { symbol: rawSymbol } = useParams<{ symbol: string }>();
  const symbol = (rawSymbol || 'BTCUSDT').toUpperCase();
  const navigate = useNavigate();

  const [timeframe, setTimeframe] = useState<Timeframe>('1h');
  const [direction, setDirection] = useState<'long' | 'short'>('long');
  const [isChartOpen, setIsChartOpen] = useState(false);
  const [ticker, setTicker] = useState<{ price: number; change: number; high: number; low: number; volume: number } | null>(null);
  const [oiHist, setOiHist] = useState<HistPoint[]>([]);
  const [lsHist, setLsHist] = useState<HistPoint[]>([]);
  const [fundingHist, setFundingHist] = useState<HistPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [oiUpdatedAt, setOiUpdatedAt] = useState<number | null>(null);
  const { ticker: liveTicker, connected } = useSymbolTickerStream(symbol);

  useEffect(() => {
    let cancelled = false;
    async function load(first = false) {
      if (first) setLoading(true);
      const [tk, oi, ls, fr] = await Promise.allSettled([
        fetch(`https://data-api.binance.vision/api/v3/ticker/24hr?symbol=${symbol}`).then(r => r.json()),
        fetch(`https://fapi.binance.com/futures/data/openInterestHist?symbol=${symbol}&period=1h&limit=48`).then(r => r.json()),
        fetch(`https://fapi.binance.com/futures/data/topLongShortPositionRatio?symbol=${symbol}&period=1h&limit=48`).then(r => r.json()),
        fetch(`https://fapi.binance.com/fapi/v1/fundingRate?symbol=${symbol}&limit=30`).then(r => r.json()),
      ]);
      if (cancelled) return;
      if (tk.status === 'fulfilled' && tk.value?.lastPrice) {
        setTicker({
          price: parseFloat(tk.value.lastPrice),
          change: parseFloat(tk.value.priceChangePercent),
          high: parseFloat(tk.value.highPrice),
          low: parseFloat(tk.value.lowPrice),
          volume: parseFloat(tk.value.quoteVolume),
        });
      }
      if (oi.status === 'fulfilled' && Array.isArray(oi.value)) {
        setOiHist(oi.value.map((p: { timestamp: number; sumOpenInterestValue: string }) => ({ time: p.timestamp, value: parseFloat(p.sumOpenInterestValue) })));
      }
      if (ls.status === 'fulfilled' && Array.isArray(ls.value)) {
        setLsHist(ls.value.map((p: { timestamp: number; longShortRatio: string }) => ({ time: p.timestamp, value: parseFloat(p.longShortRatio) })));
      }
      if (fr.status === 'fulfilled' && Array.isArray(fr.value)) {
        setFundingHist(fr.value.map((p: { fundingTime: number; fundingRate: string }) => ({ time: p.fundingTime, value: parseFloat(p.fundingRate) * 100 })));
      }
      setOiUpdatedAt(Date.now());
      setLoading(false);
    }
    load(true);
    // Open interest / funding / L-S ratio refresh every 60s; price comes from the live stream.
    const t = setInterval(() => load(false), 60000);
    return () => { cancelled = true; clearInterval(t); };
  }, [symbol]);

  // Live price/24h stats from the websocket stream override the REST snapshot.
  useEffect(() => {
    if (!liveTicker) return;
    setTicker({
      price: parseFloat(liveTicker.lastPrice),
      change: parseFloat(liveTicker.priceChangePercent),
      high: parseFloat(liveTicker.highPrice),
      low: parseFloat(liveTicker.lowPrice),
      volume: parseFloat(liveTicker.quoteVolume),
    });
  }, [liveTicker]);

  const fmtPrice = (p: number) => {
    if (p < 0.0001) return p.toExponential(4);
    if (p < 1) return p.toFixed(6);
    if (p < 100) return p.toFixed(4);
    return p.toFixed(2);
  };

  const MiniChart = ({ data, label, format }: { data: HistPoint[]; label: string; format: (v: number) => string }) => {
    const { points, min, max } = useMemo(() => {
      if (data.length < 2) return { points: '', min: 0, max: 0 };
      const vals = data.map(d => d.value);
      const mn = Math.min(...vals), mx = Math.max(...vals);
      const range = mx - mn || 1;
      return {
        points: data.map((d, i) => `${(i / (data.length - 1)) * 100},${40 - ((d.value - mn) / range) * 36}`).join(' '),
        min: mn, max: mx,
      };
    }, [data]);
    const last = data[data.length - 1]?.value;
    const first = data[0]?.value;
    const up = last !== undefined && first !== undefined && last >= first;
    return (
      <div className="rounded-xl border bg-card p-3">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
          {last !== undefined && (
            <p className={cn('text-xs font-mono font-semibold', up ? 'text-bullish' : 'text-bearish')}>{format(last)}</p>
          )}
        </div>
        {data.length < 2 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">No data</p>
        ) : (
          <>
            <svg viewBox="0 0 100 42" className="w-full h-16" preserveAspectRatio="none">
              <polyline points={points} fill="none" strokeWidth="1.5" className={up ? 'stroke-bullish' : 'stroke-bearish'} vectorEffect="non-scaling-stroke" />
            </svg>
            <div className="flex justify-between text-[9px] text-muted-foreground font-mono mt-0.5">
              <span>{format(min)}</span>
              <span>48h</span>
              <span>{format(max)}</span>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)} aria-label="Back">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight flex items-center gap-2">
                {symbol.replace('USDT', '')}
                <span className="text-sm text-muted-foreground font-normal">/USDT</span>
              </h1>
              {ticker && (
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-mono font-bold">${fmtPrice(ticker.price)}</span>
                  <span className={cn('flex items-center gap-1 text-xs font-mono font-semibold', ticker.change >= 0 ? 'text-bullish' : 'text-bearish')}>
                    {ticker.change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {ticker.change >= 0 ? '+' : ''}{ticker.change.toFixed(2)}%
                  </span>
                </div>
              )}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setIsChartOpen(true)} className="gap-1.5">
            <BarChart3 className="w-4 h-4" /> View Chart
          </Button>
        </div>

        {/* 24h stats */}
        {ticker && (
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="rounded-xl border bg-card p-3 text-center">
              <p className="text-[10px] uppercase text-muted-foreground">24h High</p>
              <p className="font-mono text-sm font-semibold text-bullish mt-0.5">${fmtPrice(ticker.high)}</p>
            </div>
            <div className="rounded-xl border bg-card p-3 text-center">
              <p className="text-[10px] uppercase text-muted-foreground">24h Low</p>
              <p className="font-mono text-sm font-semibold text-bearish mt-0.5">${fmtPrice(ticker.low)}</p>
            </div>
            <div className="rounded-xl border bg-card p-3 text-center">
              <p className="text-[10px] uppercase text-muted-foreground">24h Volume</p>
              <p className="font-mono text-sm font-semibold mt-0.5">${(ticker.volume / 1e6).toFixed(1)}M</p>
            </div>
          </div>
        )}

        {/* Timeframe + direction controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border overflow-hidden">
            {TIMEFRAMES.map(tf => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={cn('px-3 py-1.5 text-xs font-semibold transition-colors', timeframe === tf ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground')}
              >
                {tf}
              </button>
            ))}
          </div>
          <div className="flex rounded-lg border overflow-hidden">
            <button
              onClick={() => setDirection('long')}
              className={cn('px-3 py-1.5 text-xs font-semibold transition-colors', direction === 'long' ? 'bg-bullish text-white' : 'bg-card text-muted-foreground hover:text-foreground')}
            >
              Long view
            </button>
            <button
              onClick={() => setDirection('short')}
              className={cn('px-3 py-1.5 text-xs font-semibold transition-colors', direction === 'short' ? 'bg-bearish text-white' : 'bg-card text-muted-foreground hover:text-foreground')}
            >
              Short view
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading coin data...
          </div>
        )}

        {/* Futures history mini charts */}
        <div className="grid sm:grid-cols-3 gap-3">
          <MiniChart data={oiHist} label="Open Interest (48h)" format={v => `$${(v / 1e6).toFixed(1)}M`} />
          <MiniChart data={lsHist} label="Top Trader Long/Short Ratio" format={v => v.toFixed(2)} />
          <MiniChart data={fundingHist} label="Funding Rate History (%)" format={v => `${v >= 0 ? '+' : ''}${v.toFixed(4)}%`} />
        </div>

        {/* Liquidation & positioning */}
        <div className="rounded-xl border bg-card p-3 sm:p-4">
          <LiquidationPanel symbol={symbol} timeframe={timeframe} livePrice={ticker?.price} />
        </div>

        {/* Order flow + statistical edge */}
        <div className="rounded-xl border bg-card p-3 sm:p-4">
          <FlowStatsPanel symbol={symbol} timeframe={timeframe} direction={direction} />
        </div>
      </div>

      <TradingViewModal isOpen={isChartOpen} onClose={() => setIsChartOpen(false)} symbol={symbol} timeframe={timeframe} />
    </AppLayout>
  );
}
