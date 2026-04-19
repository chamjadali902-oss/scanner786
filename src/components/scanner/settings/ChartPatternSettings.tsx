import { ScanCondition, FeatureDefinition } from '@/types/scanner';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';

interface ChartPatternSettingsProps {
  condition: ScanCondition;
  feature: FeatureDefinition;
  onUpdate: (updates: Partial<ScanCondition>) => void;
  disabled?: boolean;
}

const BULLISH_IDS = new Set([
  'cp_double_bottom',
  'cp_triple_bottom',
  'cp_inverse_head_shoulders',
  'cp_ascending_triangle',
  'cp_falling_wedge',
  'cp_rectangle_breakout_bull',
]);

const BEARISH_IDS = new Set([
  'cp_double_top',
  'cp_triple_top',
  'cp_head_shoulders',
  'cp_descending_triangle',
  'cp_rising_wedge',
  'cp_rectangle_breakout_bear',
]);

export function ChartPatternSettings({ condition, feature, onUpdate, disabled }: ChartPatternSettingsProps) {
  const lookback = condition.chartPatternLookback ?? 80;
  const isBullish = BULLISH_IDS.has(feature.id);
  const isBearish = BEARISH_IDS.has(feature.id);

  return (
    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border/50">
      <div className="text-sm font-medium text-primary">{feature.name}</div>

      <div className="p-3 bg-background/50 rounded-md space-y-2">
        <p className="text-sm">{feature.description}</p>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            isBullish ? 'bg-chart-1/20 text-chart-1'
              : isBearish ? 'bg-destructive/20 text-destructive'
              : 'bg-muted text-muted-foreground'
          }`}>
            {isBullish ? '🟢 Bullish Pattern' : isBearish ? '🔴 Bearish Pattern' : '⚪ Neutral'}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-chart-4/20 text-chart-4">
            Chart Pattern
          </span>
        </div>
      </div>

      {/* Lookback Window */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">Detection Window (Candles)</Label>
          <span className="text-xs font-mono text-primary">{lookback}</span>
        </div>
        <div className="flex items-center gap-3">
          <Slider
            value={[lookback]}
            onValueChange={([v]) => onUpdate({ chartPatternLookback: v })}
            min={20}
            max={200}
            step={5}
            disabled={disabled}
            className="flex-1"
          />
          <Input
            type="number"
            value={lookback}
            onChange={(e) => onUpdate({ chartPatternLookback: Math.max(20, Math.min(300, Number(e.target.value))) })}
            min={20}
            max={300}
            className="h-8 text-xs font-mono w-20"
            disabled={disabled}
          />
        </div>
        <p className="text-[10px] text-muted-foreground">
          Pattern dhoondnay kyly kitni recent candles scan ho. Default: 80
        </p>
      </div>

      <div className="p-2 bg-muted/40 rounded text-[10px] text-muted-foreground space-y-1">
        <p className="font-medium text-foreground/70">💡 Pro tip:</p>
        <p>Iss pattern ko Fibonacci ke saath link karne ke liye, Fibonacci condition add karein aur "Source" ko "<span className="text-primary">{feature.name}</span>" set karein. Pullback Fib levels iss pattern ke swing high/low se calculate honge.</p>
      </div>
    </div>
  );
}
