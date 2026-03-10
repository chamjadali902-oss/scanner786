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

interface PSARSettingsProps {
  condition: ScanCondition;
  onUpdate: (updates: Partial<ScanCondition>) => void;
  disabled?: boolean;
}

export function PSARSettings({ condition, onUpdate, disabled }: PSARSettingsProps) {
  const step = condition.psarStep ?? 0.02;
  const maxStep = condition.psarMaxStep ?? 0.2;

  return (
    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border/50">
      <div className="text-sm font-medium text-primary">Parabolic SAR Settings</div>

      {/* SAR Parameters */}
      <div className="space-y-3">
        <Label className="text-xs text-muted-foreground">Parameters</Label>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-[10px] text-muted-foreground">AF Step</Label>
            <Input
              type="number"
              value={step}
              onChange={(e) => onUpdate({ psarStep: Math.max(0.001, Number(e.target.value)) })}
              min={0.001}
              max={0.5}
              step={0.01}
              className="h-8 text-xs font-mono"
              disabled={disabled}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] text-muted-foreground">AF Maximum</Label>
            <Input
              type="number"
              value={maxStep}
              onChange={(e) => onUpdate({ psarMaxStep: Math.max(0.01, Number(e.target.value)) })}
              min={0.01}
              max={1}
              step={0.01}
              className="h-8 text-xs font-mono"
              disabled={disabled}
            />
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground">
          TradingView defaults: Step=0.02, Maximum=0.2
        </p>
      </div>

      {/* Price Position */}
      <div className="space-y-3 pt-2 border-t border-border/50">
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
            <SelectItem value="above">Price Above SAR (Bullish)</SelectItem>
            <SelectItem value="below">Price Below SAR (Bearish)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Cross Detection */}
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
            <SelectItem value="crossover">SAR Flip Bullish (Dots move below price)</SelectItem>
            <SelectItem value="crossunder">SAR Flip Bearish (Dots move above price)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-[10px] text-muted-foreground">
          Signal on SAR direction change
        </p>
      </div>
    </div>
  );
}
