import { ScanCondition, FeatureDefinition, PricePosition } from '@/types/scanner';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface PriceCrossSettingsProps {
  condition: ScanCondition;
  feature: FeatureDefinition;
  onUpdate: (updates: Partial<ScanCondition>) => void;
  disabled?: boolean;
}

export function PriceCrossSettings({ condition, feature, onUpdate, disabled }: PriceCrossSettingsProps) {
  return (
    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border/50">
      <div className="text-sm font-medium text-primary">{feature.name} Settings</div>

      {/* Price Position */}
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
            <SelectItem value="above">Price Above {feature.name}</SelectItem>
            <SelectItem value="below">Price Below {feature.name}</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-[10px] text-muted-foreground">
          Signal when price is {condition.pricePosition || 'above'} the {feature.name} line
        </p>
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
            <SelectItem value="crossover">Price Crosses Above {feature.name} (Bullish)</SelectItem>
            <SelectItem value="crossunder">Price Crosses Below {feature.name} (Bearish)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-[10px] text-muted-foreground">
          Signal on cross event, not just position
        </p>
      </div>
    </div>
  );
}
