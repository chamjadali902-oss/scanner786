import { ScanCondition, FEATURES } from '@/types/scanner';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface FibonacciSettingsProps {
  condition: ScanCondition;
  onUpdate: (updates: Partial<ScanCondition>) => void;
  disabled?: boolean;
}

const FIB_LEVELS = [
  { value: '0', label: '0% (Swing High/Low)' },
  { value: '0.236', label: '23.6%' },
  { value: '0.382', label: '38.2%' },
  { value: '0.5', label: '50%' },
  { value: '0.618', label: '61.8% (Golden Ratio)' },
  { value: '0.786', label: '78.6%' },
  { value: '1', label: '100% (Full Retracement)' },
];

const CHART_PATTERN_FEATURES = FEATURES.filter(f => f.category === 'chart');
const SMC_DIRECTIONAL_FEATURES = FEATURES.filter(
  f => f.category === 'smc' && !['premium_zone', 'discount_zone', 'volume_spike', 'uptrend', 'downtrend'].includes(f.id)
);

export function FibonacciSettings({ condition, onUpdate, disabled }: FibonacciSettingsProps) {
  const lookback = condition.fibLookback ?? 50;
  const level = condition.fibLevel ?? '0.618';
  const proximity = condition.fibProximityPercent ?? 1;
  const fibSource = condition.fibSource ?? 'lookback';
  const pullbackMode = condition.fibPullbackMode ?? 'proximity';
  const linkMaxAge = condition.fibLinkMaxAge ?? 30;
  const fromLevel = condition.fibSequentialFromLevel ?? '0.5';
  const toLevel = condition.fibSequentialToLevel ?? '0.618';
  const seqMaxAge = condition.fibSequentialMaxAge ?? 20;

  return (
    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border/50">
      <div className="text-sm font-medium text-primary">Fibonacci Retracement Settings</div>

      {/* Source of Swing High/Low */}
      <div className="space-y-2 p-3 bg-background/50 rounded-md border border-border/30">
        <Label className="text-xs font-medium">Swing Source (Fib kis se compute ho)</Label>
        <Select
          value={fibSource}
          onValueChange={(v) => onUpdate({ fibSource: v as 'lookback' | 'pattern' | 'smc', fibSourceFeature: undefined })}
          disabled={disabled}
        >
          <SelectTrigger className="h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="lookback">Lookback Window (default — recent N candles)</SelectItem>
            <SelectItem value="pattern">Chart Pattern ke swing se (W, H&S, etc.)</SelectItem>
            <SelectItem value="smc">SMC ke swing se (BOS, ChoCH, etc.)</SelectItem>
          </SelectContent>
        </Select>

        {fibSource === 'lookback' && (
          <div className="space-y-2 pt-2">
            <Label className="text-xs text-muted-foreground">Lookback Period (Candles)</Label>
            <div className="flex items-center gap-3">
              <Slider
                value={[lookback]}
                onValueChange={([v]) => onUpdate({ fibLookback: v })}
                min={10}
                max={200}
                step={5}
                disabled={disabled}
                className="flex-1"
              />
              <Input
                type="number"
                value={lookback}
                onChange={(e) => onUpdate({ fibLookback: Math.max(10, Math.min(500, Number(e.target.value))) })}
                min={10}
                max={500}
                className="h-8 text-xs font-mono w-20"
                disabled={disabled}
              />
            </div>
          </div>
        )}

        {(fibSource === 'pattern' || fibSource === 'smc') && (
          <div className="space-y-2 pt-2">
            <Label className="text-xs text-muted-foreground">
              {fibSource === 'pattern' ? 'Linked Chart Pattern' : 'Linked SMC Concept'}
            </Label>
            <Select
              value={condition.fibSourceFeature ?? ''}
              onValueChange={(v) => onUpdate({ fibSourceFeature: v })}
              disabled={disabled}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Select source pattern…" />
              </SelectTrigger>
              <SelectContent>
                {(fibSource === 'pattern' ? CHART_PATTERN_FEATURES : SMC_DIRECTIONAL_FEATURES).map(f => (
                  <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="space-y-1 pt-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Max Pattern Age (candles)</Label>
                <span className="text-xs font-mono text-primary">{linkMaxAge}</span>
              </div>
              <Slider
                value={[linkMaxAge]}
                onValueChange={([v]) => onUpdate({ fibLinkMaxAge: v })}
                min={5}
                max={100}
                step={1}
                disabled={disabled}
              />
              <p className="text-[10px] text-muted-foreground">
                Source pattern itni candles ke andar bana hona chahiye
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Pullback Mode */}
      <div className="space-y-2 p-3 bg-background/50 rounded-md border border-border/30">
        <Label className="text-xs font-medium">Pullback Mode</Label>
        <Select
          value={pullbackMode}
          onValueChange={(v) => onUpdate({ fibPullbackMode: v as 'proximity' | 'sequential' })}
          disabled={disabled}
        >
          <SelectTrigger className="h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="proximity">Proximity (price specific Fib level ke paas ho)</SelectItem>
            <SelectItem value="sequential">Sequential (level X touch karke level Y pe gaya)</SelectItem>
          </SelectContent>
        </Select>

        {pullbackMode === 'proximity' && (
          <div className="space-y-3 pt-2">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Target Fib Level</Label>
              <Select value={level} onValueChange={(v) => onUpdate({ fibLevel: v })} disabled={disabled}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FIB_LEVELS.map(fl => <SelectItem key={fl.value} value={fl.value}>{fl.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Proximity Threshold (%)</Label>
                <span className="text-xs font-mono text-primary">{proximity}%</span>
              </div>
              <div className="flex items-center gap-3">
                <Slider
                  value={[proximity]}
                  onValueChange={([v]) => onUpdate({ fibProximityPercent: v })}
                  min={0.1}
                  max={5}
                  step={0.1}
                  disabled={disabled}
                  className="flex-1"
                />
                <Input
                  type="number"
                  value={proximity}
                  onChange={(e) => onUpdate({ fibProximityPercent: Math.max(0.1, Math.min(10, Number(e.target.value))) })}
                  min={0.1}
                  max={10}
                  step={0.1}
                  className="h-8 text-xs font-mono w-20"
                  disabled={disabled}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Price Position Filter</Label>
              <Select
                value={condition.pricePosition || 'above'}
                onValueChange={(v) => onUpdate({ pricePosition: v as 'above' | 'below' })}
                disabled={disabled}
              >
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="above">Near level from above (Bullish retest)</SelectItem>
                  <SelectItem value="below">Near level from below (Bearish rejection)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {pullbackMode === 'sequential' && (
          <div className="space-y-3 pt-2">
            <p className="text-[10px] text-muted-foreground">
              Price ne pehle "From" level touch kiya, phir "To" level pe pohnchi (ya us ke paas hai). Useful: BOS hua → 0.5 retraced → ab 0.618 hit kar raha.
            </p>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">From Level (pehle touch)</Label>
              <Select value={fromLevel} onValueChange={(v) => onUpdate({ fibSequentialFromLevel: v })} disabled={disabled}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FIB_LEVELS.map(fl => <SelectItem key={fl.value} value={fl.value}>{fl.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">To Level (phir yahan jaye)</Label>
              <Select value={toLevel} onValueChange={(v) => onUpdate({ fibSequentialToLevel: v })} disabled={disabled}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FIB_LEVELS.map(fl => <SelectItem key={fl.value} value={fl.value}>{fl.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Sequence Window (candles)</Label>
                <span className="text-xs font-mono text-primary">{seqMaxAge}</span>
              </div>
              <Slider
                value={[seqMaxAge]}
                onValueChange={([v]) => onUpdate({ fibSequentialMaxAge: v })}
                min={3}
                max={50}
                step={1}
                disabled={disabled}
              />
              <p className="text-[10px] text-muted-foreground">
                Itni candles ke andar From → To sequence complete hona chahiye
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Final Touch Proximity (%)</Label>
                <span className="text-xs font-mono text-primary">{proximity}%</span>
              </div>
              <Slider
                value={[proximity]}
                onValueChange={([v]) => onUpdate({ fibProximityPercent: v })}
                min={0.1}
                max={5}
                step={0.1}
                disabled={disabled}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
