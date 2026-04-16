import { ScanCondition, FeatureDefinition } from '@/types/scanner';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface PatternSettingsProps {
  condition: ScanCondition;
  feature: FeatureDefinition;
  onUpdate: (updates: Partial<ScanCondition>) => void;
  disabled?: boolean;
}

export function PatternSettings({ condition, feature, onUpdate, disabled }: PatternSettingsProps) {
  const isBullish = feature.name.toLowerCase().includes('bullish') || 
                    ['hammer', 'morning_star', 'inverted_hammer', 'three_white_soldiers'].includes(feature.id);
  const isBearish = feature.name.toLowerCase().includes('bearish') || 
                    ['shooting_star', 'evening_star', 'three_black_crows'].includes(feature.id);
  const isDirectional = isBullish || isBearish;

  const lookback = condition.patternConfirmLookback ?? 2;
  const sweepType = condition.patternSweepType ?? 'wick';

  return (
    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border/50">
      <div className="text-sm font-medium text-primary">{feature.name}</div>
      
      <div className="p-3 bg-background/50 rounded-md space-y-2">
        <p className="text-sm">{feature.description}</p>
        
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            isBullish ? 'bg-chart-1/20 text-chart-1' : 
            isBearish ? 'bg-destructive/20 text-destructive' : 
            'bg-muted text-muted-foreground'
          }`}>
            {isBullish ? 'Bullish Signal' : isBearish ? 'Bearish Signal' : 'Neutral/Indecision'}
          </span>
        </div>
      </div>

      {/* Confirmation Settings - only for directional patterns */}
      {isDirectional && (
        <div className="space-y-3 p-3 bg-background/50 rounded-md border border-border/30">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Confirmation</Label>
            <Switch
              checked={condition.patternConfirmation ?? false}
              onCheckedChange={(checked) => onUpdate({ patternConfirmation: checked })}
              disabled={disabled}
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            {isBullish 
              ? 'Pattern banne ke baad confirmation candle check karo — sweep neeche aur close upar'
              : 'Pattern banne ke baad confirmation candle check karo — sweep upar aur close neeche'}
          </p>

          {condition.patternConfirmation && (
            <div className="space-y-3 pl-2 border-l-2 border-primary/30">
              {/* Lookback Window */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Confirmation Window</Label>
                  <span className="text-xs font-mono text-primary">{lookback} candles</span>
                </div>
                <Slider
                  value={[lookback]}
                  onValueChange={([v]) => onUpdate({ patternConfirmLookback: v })}
                  min={2}
                  max={7}
                  step={1}
                  disabled={disabled}
                />
                <p className="text-[10px] text-muted-foreground">
                  Pattern ke baad kitni candles mein confirmation dhundna hai (2-7)
                </p>
              </div>

              {/* Liquidity Sweep Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs">Liquidity Sweep</Label>
                  <p className="text-[10px] text-muted-foreground">
                    {isBullish 
                      ? 'Candle pattern ke low ke neeche jaye'
                      : 'Candle pattern ke high ke upar jaye'}
                  </p>
                </div>
                <Switch
                  checked={condition.patternLiquiditySweep ?? true}
                  onCheckedChange={(checked) => onUpdate({ patternLiquiditySweep: checked })}
                  disabled={disabled}
                />
              </div>

              {/* Sweep Type Selection */}
              {(condition.patternLiquiditySweep ?? true) && (
                <div className="space-y-2">
                  <Label className="text-xs">Sweep Detection Method</Label>
                  <Select
                    value={sweepType}
                    onValueChange={(v) => onUpdate({ patternSweepType: v as 'wick' | 'close' | 'both' })}
                    disabled={disabled}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="wick">Wick Only (Sirf wick se sweep)</SelectItem>
                      <SelectItem value="close">Close Only (Candle close se sweep)</SelectItem>
                      <SelectItem value="both">Both (Wick ya Close dono se)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">
                    {sweepType === 'wick' && 'Sirf wick/shadow se liquidity sweep detect hogi'}
                    {sweepType === 'close' && 'Candle ka close pattern ke level ke neeche/upar hona chahiye'}
                    {sweepType === 'both' && 'Wick ya candle close — dono tareeqe se sweep detect hogi'}
                  </p>
                </div>
              )}

              {/* Candle Close Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs">Candle Close</Label>
                  <p className="text-[10px] text-muted-foreground">
                    {isBullish 
                      ? 'Last confirmation candle pattern ke close ke upar band ho'
                      : 'Last confirmation candle pattern ke close ke neeche band ho'}
                  </p>
                </div>
                <Switch
                  checked={condition.patternCandleClose ?? true}
                  onCheckedChange={(checked) => onUpdate({ patternCandleClose: checked })}
                  disabled={disabled}
                />
              </div>
            </div>
          )}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground">
        {condition.patternConfirmation 
          ? `Pattern + ${lookback} candles ke andar confirmation check hogi.`
          : 'Ye pattern latest candle par automatically detect hoga.'}
      </p>
    </div>
  );
}
