import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ScanResult, Timeframe } from '@/types/scanner';
import { TrendingUp, TrendingDown, Clock, Activity, BarChart3, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TradingViewModal } from './TradingViewModal';
import { AIAnalysisPanel } from './AIAnalysisPanel';

interface ResultCardProps {
  result: ScanResult;
  timeframe: Timeframe;
  isFavorite?: boolean;
  onToggleFavorite?: (symbol: string) => void;
}

export function ResultCard({ result, timeframe, isFavorite, onToggleFavorite }: ResultCardProps) {
  const [currentPrice, setCurrentPrice] = useState(result.price);
  const [priceFlash, setPriceFlash] = useState<'up' | 'down' | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Real-time price updates via Binance WebSocket
  useEffect(() => {
    const symbol = result.symbol.toLowerCase();
    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol}@miniTicker`);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const newPrice = parseFloat(data.c);
        if (!isNaN(newPrice)) {
          setCurrentPrice(prev => {
            if (prev !== newPrice) {
              setPriceFlash(newPrice > prev ? 'up' : 'down');
              setTimeout(() => setPriceFlash(null), 300);
            }
            return newPrice;
          });
        }
      } catch (e) {
        // ignore parse errors
      }
    };

    ws.onerror = () => {
      ws.close();
      const interval = setInterval(async () => {
        try {
          const res = await fetch(`https://data-api.binance.vision/api/v3/ticker/price?symbol=${result.symbol}`);
          const data = await res.json();
          const newPrice = parseFloat(data.price);
          if (!isNaN(newPrice)) {
            setCurrentPrice(prev => {
              if (prev !== newPrice) {
                setPriceFlash(newPrice > prev ? 'up' : 'down');
                setTimeout(() => setPriceFlash(null), 300);
              }
              return newPrice;
            });
          }
        } catch {}
      }, 5000);
      return () => clearInterval(interval);
    };

    return () => ws.close();
  }, [result.symbol]);

  const formatPrice = (price: number) => {
    if (price < 0.0001) return price.toExponential(4);
    if (price < 1) return price.toFixed(6);
    if (price < 100) return price.toFixed(4);
    return price.toFixed(2);
  };

  const formatVolume = (vol: number) => {
    if (vol >= 1e9) return `$${(vol / 1e9).toFixed(2)}B`;
    if (vol >= 1e6) return `$${(vol / 1e6).toFixed(2)}M`;
    if (vol >= 1e3) return `$${(vol / 1e3).toFixed(2)}K`;
    return `$${vol.toFixed(2)}`;
  };

  return (
    <>
      <div
        className={cn(
          'relative p-3 sm:p-4 rounded-xl border bg-card transition-all duration-300 animate-slide-up cursor-pointer',
          'hover:border-primary/50 hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.98]',
          result.isBullish ? 'card-bullish' : 'card-bearish'
        )}
        onClick={() => setIsModalOpen(true)}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-2 sm:mb-3">
          <div>
            <h3 className="font-bold text-base sm:text-lg flex items-center gap-1.5 sm:gap-2">
              {result.symbol.replace('USDT', '')}
              <span className="text-[10px] sm:text-xs text-muted-foreground font-normal">/USDT</span>
            </h3>
            <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-muted-foreground mt-0.5">
              <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              {new Date(result.timestamp).toLocaleTimeString()}
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {onToggleFavorite && (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleFavorite(result.symbol); }}
                className="p-1 rounded-lg hover:bg-muted/50 transition-all active:scale-90"
                title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Star className={cn('w-4 h-4', isFavorite ? 'text-warning fill-warning' : 'text-muted-foreground')} />
              </button>
            )}
            <div className={cn(
              'flex items-center gap-1 px-2 py-0.5 sm:py-1 rounded-lg text-[10px] sm:text-xs font-semibold',
              result.priceChange24h >= 0 
                ? 'bg-bullish/10 text-bullish' 
                : 'bg-bearish/10 text-bearish'
            )}>
              {result.priceChange24h >= 0 ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {result.priceChange24h >= 0 ? '+' : ''}{result.priceChange24h.toFixed(2)}%
            </div>
          </div>
        </div>

        {/* Live Price */}
        <div className="mb-3 sm:mb-4">
          <div className="flex items-baseline gap-2">
            <span
              className={cn(
                'font-mono text-xl sm:text-2xl font-bold transition-colors duration-300',
                priceFlash === 'up' && 'text-bullish',
                priceFlash === 'down' && 'text-bearish',
                !priceFlash && 'text-foreground'
              )}
            >
              ${formatPrice(currentPrice)}
            </span>
            <span className="flex items-center gap-1 text-[10px] sm:text-xs">
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-bullish animate-pulse-glow" />
              <span className="text-muted-foreground">LIVE</span>
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-[10px] sm:text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Activity className="w-3 h-3" />
              Vol: {formatVolume(result.volume24h)}
            </span>
          </div>
        </div>

        {/* Match Reasons */}
        <div className="space-y-1.5 sm:space-y-2 mb-3 sm:mb-4">
          <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Match Reasons
          </p>
          <div className="flex flex-wrap gap-1">
            {result.matchReasons.map((reason, idx) => (
              <span
                key={idx}
                className={cn(
                  'px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md text-[10px] sm:text-xs font-medium',
                  result.isBullish 
                    ? 'bg-bullish/10 text-bullish border border-bullish/20' 
                    : 'bg-bearish/10 text-bearish border border-bearish/20'
                )}
              >
                {reason}
              </span>
            ))}
          </div>
        </div>

        {/* Indicator Values Preview */}
        {Object.keys(result.indicatorValues).length > 0 && (
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2 mb-3 sm:mb-4 p-2 rounded-lg bg-muted/30">
            {Object.entries(result.indicatorValues).slice(0, 6).map(([key, value]) => (
              <div key={key} className="text-center">
                <p className="text-[8px] sm:text-[10px] text-muted-foreground uppercase">{key.replace('_', ' ')}</p>
                <p className="font-mono text-[10px] sm:text-xs font-medium">
                  {typeof value === 'number' ? value.toFixed(2) : String(value)}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="space-y-1.5 sm:space-y-2" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="outline"
            size="sm"
            className="w-full h-8 sm:h-9 text-xs sm:text-sm"
            onClick={() => setIsModalOpen(true)}
          >
            <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
            View Chart
          </Button>
          <AIAnalysisPanel result={result} timeframe={timeframe} />
        </div>
      </div>

      <TradingViewModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        symbol={result.symbol}
        timeframe={timeframe}
      />
    </>
  );
}
