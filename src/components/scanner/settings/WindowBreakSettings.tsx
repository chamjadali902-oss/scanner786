import { ScanCondition, FeatureDefinition } from '@/types/scanner';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';

interface Props {
  condition: ScanCondition;
  feature: FeatureDefinition;
  onUpdate: (updates: Partial<ScanCondition>) => void;
  disabled?: boolean;
}

export function WindowBreakSettings({ condition, feature, onUpdate, disabled }: Props) {
  const isHigh = feature.id === 'window_high_break';
  const rows: { label: string; key: keyof ScanCondition; value: number; min: number; max: number; step: number; hint: string; fmt?: (v: number) => string }[] = [
    { label: 'Window Size (candles)', key: 'windowBreakSize', value: condition.windowBreakSize ?? 20, min: 2, max: 300, step: 1, hint: 'How many previous candles form the level. Example: 2 = previous 2 candles, 300 = last 300 candles. Default 20', fmt: v => `${v}` },
    { label: 'Max Break Age (candles)', key: 'windowBreakMaxAge', value: condition.windowBreakMaxAge ?? 5, min: 0, max: 60, step: 1, hint: 'Break may have happened within the last N candles. 0 = only the current candle counts. Default 5', fmt: v => `${v}` },
  ];

  return (
    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border/50">
      <div className="text-sm font-medium text-primary">{feature.name}</div>
      <p className="text-xs text-muted-foreground p-3 bg-background/50 rounded-md">
        {isHigh
          ? 'Price broke the HIGH of the selected candle window — the reference level is built from the candles right before the break, so the breaking candle itself is excluded.'
          : 'Price broke the LOW of the selected candle window — the reference level is built from the candles right before the break, so the breaking candle itself is excluded.'}
      </p>
      {rows.map(r => (
        <div key={r.key as string} className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">{r.label}</Label>
            <span className="text-xs font-mono text-primary">{r.fmt ? r.fmt(r.value) : r.value}</span>
          </div>
          <Slider value={[r.value]} min={r.min} max={r.max} step={r.step}
            onValueChange={([v]) => onUpdate({ [r.key]: v } as Partial<ScanCondition>)} disabled={disabled} />
          <p className="text-[10px] text-muted-foreground">{r.hint}</p>
        </div>
      ))}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Require Close Beyond Level</Label>
          <p className="text-[10px] text-muted-foreground">Off = a wick beyond the level counts as a break. On = the candle must CLOSE beyond the level (stronger confirmation)</p>
        </div>
        <Switch checked={condition.windowBreakRequireClose ?? false}
          onCheckedChange={v => onUpdate({ windowBreakRequireClose: v })} disabled={disabled} />
      </div>
    </div>
  );
}
