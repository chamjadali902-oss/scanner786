import { ScanCondition, PricePosition } from '@/types/scanner';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface BollingerSettingsProps {
  condition: ScanCondition;
  onUpdate: (updates: Partial<ScanCondition>) => void;
  disabled?: boolean;
}

export function BollingerSettings({ condition, onUpdate, disabled }: BollingerSettingsProps) {
  return (
    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border/50">
      <div className="text-sm font-medium text-primary">Bollinger Bands Settings</div>

      {/* Bollinger Parameters */}
      <div className="space-y-3">
        <Label className="text-xs text-muted-foreground">Parameters</Label>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-[10px] text-muted-foreground">Period (SMA)</Label>
            <Input
              type="number"
              value={condition.bbPeriod ?? 20}
              onChange={(e) => onUpdate({ bbPeriod: Number(e.target.value) })}
              min={5}
              max={100}
              className="h-8 text-xs font-mono"
              disabled={disabled}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] text-muted-foreground">Std Dev Multiplier</Label>
            <Input
              type="number"
              value={condition.bbStdDev ?? 2}
              onChange={(e) => onUpdate({ bbStdDev: Number(e.target.value) })}
              min={0.5}
              max={5}
              step={0.5}
              className="h-8 text-xs font-mono"
              disabled={disabled}
            />
          </div>
        </div>
      </div>

      {/* Band Position */}
      <div className="space-y-3">
        <Label className="text-xs text-muted-foreground">Price Position</Label>
        <Select
          value={condition.pricePosition || 'above'}
          onValueChange={(v) => onUpdate({ pricePosition: v as PricePosition })}
          disabled={disabled}
        >
          <SelectTrigger className="h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="above">Price Above Upper Band (Overbought)</SelectItem>
            <SelectItem value="below">Price Below Lower Band (Oversold)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Band Cross */}
      <div className="space-y-3 pt-2 border-t border-border/50">
        <Label className="text-xs text-muted-foreground">Cross Detection</Label>
        <Select
          value={condition.crossType || 'crossover'}
          onValueChange={(v) => onUpdate({ crossType: v as 'crossover' | 'crossunder' })}
          disabled={disabled}
        >
          <SelectTrigger className="h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="crossover">Price Breaks Above Band</SelectItem>
            <SelectItem value="crossunder">Price Breaks Below Band</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-[10px] text-muted-foreground">
          Signal when price crosses the selected band direction
        </p>
      </div>

      {/* Bandwidth Squeeze */}
      <div className="space-y-3 pt-2 border-t border-border/50">
        <Label className="text-xs text-muted-foreground">Bandwidth Filter (Optional)</Label>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-[10px] text-muted-foreground">Min Bandwidth %</Label>
            <Input
              type="number"
              value={condition.minValue ?? ''}
              onChange={(e) => onUpdate({ minValue: e.target.value ? Number(e.target.value) : undefined })}
              min={0}
              step={0.1}
              className="h-8 text-xs font-mono"
              disabled={disabled}
              placeholder="Any"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] text-muted-foreground">Max Bandwidth %</Label>
            <Input
              type="number"
              value={condition.maxValue ?? ''}
              onChange={(e) => onUpdate({ maxValue: e.target.value ? Number(e.target.value) : undefined })}
              min={0}
              step={0.1}
              className="h-8 text-xs font-mono"
              disabled={disabled}
              placeholder="Any"
            />
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Filter for volatility squeeze (low bandwidth) or expansion (high bandwidth)
        </p>
      </div>
    </div>
  );
}
