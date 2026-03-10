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

// Map feature id to its specific period field in ScanCondition
function getPeriodField(featureId: string): keyof ScanCondition {
  switch (featureId) {
    case 'adx': return 'adxPeriod';
    case 'cci': return 'cciPeriod';
    case 'atr': return 'atrPeriod';
    case 'mfi': return 'mfiPeriod';
    case 'williams_r': return 'williamsRPeriod';
    case 'roc': return 'rocPeriod';
    default: return 'period';
  }
}

function getPeriodValue(condition: ScanCondition, featureId: string, defaultPeriod: number): number {
  switch (featureId) {
    case 'adx': return condition.adxPeriod ?? defaultPeriod;
    case 'cci': return condition.cciPeriod ?? defaultPeriod;
    case 'atr': return condition.atrPeriod ?? defaultPeriod;
    case 'mfi': return condition.mfiPeriod ?? defaultPeriod;
    case 'williams_r': return condition.williamsRPeriod ?? defaultPeriod;
    case 'roc': return condition.rocPeriod ?? defaultPeriod;
    default: return condition.period ?? defaultPeriod;
  }
}

export function OscillatorSettings({ condition, feature, onUpdate, disabled }: OscillatorSettingsProps) {
  const hasRange = feature.valueRange !== undefined;
  const min = feature.valueRange?.min ?? -200;
  const max = feature.valueRange?.max ?? 200;
  const periodField = getPeriodField(feature.id);
  const periodValue = getPeriodValue(condition, feature.id, feature.defaultPeriod ?? 14);

  const handlePeriodChange = (val: number) => {
    onUpdate({ [periodField]: val } as Partial<ScanCondition>);
  };

  return (
    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border/50">
      <div className="text-sm font-medium text-primary">{feature.name} Settings</div>

      {/* Period Setting */}
      {feature.hasPeriod && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Period (Length)</Label>
          <div className="flex items-center gap-3">
            <Slider
              value={[periodValue]}
              onValueChange={([v]) => handlePeriodChange(v)}
              min={feature.minPeriod ?? 1}
              max={feature.maxPeriod ?? 100}
              step={1}
              disabled={disabled}
              className="flex-1"
            />
            <Input
              type="number"
              value={periodValue}
              onChange={(e) => {
                const v = Math.max(feature.minPeriod ?? 1, Math.min(feature.maxPeriod ?? 500, Number(e.target.value)));
                handlePeriodChange(v);
              }}
              min={feature.minPeriod ?? 1}
              max={feature.maxPeriod ?? 500}
              className="h-8 text-xs font-mono w-20"
              disabled={disabled}
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            TradingView default: {feature.defaultPeriod ?? 14}. Lower = more sensitive, Higher = smoother
          </p>
        </div>
      )}

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
    </div>
  );
}
