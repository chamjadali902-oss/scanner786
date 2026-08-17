import { ScanCondition, FeatureDefinition } from '@/types/scanner';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

interface Props {
  condition: ScanCondition;
  feature: FeatureDefinition;
  onUpdate: (updates: Partial<ScanCondition>) => void;
  disabled?: boolean;
}

export function BreakoutSettings({ condition, feature, onUpdate, disabled }: Props) {
  const isFake = feature.id.startsWith('fake_');

  const num = (v: string, fallback: number) => {
    const n = parseFloat(v);
    return isNaN(n) ? fallback : n;
  };

  return (
    <div className="space-y-3 pt-2">
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {isFake
          ? 'Trap detector: level break hone ke baad volume, rejection wick, range-reclaim aur follow-through check karke fake breakout confirm karta hai — reverse trade ke liye.'
          : 'Validated breakout: body close beyond level + volume expansion + follow-through hold zaroori.'}
      </p>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Range lookback</Label>
          <Input
            type="number" min={20} max={300} disabled={disabled}
            value={condition.breakoutLookback ?? 60}
            onChange={(e) => onUpdate({ breakoutLookback: num(e.target.value, 60) })}
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Max age (candles)</Label>
          <Input
            type="number" min={1} max={30} disabled={disabled}
            value={condition.breakoutMaxAge ?? 6}
            onChange={(e) => onUpdate({ breakoutMaxAge: num(e.target.value, 6) })}
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Volume multiplier</Label>
          <Input
            type="number" step={0.1} min={0.5} max={10} disabled={disabled}
            value={condition.breakoutVolumeMultiplier ?? 1.5}
            onChange={(e) => onUpdate({ breakoutVolumeMultiplier: num(e.target.value, 1.5) })}
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Level tolerance %</Label>
          <Input
            type="number" step={0.01} min={0} max={2} disabled={disabled}
            value={condition.breakoutTolerance ?? 0.05}
            onChange={(e) => onUpdate({ breakoutTolerance: num(e.target.value, 0.05) })}
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Min score</Label>
          <Input
            type="number" min={10} max={100} disabled={disabled}
            value={condition.breakoutMinScore ?? (isFake ? 50 : 55)}
            onChange={(e) => onUpdate({ breakoutMinScore: num(e.target.value, isFake ? 50 : 55) })}
            className="h-8 text-xs"
          />
        </div>
        {isFake ? (
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Confirm candles</Label>
            <Input
              type="number" min={1} max={10} disabled={disabled}
              value={condition.breakoutConfirmCandles ?? 3}
              onChange={(e) => onUpdate({ breakoutConfirmCandles: num(e.target.value, 3) })}
              className="h-8 text-xs"
            />
          </div>
        ) : (
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Min body ratio</Label>
            <Input
              type="number" step={0.05} min={0} max={1} disabled={disabled}
              value={condition.breakoutMinBodyRatio ?? 0.5}
              onChange={(e) => onUpdate({ breakoutMinBodyRatio: num(e.target.value, 0.5) })}
              className="h-8 text-xs"
            />
          </div>
        )}
      </div>

      {!isFake && (
        <div className="flex items-center justify-between rounded-lg bg-muted/40 px-2 py-1.5">
          <Label className="text-[11px]">Follow-through hold required</Label>
          <Switch
            disabled={disabled}
            checked={condition.breakoutRequireHold ?? true}
            onCheckedChange={(v) => onUpdate({ breakoutRequireHold: v })}
          />
        </div>
      )}
    </div>
  );
}
