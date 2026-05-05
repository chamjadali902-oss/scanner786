import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Timeframe, TIMEFRAME_OPTIONS, isValidTimeframe } from '@/types/scanner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';

interface TimeframeSelectorProps {
  value: Timeframe;
  onChange: (value: Timeframe) => void;
  disabled?: boolean;
}

export function TimeframeSelector({ value, onChange, disabled }: TimeframeSelectorProps) {
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
    onChange(tf);
    setInput('');
    setShowInput(false);
  };

  const removeCustom = (tf: Timeframe) => {
    saveCustom(customTfs.filter(t => t !== tf));
    if (value === tf) onChange('15m');
  };

  return (
    <div className="space-y-3">
      <label className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        Timeframe
      </label>
      <div className="flex flex-wrap gap-1.5 sm:gap-2">
        {allOptions.map((option) => {
          const isSelected = value === option.value;
          const isCustom = customTfs.includes(option.value);
          return (
            <div key={option.value} className="relative group">
              <button
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
                {isCustom && (
                  <span
                    onClick={(e) => { e.stopPropagation(); removeCustom(option.value); }}
                    className="ml-1.5 opacity-60 hover:opacity-100 hover:text-destructive cursor-pointer"
                  >×</span>
                )}
              </button>
            </div>
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
    </div>
  );
}
