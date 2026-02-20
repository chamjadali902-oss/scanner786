import { ScanCondition } from '@/types/scanner';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface StochasticSettingsProps {
  condition: ScanCondition;
  onUpdate: (updates: Partial<ScanCondition>) => void;
  disabled?: boolean;
}

export function StochasticSettings({ condition, onUpdate, disabled }: StochasticSettingsProps) {
  const overbought = condition.stochOverbought ?? 80;
  const oversold = condition.stochOversold ?? 20;

  return (
    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border/50">
      <div className="text-sm font-medium text-primary">Stochastic Settings</div>

      {/* Overbought/Oversold Levels */}
      <div className="space-y-3">
        <Label className="text-xs text-muted-foreground">Overbought / Oversold Levels</Label>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-destructive">Overbought: {overbought}</span>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={overbought}
                onChange={(e) => onUpdate({ stochOverbought: Number(e.target.value) })}
                min={50}
                max={100}
                className="h-8 text-xs font-mono w-20"
                disabled={disabled}
              />
              <Slider
                value={[overbought]}
                onValueChange={([v]) => onUpdate({ stochOverbought: v })}
                min={50}
                max={100}
                step={1}
                disabled={disabled}
                className="flex-1"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-chart-1">Oversold: {oversold}</span>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={oversold}
                onChange={(e) => onUpdate({ stochOversold: Number(e.target.value) })}
                min={0}
                max={50}
                className="h-8 text-xs font-mono w-20"
                disabled={disabled}
              />
              <Slider
                value={[oversold]}
                onValueChange={([v]) => onUpdate({ stochOversold: v })}
                min={0}
                max={50}
                step={1}
                disabled={disabled}
                className="flex-1"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Signal Type */}
      <div className="space-y-3 pt-2 border-t border-border/50">
        <Label className="text-xs text-muted-foreground">Signal Condition</Label>
        <Select
          value={condition.mode || 'range'}
          onValueChange={(v) => onUpdate({ mode: v as 'range' | 'cross' })}
          disabled={disabled}
        >
          <SelectTrigger className="h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="range">In Zone (Overbought/Oversold)</SelectItem>
            <SelectItem value="cross">%K/%D Crossover</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {condition.mode === 'cross' && (
        <div className="space-y-3">
          <Select
            value={condition.crossType || 'crossover'}
            onValueChange={(v) => onUpdate({ crossType: v as 'crossover' | 'crossunder' })}
            disabled={disabled}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="crossover">%K Crosses Above %D (Bullish)</SelectItem>
              <SelectItem value="crossunder">%K Crosses Below %D (Bearish)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {condition.mode === 'range' && (
        <div className="p-3 bg-background/50 rounded-md">
          <p className="text-xs text-muted-foreground">
            Signal when Stochastic %K is below {oversold} (oversold) or above {overbought} (overbought)
          </p>
        </div>
      )}
    </div>
  );
}
