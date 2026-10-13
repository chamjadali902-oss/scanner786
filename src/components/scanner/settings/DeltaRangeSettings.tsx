import { ScanCondition, FeatureDefinition } from '@/types/scanner';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';

interface Props {
  condition: ScanCondition;
  feature: FeatureDefinition;
  onUpdate: (updates: Partial<ScanCondition>) => void;
  disabled?: boolean;
}

export function DeltaRangeSettings({ condition, feature, onUpdate, disabled }: Props) {
  const accum = feature.id === 'delta_accumulation_range';
  const rows: { label: string; key: keyof ScanCondition; value: number; min: number; max: number; step: number; hint: string; fmt?: (v: number) => string }[] = [
    { label: 'Range Lookback (candles)', key: 'deltaRangeLookback', value: condition.deltaRangeLookback ?? 30, min: 10, max: 100, step: 1, hint: 'How many recent candles form the range. Default 30' },
    { label: 'Max Range Width %', key: 'deltaRangeMaxWidth', value: condition.deltaRangeMaxWidth ?? 8, min: 1, max: 25, step: 0.5, hint: 'Tighter = cleaner consolidation. Default 8%', fmt: v => `${v}%` },
    { label: `Min ${accum ? 'Buying' : 'Selling'} Candles %`, key: 'deltaRangeMinDominance', value: condition.deltaRangeMinDominance ?? 55, min: 50, max: 90, step: 1, hint: `Share of candles with ${accum ? 'positive' : 'negative'} delta. Default 55%`, fmt: v => `${v}%` },
    { label: 'CVD Consistency (R²)', key: 'deltaRangeMinR2', value: condition.deltaRangeMinR2 ?? 0.5, min: 0.2, max: 0.95, step: 0.05, hint: 'How steadily cumulative delta climbs. Higher = stricter. Default 0.5', fmt: v => v.toFixed(2) },
    { label: 'Min Score', key: 'deltaRangeMinScore', value: condition.deltaRangeMinScore ?? 50, min: 0, max: 90, step: 5, hint: 'Minimum setup confidence. Default 50' },
  ];

  return (
    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border/50">
      <div className="text-sm font-medium text-primary">{feature.name}</div>
      <p className="text-xs text-muted-foreground p-3 bg-background/50 rounded-md">
        {accum
          ? 'Price is stuck in a range while taker buy delta keeps rising candle after candle. Buyers are absorbing supply before an upside breakout.'
          : 'Price is stuck in a range while taker sell delta keeps rising candle after candle. Sellers are distributing before a downside breakdown.'}
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
    </div>
  );
}
