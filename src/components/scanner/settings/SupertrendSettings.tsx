import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScanCondition } from '@/types/scanner';

interface SupertrendSettingsProps {
  condition: ScanCondition;
  onUpdate: (updates: Partial<ScanCondition>) => void;
}

export function SupertrendSettings({ condition, onUpdate }: SupertrendSettingsProps) {
  const period = condition.supertrendPeriod ?? 10;
  const multiplier = condition.supertrendMultiplier ?? 3;

  // Determine current mode
  const mode = condition.crossType
    ? condition.crossType === 'crossover' ? 'crossover' : 'crossunder'
    : condition.pricePosition === 'below' ? 'below' : 'above';

  const handleModeChange = (value: string) => {
    if (value === 'crossover') {
      onUpdate({ crossType: 'crossover', pricePosition: undefined });
    } else if (value === 'crossunder') {
      onUpdate({ crossType: 'crossunder', pricePosition: undefined });
    } else if (value === 'above') {
      onUpdate({ crossType: undefined, pricePosition: 'above' });
    } else if (value === 'below') {
      onUpdate({ crossType: undefined, pricePosition: 'below' });
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs text-muted-foreground">ATR Period</Label>
          <Input
            type="number"
            min={1}
            max={100}
            value={period}
            onChange={(e) => onUpdate({ supertrendPeriod: parseInt(e.target.value) || 10 })}
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Multiplier</Label>
          <Input
            type="number"
            min={0.1}
            max={10}
            step={0.1}
            value={multiplier}
            onChange={(e) => onUpdate({ supertrendMultiplier: parseFloat(e.target.value) || 3 })}
            className="h-8 text-sm"
          />
        </div>
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">Condition</Label>
        <Select value={mode} onValueChange={handleModeChange}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="above">Price Above Supertrend (Bullish)</SelectItem>
            <SelectItem value="below">Price Below Supertrend (Bearish)</SelectItem>
            <SelectItem value="crossover">Supertrend Flip Bullish ↑</SelectItem>
            <SelectItem value="crossunder">Supertrend Flip Bearish ↓</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
