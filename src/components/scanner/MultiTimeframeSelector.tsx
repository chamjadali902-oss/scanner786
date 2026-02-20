import { cn } from '@/lib/utils';
import { Timeframe, TIMEFRAME_OPTIONS } from '@/types/scanner';
import { Layers } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

interface MultiTimeframeSelectorProps {
  primaryTimeframe: Timeframe;
  onPrimaryChange: (value: Timeframe) => void;
  mtfEnabled: boolean;
  onMtfToggle: (enabled: boolean) => void;
  selectedTimeframes: Timeframe[];
  onTimeframesChange: (timeframes: Timeframe[]) => void;
  disabled?: boolean;
}

const MTF_OPTIONS: Timeframe[] = ['1h', '4h', '1d'];

export function MultiTimeframeSelector({
  primaryTimeframe,
  onPrimaryChange,
  mtfEnabled,
  onMtfToggle,
  selectedTimeframes,
  onTimeframesChange,
  disabled,
}: MultiTimeframeSelectorProps) {
  const toggleMtfTimeframe = (tf: Timeframe) => {
    if (selectedTimeframes.includes(tf)) {
      if (selectedTimeframes.length > 1) {
        onTimeframesChange(selectedTimeframes.filter(t => t !== tf));
      }
    } else {
      if (selectedTimeframes.length < 3) {
        onTimeframesChange([...selectedTimeframes, tf]);
      }
    }
  };

  return (
    <div className="space-y-3">
      <label className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        Timeframe
      </label>
      
      {/* Primary timeframe selection */}
      <div className="flex flex-wrap gap-1.5 sm:gap-2">
        {TIMEFRAME_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => onPrimaryChange(option.value)}
            disabled={disabled}
            className={cn(
              'px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-mono text-xs sm:text-sm font-medium transition-all duration-200',
              'border focus:outline-none focus:ring-2 focus:ring-primary/50 active:scale-95',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              primaryTimeframe === option.value
                ? 'bg-primary text-primary-foreground border-primary shadow-md glow-primary'
                : 'bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
            )}
          >
            {option.value.toUpperCase()}
          </button>
        ))}
      </div>

      {/* MTF Toggle */}
      <div className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-muted/20">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" />
          <div>
            <p className="text-xs font-medium">Multi-Timeframe Confluence</p>
            <p className="text-[10px] text-muted-foreground">Scan across multiple timeframes</p>
          </div>
        </div>
        <Switch checked={mtfEnabled} onCheckedChange={onMtfToggle} disabled={disabled} />
      </div>

      {/* MTF Timeframe Selection */}
      {mtfEnabled && (
        <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 space-y-2">
          <p className="text-[10px] text-primary font-semibold uppercase tracking-wider">Confluence Timeframes (pick 2-3)</p>
          <div className="flex gap-1.5">
            {MTF_OPTIONS.map(tf => (
              <button
                key={tf}
                onClick={() => toggleMtfTimeframe(tf)}
                disabled={disabled}
                className={cn(
                  'px-3 py-1.5 rounded-lg font-mono text-xs font-medium transition-all border',
                  selectedTimeframes.includes(tf)
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card text-muted-foreground border-border hover:border-primary/50'
                )}
              >
                {tf.toUpperCase()}
              </button>
            ))}
          </div>
          <p className="text-[9px] text-muted-foreground">
            Signal must match on {selectedTimeframes.length}/{selectedTimeframes.length} timeframes to pass
          </p>
        </div>
      )}
    </div>
  );
}
