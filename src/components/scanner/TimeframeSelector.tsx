import { cn } from '@/lib/utils';
import { Timeframe, TIMEFRAME_OPTIONS } from '@/types/scanner';

interface TimeframeSelectorProps {
  value: Timeframe;
  onChange: (value: Timeframe) => void;
  disabled?: boolean;
}

export function TimeframeSelector({ value, onChange, disabled }: TimeframeSelectorProps) {
  return (
    <div className="space-y-3">
      <label className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        Timeframe
      </label>
      <div className="flex flex-wrap gap-1.5 sm:gap-2">
        {TIMEFRAME_OPTIONS.map((option) => {
          const isSelected = value === option.value;
          
          return (
            <button
              key={option.value}
              onClick={() => onChange(option.value)}
              disabled={disabled}
              className={cn(
                'px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-mono text-xs sm:text-sm font-medium transition-all duration-200',
                'border focus:outline-none focus:ring-2 focus:ring-primary/50 active:scale-95',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                isSelected
                  ? 'bg-primary text-primary-foreground border-primary shadow-md glow-primary'
                  : 'bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
              )}
            >
              {option.value.toUpperCase()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
