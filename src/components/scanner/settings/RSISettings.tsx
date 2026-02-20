import { ScanCondition } from '@/types/scanner';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';

interface RSISettingsProps {
  condition: ScanCondition;
  onUpdate: (updates: Partial<ScanCondition>) => void;
  disabled?: boolean;
}

export function RSISettings({ condition, onUpdate, disabled }: RSISettingsProps) {
  return (
    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border/50">
      <div className="text-sm font-medium text-primary">RSI Settings</div>
      
      {/* Range Selection */}
      <div className="space-y-3">
        <Label className="text-xs text-muted-foreground">Value Range</Label>
        <div className="flex items-center gap-3">
          <div className="flex-1 space-y-2">
            <div className="flex justify-between text-xs">
              <span>Min: {condition.minValue ?? 0}</span>
              <span>Max: {condition.maxValue ?? 100}</span>
            </div>
            <div className="flex gap-2">
              <Input
                type="number"
                value={condition.minValue ?? 0}
                onChange={(e) => onUpdate({ minValue: Number(e.target.value) })}
                min={0}
                max={100}
                className="h-8 text-xs font-mono w-20"
                disabled={disabled}
                placeholder="Min"
              />
              <div className="flex-1 flex items-center">
                <Slider
                  value={[condition.minValue ?? 0, condition.maxValue ?? 100]}
                  onValueChange={([min, max]) => onUpdate({ minValue: min, maxValue: max })}
                  min={0}
                  max={100}
                  step={1}
                  disabled={disabled}
                  className="mx-2"
                />
              </div>
              <Input
                type="number"
                value={condition.maxValue ?? 100}
                onChange={(e) => onUpdate({ maxValue: Number(e.target.value) })}
                min={0}
                max={100}
                className="h-8 text-xs font-mono w-20"
                disabled={disabled}
                placeholder="Max"
              />
            </div>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Signal when RSI is between {condition.minValue ?? 0} and {condition.maxValue ?? 100}
        </p>
      </div>

      {/* Divergence Settings */}
      <div className="space-y-3 pt-2 border-t border-border/50">
        <Label className="text-xs text-muted-foreground">Divergence Detection</Label>
        
        <div className="flex items-center justify-between py-2 px-3 rounded-md bg-background/50">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Regular Divergence</p>
            <p className="text-[10px] text-muted-foreground">
              Price makes new high/low but RSI doesn't confirm
            </p>
          </div>
          <Switch
            checked={condition.rsiRegularDivergence ?? false}
            onCheckedChange={(checked) => onUpdate({ rsiRegularDivergence: checked })}
            disabled={disabled}
          />
        </div>

        <div className="flex items-center justify-between py-2 px-3 rounded-md bg-background/50">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Hidden Divergence</p>
            <p className="text-[10px] text-muted-foreground">
              Trend continuation signal (opposite of regular)
            </p>
          </div>
          <Switch
            checked={condition.rsiHiddenDivergence ?? false}
            onCheckedChange={(checked) => onUpdate({ rsiHiddenDivergence: checked })}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}
