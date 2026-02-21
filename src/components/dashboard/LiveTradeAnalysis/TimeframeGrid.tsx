import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TFData } from './types';

interface Props {
  data: TFData[];
}

export function TimeframeGrid({ data }: Props) {
  return (
    <div className="space-y-1.5">
      <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide">Timeframe Overview</p>
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-1">
        {data.map(tf => (
          <div key={tf.tf} className={cn(
            'rounded p-1.5 border text-center',
            tf.trend === 'up' ? 'border-bullish/30 bg-bullish/5' :
            tf.trend === 'down' ? 'border-bearish/30 bg-bearish/5' :
            'border-border bg-muted/20'
          )}>
            <p className="text-[8px] font-mono font-bold text-muted-foreground">{tf.tf}</p>
            <div className="flex justify-center mt-0.5">
              {tf.trend === 'up' ? <TrendingUp className="w-2.5 h-2.5 text-bullish" /> :
               tf.trend === 'down' ? <TrendingDown className="w-2.5 h-2.5 text-bearish" /> :
               <span className="text-[8px] text-muted-foreground">—</span>}
            </div>
            <p className={cn('text-[8px] font-mono mt-0.5',
              tf.rsi > 70 ? 'text-bearish' : tf.rsi < 30 ? 'text-bullish' : 'text-muted-foreground'
            )}>RSI {tf.rsi.toFixed(0)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
