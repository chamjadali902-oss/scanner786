import { ScanCondition, FeatureDefinition } from '@/types/scanner';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';

interface Props {
  condition: ScanCondition;
  feature: FeatureDefinition;
  onUpdate: (updates: Partial<ScanCondition>) => void;
  disabled?: boolean;
}

export function ImpulseMoveSettings({ condition, feature, onUpdate, disabled }: Props) {
  const minImp = condition.impulseMinCandles ?? 2;
  const lookback = condition.impulseLookback ?? 30;
  const maxAge = condition.impulseMaxAge ?? 10;
  const tol = condition.impulseRetestTolerance ?? 0;
  const requireBreak = condition.impulseRequireBreak ?? true;
  const isBullish = feature.id === 'impulse_bullish';

  return (
    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border/50">
      <div className="text-sm font-medium text-primary">{feature.name}</div>

      <div className="p-3 bg-background/50 rounded-md space-y-2">
        <p className="text-xs text-muted-foreground">
          {isBullish ? (
            <>🟢 <b>Buy setup</b>: Pehle ek <b>red candle</b> bani, phir uske bad <b>{minImp}+ green candles</b> ne use break kiya. Price ne abhi tk red candle ke <b>high</b> ko retest nahi kiya.</>
          ) : (
            <>🔴 <b>Sell setup</b>: Pehle ek <b>green candle</b> bani, phir uske bad <b>{minImp}+ red candles</b> ne use break kiya. Price ne abhi tk green candle ke <b>low</b> ko retest nahi kiya.</>
          )}
        </p>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full ${isBullish ? 'bg-chart-1/20 text-chart-1' : 'bg-destructive/20 text-destructive'}`}>
            {isBullish ? 'Untested Bullish Impulse' : 'Untested Bearish Impulse'}
          </span>
        </div>
      </div>

      {/* Min impulse candles */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">Minimum Impulse Candles</Label>
          <span className="text-xs font-mono text-primary">{minImp}</span>
        </div>
        <Slider
          value={[minImp]} min={1} max={6} step={1}
          onValueChange={([v]) => onUpdate({ impulseMinCandles: v })}
          disabled={disabled}
        />
        <p className="text-[10px] text-muted-foreground">
          Kitni consecutive {isBullish ? 'green' : 'red'} candles base ko break karein. Default: 2
        </p>
      </div>

      {/* Lookback */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">Lookback Window (candles)</Label>
          <span className="text-xs font-mono text-primary">{lookback}</span>
        </div>
        <div className="flex items-center gap-3">
          <Slider
            value={[lookback]} min={10} max={100} step={5}
            onValueChange={([v]) => onUpdate({ impulseLookback: v })}
            disabled={disabled}
            className="flex-1"
          />
          <Input
            type="number" value={lookback}
            onChange={(e) => onUpdate({ impulseLookback: Math.max(5, Math.min(200, Number(e.target.value))) })}
            className="h-8 text-xs font-mono w-20" disabled={disabled}
          />
        </div>
        <p className="text-[10px] text-muted-foreground">Kitni recent candles me setup dhoondna. Default: 30</p>
      </div>

      {/* Max age */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">Max Age (candles since impulse)</Label>
          <span className="text-xs font-mono text-primary">{maxAge}</span>
        </div>
        <Slider
          value={[maxAge]} min={0} max={30} step={1}
          onValueChange={([v]) => onUpdate({ impulseMaxAge: v })}
          disabled={disabled}
        />
        <p className="text-[10px] text-muted-foreground">Impulse khatam huye max kitni candles guzri hon. Fresh setup: 5-10</p>
      </div>

      {/* Retest tolerance */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">Retest Tolerance (%)</Label>
          <span className="text-xs font-mono text-primary">{tol.toFixed(2)}%</span>
        </div>
        <Slider
          value={[tol]} min={0} max={2} step={0.05}
          onValueChange={([v]) => onUpdate({ impulseRetestTolerance: v })}
          disabled={disabled}
        />
        <p className="text-[10px] text-muted-foreground">
          0% = bilkul touch nahi hua chahiye. Aap thora margin de saktay hain (e.g. 0.2%).
        </p>
      </div>

      {/* Require break */}
      <div className="flex items-center justify-between p-3 bg-background/50 rounded-md">
        <div className="space-y-1 pr-3">
          <Label className="text-xs">Require Break of Base</Label>
          <p className="text-[10px] text-muted-foreground">
            Impulse candles ka close base candle ke {isBullish ? 'high se upar' : 'low se neeche'} hona chahiye.
          </p>
        </div>
        <Switch
          checked={requireBreak}
          onCheckedChange={(v) => onUpdate({ impulseRequireBreak: v })}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
