import { cn } from '@/lib/utils';
import { ScanPool, SCAN_POOL_OPTIONS } from '@/types/scanner';
import { TrendingDown, TrendingUp, BarChart3, Star } from 'lucide-react';

interface ScanPoolSelectorProps {
  value: ScanPool;
  onChange: (value: ScanPool) => void;
  disabled?: boolean;
  hasFavorites?: boolean;
}

const icons: Record<ScanPool, typeof TrendingDown> = {
  losers: TrendingDown,
  gainers: TrendingUp,
  volume: BarChart3,
  favorites: Star,
};

export function ScanPoolSelector({ value, onChange, disabled, hasFavorites }: ScanPoolSelectorProps) {
  const filteredOptions = SCAN_POOL_OPTIONS.filter(
    o => o.value !== 'favorites' || hasFavorites
  );

  return (
    <div className="space-y-3">
      <label className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        Scan Pool
      </label>
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {filteredOptions.map((option) => {
          const Icon = icons[option.value];
          const isSelected = value === option.value;
          
          return (
            <button
              key={option.value}
              onClick={() => onChange(option.value)}
              disabled={disabled}
              className={cn(
                'relative p-3 sm:p-4 rounded-xl border transition-all duration-300',
                'flex flex-col items-center gap-1.5 sm:gap-2 text-center',
                'hover:border-primary/50 hover:bg-primary/5 active:scale-[0.97]',
                'focus:outline-none focus:ring-2 focus:ring-primary/50',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                isSelected
                  ? 'border-primary bg-primary/10 shadow-lg glow-primary ring-1 ring-primary/30'
                  : 'border-border bg-card hover:shadow-md'
              )}
            >
              <Icon 
                className={cn(
                  'w-5 h-5 sm:w-6 sm:h-6 transition-colors',
                  isSelected ? 'text-primary' : 'text-muted-foreground',
                  option.value === 'losers' && isSelected && 'text-bearish',
                  option.value === 'gainers' && isSelected && 'text-bullish'
                )} 
              />
              <div>
                <p className={cn(
                  'font-semibold text-xs sm:text-sm',
                  isSelected ? 'text-foreground' : 'text-muted-foreground'
                )}>
                  {option.label}
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 hidden sm:block">
                  {option.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
