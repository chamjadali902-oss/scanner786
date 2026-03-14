import { ScanCondition } from '@/types/scanner';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface FibonacciSettingsProps {
  condition: ScanCondition;
  onUpdate: (updates: Partial<ScanCondition>) => void;
  disabled?: boolean;
}

const FIB_LEVELS = [
  { value: '0', label: '0% (Swing High/Low)' },
  { value: '0.236', label: '23.6%' },
  { value: '0.382', label: '38.2%' },
  { value: '0.5', label: '50%' },
  { value: '0.618', label: '61.8% (Golden Ratio)' },
  { value: '0.786', label: '78.6%' },
  { value: '1', label: '100% (Full Retracement)' },
];

export function FibonacciSettings({ condition, onUpdate, disabled }: FibonacciSettingsProps) {
  const lookback = condition.fibLookback ?? 50;
  const level = condition.fibLevel ?? '0.618';
  const proximity = condition.fibProximityPercent ?? 1;

  return (
    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border/50">
      <div className="text-sm font-medium text-primary">Fibonacci Retracement Settings</div>

      {/* Lookback Period */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Lookback Period (Candles)</Label>
        <div className="flex items-center gap-3">
          <Slider
            value={[lookback]}
            onValueChange={([v]) => onUpdate({ fibLookback: v })}
            min={10}
            max={200}
            step={5}
            disabled={disabled}
            className="flex-1"
          />
          <Input
            type="number"
            value={lookback}
            onChange={(e) => onUpdate({ fibLookback: Math.max(10, Math.min(500, Number(e.target.value))) })}
            min={10}
            max={500}
            className="h-8 text-xs font-mono w-20"
            disabled={disabled}
          />
        </div>
        <p className="text-[10px] text-muted-foreground">
          Number of candles to find swing high/low. Default: 50
        </p>
      </div>

      {/* Fibonacci Level */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Target Fib Level</Label>
        <Select
          value={level}
          onValueChange={(v) => onUpdate({ fibLevel: v })}
          disabled={disabled}
        >
          <SelectTrigger className="h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FIB_LEVELS.map((fl) => (
              <SelectItem key={fl.value} value={fl.value}>{fl.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[10px] text-muted-foreground">
          Signal when price is near this Fibonacci level
        </p>
      </div>

      {/* Proximity */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Proximity Threshold (%)</Label>
        <div className="flex items-center gap-3">
          <Slider
            value={[proximity]}
            onValueChange={([v]) => onUpdate({ fibProximityPercent: v })}
            min={0.1}
            max={5}
            step={0.1}
            disabled={disabled}
            className="flex-1"
          />
          <Input
            type="number"
            value={proximity}
            onChange={(e) => onUpdate({ fibProximityPercent: Math.max(0.1, Math.min(10, Number(e.target.value))) })}
            min={0.1}
            max={10}
            step={0.1}
            className="h-8 text-xs font-mono w-20"
            disabled={disabled}
          />
        </div>
        <p className="text-[10px] text-muted-foreground">
          How close price should be to the level (as % of price). Default: 1%
        </p>
      </div>

      {/* Price Position */}
      <div className="space-y-2 pt-2 border-t border-border/50">
        <Label className="text-xs text-muted-foreground">Price Position Filter</Label>
        <Select
          value={condition.pricePosition || 'above'}
          onValueChange={(v) => onUpdate({ pricePosition: v as 'above' | 'below' })}
          disabled={disabled}
        >
          <SelectTrigger className="h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="above">Near level from above (Bullish retest)</SelectItem>
            <SelectItem value="below">Near level from below (Bearish rejection)</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
