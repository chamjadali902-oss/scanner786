import { cn } from '@/lib/utils';
import { useMarketRegime } from '@/hooks/useMarketRegime';
import { Activity, Gauge, Loader2, ShieldAlert } from 'lucide-react';
import type { MarketRegime } from '@/lib/market-regime';

interface Props {
  onRegime?: (r: MarketRegime) => void;
}

const regimeStyles: Record<string, string> = {
  trending_bull: 'border-bullish/40 bg-bullish/5',
  trending_bear: 'border-bearish/40 bg-bearish/5',
  ranging: 'border-primary/40 bg-primary/5',
  volatile_chop: 'border-warning/40 bg-warning/5',
};

export function RegimeBanner({ onRegime }: Props) {
  const { regime, loading } = useMarketRegime();

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-xl border border-border bg-card text-xs text-muted-foreground">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Market regime detect ho raha hai...
      </div>
    );
  }
  if (!regime) return null;
  onRegime?.(regime);

  return (
    <div className={cn('p-3 rounded-xl border', regimeStyles[regime.key] ?? 'border-border bg-card')}>
      <div className="flex items-center gap-2 flex-wrap mb-1.5">
        <Gauge className="w-4 h-4 text-primary" />
        <span className="text-xs font-bold">{regime.label}</span>
        <span className="text-[10px] font-mono text-muted-foreground">
          BTC ${regime.btcPrice.toFixed(0)} ({regime.btcChange24h >= 0 ? '+' : ''}{regime.btcChange24h.toFixed(2)}%)
        </span>
        <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
          <Activity className="w-3 h-3" /> ADX {regime.trendStrength.toFixed(0)} · Vol {regime.volatilityPercentile}%ile
        </span>
        {regime.fearGreed && (
          <span className="px-1.5 py-px rounded text-[10px] bg-muted text-muted-foreground font-medium">
            F&amp;G {regime.fearGreed.value} · {regime.fearGreed.label}
          </span>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground leading-snug">{regime.summary}</p>
      {regime.avoid.length > 0 && (
        <p className="text-[10px] text-warning mt-1 flex items-start gap-1">
          <ShieldAlert className="w-3 h-3 shrink-0 mt-px" /> Avoid: {regime.avoid.join(', ')}
        </p>
      )}
    </div>
  );
}
