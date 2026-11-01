import { useState, useMemo } from 'react';
import { Bell, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { usePriceAlerts } from '@/hooks/usePriceAlerts';
import { ScanResult, Timeframe } from '@/types/scanner';

interface TriggerAlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: ScanResult;
  timeframe: Timeframe;
  currentPrice: number;
}

const EXCLUDED_KEY_PATTERNS = /(_result|vol|volume|ratio|pct|percent|score|change|divergence|impulse|direction)/i;

export function TriggerAlertDialog({ open, onOpenChange, result, timeframe, currentPrice }: TriggerAlertDialogProps) {
  const { createAlert } = usePriceAlerts();
  const [priceInput, setPriceInput] = useState('');
  const [note, setNote] = useState('');
  const [creating, setCreating] = useState(false);

  const quickLevels = useMemo(() => {
    return Object.entries(result.indicatorValues)
      .filter(([k, v]) => typeof v === 'number' && !EXCLUDED_KEY_PATTERNS.test(k) && (v as number) > 0)
      .slice(0, 6) as [string, number][];
  }, [result.indicatorValues]);

  const parsed = parseFloat(priceInput);
  const valid = !isNaN(parsed) && parsed > 0;
  const direction: 'above' | 'below' = valid ? (parsed >= currentPrice ? 'above' : 'below') : (result.isBullish ? 'above' : 'below');

  const submit = async (price: number, levelNote?: string) => {
    if (isNaN(price) || price <= 0) return;
    setCreating(true);
    const ok = await createAlert({
      symbol: result.symbol,
      timeframe,
      direction: price >= currentPrice ? 'above' : 'below',
      triggerPrice: price,
      note: (levelNote ?? note) || null,
      source: 'scanner',
    });
    setCreating(false);
    if (ok) {
      setPriceInput('');
      setNote('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Bell className="w-4 h-4" />
            Set Entry Trigger — {result.symbol.replace('USDT', '')}/USDT
          </DialogTitle>
          <DialogDescription className="text-xs">
            Live price ${currentPrice < 1 ? currentPrice.toFixed(6) : currentPrice.toFixed(2)} · {timeframe} chart. You get a notification the moment price crosses your level.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Quick levels from the scan */}
          {quickLevels.length > 0 && (
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Levels from this setup</p>
              <div className="flex flex-wrap gap-1.5">
                {quickLevels.map(([key, value]) => (
                  <button
                    key={key}
                    onClick={() => setPriceInput(String(value))}
                    className={cn(
                      'rounded-md border px-2 py-1 text-[11px] font-medium transition-colors hover:bg-muted/50',
                      result.isBullish ? 'bg-bullish/10 text-bullish border-bullish/20' : 'bg-bearish/10 text-bearish border-bearish/20'
                    )}
                  >
                    {key.replace(/_/g, ' ')}: {value < 1 ? value.toFixed(6) : value.toFixed(2)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Trigger price</label>
            <Input
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              placeholder="e.g. 0.0001250"
              inputMode="decimal"
              className="font-mono"
            />
          </div>

          {valid && (
            <div className={cn(
              'flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs font-medium',
              direction === 'above' ? 'bg-bullish/10 text-bullish border-bullish/20' : 'bg-bearish/10 text-bearish border-bearish/20'
            )}>
              {direction === 'above' ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              Alerts when price crosses {direction === 'above' ? 'above' : 'below'} ${priceInput}
              <span className="ml-auto text-[10px] text-muted-foreground">
                {direction === 'above' ? 'long trigger' : 'short trigger'}
              </span>
            </div>
          )}

          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Note (optional)</label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. breakout level, sweep low"
              className="text-xs"
              maxLength={80}
            />
          </div>

          <Button className="w-full" disabled={!valid || creating} onClick={() => submit(parsed)}>
            {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bell className="mr-2 h-4 w-4" />}
            Set Alert
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
