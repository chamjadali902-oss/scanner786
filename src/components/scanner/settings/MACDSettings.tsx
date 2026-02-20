import { ScanCondition } from '@/types/scanner';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface MACDSettingsProps {
  condition: ScanCondition;
  onUpdate: (updates: Partial<ScanCondition>) => void;
  disabled?: boolean;
}

export function MACDSettings({ condition, onUpdate, disabled }: MACDSettingsProps) {
  return (
    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border/50">
      <div className="text-sm font-medium text-primary">MACD Settings</div>

      {/* MACD Parameters */}
      <div className="space-y-3">
        <Label className="text-xs text-muted-foreground">MACD Parameters</Label>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-[10px] text-muted-foreground">Fast EMA</Label>
            <Input
              type="number"
              value={condition.macdFast ?? 12}
              onChange={(e) => onUpdate({ macdFast: Number(e.target.value) })}
              min={1}
              max={100}
              className="h-8 text-xs font-mono"
              disabled={disabled}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] text-muted-foreground">Slow EMA</Label>
            <Input
              type="number"
              value={condition.macdSlow ?? 26}
              onChange={(e) => onUpdate({ macdSlow: Number(e.target.value) })}
              min={1}
              max={100}
              className="h-8 text-xs font-mono"
              disabled={disabled}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] text-muted-foreground">Signal</Label>
            <Input
              type="number"
              value={condition.macdSignal ?? 9}
              onChange={(e) => onUpdate({ macdSignal: Number(e.target.value) })}
              min={1}
              max={100}
              className="h-8 text-xs font-mono"
              disabled={disabled}
            />
          </div>
        </div>
      </div>

      {/* Signal Type */}
      <div className="space-y-3">
        <Label className="text-xs text-muted-foreground">Signal Condition</Label>
        <Select
          value={condition.crossType || 'crossover'}
          onValueChange={(v) => onUpdate({ crossType: v as 'crossover' | 'crossunder' })}
          disabled={disabled}
        >
          <SelectTrigger className="h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="crossover">MACD Line Crosses Above Signal (Bullish)</SelectItem>
            <SelectItem value="crossunder">MACD Line Crosses Below Signal (Bearish)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Histogram Filter */}
      <div className="space-y-3 pt-2 border-t border-border/50">
        <Label className="text-xs text-muted-foreground">Histogram Condition (Optional)</Label>
        <div className="grid grid-cols-2 gap-3">
          <Select
            value={condition.operator || '>'}
            onValueChange={(v) => onUpdate({ operator: v as '>' | '<' | '=' | '>=' | '<=' })}
            disabled={disabled}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value=">">Histogram {'>'}</SelectItem>
              <SelectItem value="<">Histogram {'<'}</SelectItem>
              <SelectItem value=">=">Histogram {'>='}</SelectItem>
              <SelectItem value="<=">Histogram {'<='}</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="number"
            value={condition.compareValue ?? 0}
            onChange={(e) => onUpdate({ compareValue: Number(e.target.value) })}
            className="h-8 text-xs font-mono"
            disabled={disabled}
            placeholder="Value"
          />
        </div>
        <p className="text-[10px] text-muted-foreground">
          Filter signals where histogram is {condition.operator || '>'} {condition.compareValue ?? 0}
        </p>
      </div>
    </div>
  );
}
