import { ScanCondition, FeatureDefinition } from '@/types/scanner';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

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
              {/* Liquidity Sweep Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs">Liquidity Sweep</Label>
                  <p className="text-[10px] text-muted-foreground">
                    {isBullish 
                      ? 'Candle wick pattern ke low ke neeche jaye'
                      : 'Candle wick pattern ke high ke upar jaye'}
                  </p>
                </div>
                <Switch
                  checked={condition.patternLiquiditySweep ?? true}
                  onCheckedChange={(checked) => onUpdate({ patternLiquiditySweep: checked })}
                  disabled={disabled}
                />
              </div>

              {/* Candle Close Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs">Candle Close</Label>
                  <p className="text-[10px] text-muted-foreground">
                    {isBullish 
                      ? 'Confirmation candle pattern ke close ke upar band ho'
                      : 'Confirmation candle pattern ke close ke neeche band ho'}
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
          ? 'Pattern + confirmation candle automatically detect hoga.'
          : 'Ye pattern latest candle par automatically detect hoga.'}
      </p>
    </div>
  );
}
