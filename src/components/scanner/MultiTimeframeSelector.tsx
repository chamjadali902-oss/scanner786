import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Timeframe, TIMEFRAME_OPTIONS, isValidTimeframe } from '@/types/scanner';
import { Layers, Plus, X } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

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
  const [customTfs, setCustomTfs] = useState<Timeframe[]>(() => {
    try { return JSON.parse(localStorage.getItem('customTimeframes') || '[]'); } catch { return []; }
  });
  const [showInput, setShowInput] = useState(false);
  const [input, setInput] = useState('');

  const allOptions = [
    ...TIMEFRAME_OPTIONS,
    ...customTfs.filter(t => !TIMEFRAME_OPTIONS.some(o => o.value === t)).map(t => ({ value: t, label: t.toUpperCase() })),
  ];

  const saveCustom = (tfs: Timeframe[]) => {
    setCustomTfs(tfs);
    localStorage.setItem('customTimeframes', JSON.stringify(tfs));
  };

  const handleAdd = () => {
    const tf = input.trim();
    if (!isValidTimeframe(tf)) {
      toast.error('Invalid timeframe', { description: 'Use Binance format: 1m,3m,5m,15m,30m,1h,2h,4h,6h,8h,12h,1d,3d,1w,1M' });
      return;
    }
    if (!customTfs.includes(tf) && !TIMEFRAME_OPTIONS.some(o => o.value === tf)) {
      saveCustom([...customTfs, tf]);
    }
    onPrimaryChange(tf);
    setInput('');
    setShowInput(false);
  };

  const removeCustom = (tf: Timeframe) => {
    saveCustom(customTfs.filter(t => t !== tf));
    if (primaryTimeframe === tf) onPrimaryChange('15m');
  };

  return (
    <div className="space-y-3">
      <label className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        Timeframe
      </label>
      
      {/* Primary timeframe selection */}
      <div className="flex flex-wrap gap-1.5 sm:gap-2">
        {allOptions.map((option) => {
          const isCustom = customTfs.includes(option.value);
          return (
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
              {isCustom && (
                <span
                  onClick={(e) => { e.stopPropagation(); removeCustom(option.value); }}
                  className="ml-1.5 opacity-60 hover:opacity-100 hover:text-destructive cursor-pointer"
                >×</span>
              )}
            </button>
          );
        })}
        <button
          onClick={() => setShowInput(!showInput)}
          disabled={disabled}
          className="px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium border border-dashed border-border hover:border-primary/50 hover:text-primary transition-all flex items-center gap-1"
        >
          <Plus className="w-3 h-3" /> Custom
        </button>
      </div>
      {showInput && (
        <div className="flex gap-2 items-center p-2 rounded-lg border border-primary/20 bg-primary/5">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
            placeholder="e.g. 30m, 2h, 6h, 1w"
            className="h-8 text-sm font-mono"
            autoFocus
          />
          <Button size="sm" onClick={handleAdd} className="h-8">Add</Button>
          <Button size="sm" variant="ghost" onClick={() => { setShowInput(false); setInput(''); }} className="h-8 w-8 p-0">
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

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
