import { ScanCondition, FeatureDefinition } from '@/types/scanner';
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

interface OscillatorSettingsProps {
  condition: ScanCondition;
  feature: FeatureDefinition;
  onUpdate: (updates: Partial<ScanCondition>) => void;
  disabled?: boolean;
}

export function OscillatorSettings({ condition, feature, onUpdate, disabled }: OscillatorSettingsProps) {
  const hasRange = feature.valueRange !== undefined;
  const min = feature.valueRange?.min ?? -200;
  const max = feature.valueRange?.max ?? 200;

  return (
    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border/50">
      <div className="text-sm font-medium text-primary">{feature.name} Settings</div>

      {/* Mode Selection */}
      <div className="space-y-3">
        <Label className="text-xs text-muted-foreground">Condition Type</Label>
        <Select
          value={condition.mode || 'range'}
          onValueChange={(v) => onUpdate({ mode: v as 'range' | 'comparison' })}
          disabled={disabled}
        >
          <SelectTrigger className="h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="range">Value Range (Min-Max)</SelectItem>
            <SelectItem value="comparison">Comparison (Greater/Less than)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Range Mode */}
      {condition.mode === 'range' && hasRange && (
        <div className="space-y-3">
          <Label className="text-xs text-muted-foreground">Value Range</Label>
          <div className="flex justify-between text-xs mb-2">
            <span>Min: {condition.minValue ?? min}</span>
            <span>Max: {condition.maxValue ?? max}</span>
          </div>
          <div className="flex gap-2">
            <Input
              type="number"
              value={condition.minValue ?? min}
              onChange={(e) => onUpdate({ minValue: Number(e.target.value) })}
              min={min}
              max={max}
              className="h-8 text-xs font-mono w-20"
              disabled={disabled}
            />
            <div className="flex-1 flex items-center">
              <Slider
                value={[condition.minValue ?? min, condition.maxValue ?? max]}
                onValueChange={([minV, maxV]) => onUpdate({ minValue: minV, maxValue: maxV })}
                min={min}
                max={max}
                step={1}
                disabled={disabled}
                className="mx-2"
              />
            </div>
            <Input
              type="number"
              value={condition.maxValue ?? max}
              onChange={(e) => onUpdate({ maxValue: Number(e.target.value) })}
              min={min}
              max={max}
              className="h-8 text-xs font-mono w-20"
              disabled={disabled}
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            Signal when {feature.name} is between {condition.minValue ?? min} and {condition.maxValue ?? max}
          </p>
        </div>
      )}

      {/* Comparison Mode */}
      {condition.mode === 'comparison' && (
        <div className="space-y-3">
          <Label className="text-xs text-muted-foreground">Comparison</Label>
          <div className="flex gap-2">
            <Select
              value={condition.operator || '>'}
              onValueChange={(v) => onUpdate({ operator: v as '>' | '<' | '=' | '>=' | '<=' })}
              disabled={disabled}
            >
              <SelectTrigger className="h-8 w-20 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value=">">{'>'}</SelectItem>
                <SelectItem value="<">{'<'}</SelectItem>
                <SelectItem value="=">{'='}</SelectItem>
                <SelectItem value=">=">{'>='}</SelectItem>
                <SelectItem value="<=">{'<='}</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              value={condition.compareValue ?? 0}
              onChange={(e) => onUpdate({ compareValue: Number(e.target.value) })}
              className="h-8 text-xs font-mono flex-1"
              disabled={disabled}
              placeholder="Value"
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            Signal when {feature.name} is {condition.operator || '>'} {condition.compareValue ?? 0}
          </p>
        </div>
      )}

      {/* Period (if applicable) */}
      {feature.hasPeriod && (
        <div className="space-y-3 pt-2 border-t border-border/50">
          <Label className="text-xs text-muted-foreground">Period</Label>
          <Input
            type="number"
            value={condition.period ?? feature.defaultPeriod ?? 14}
            onChange={(e) => onUpdate({ period: Number(e.target.value) })}
            min={feature.minPeriod ?? 1}
            max={feature.maxPeriod ?? 500}
            className="h-8 text-xs font-mono w-24"
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}
