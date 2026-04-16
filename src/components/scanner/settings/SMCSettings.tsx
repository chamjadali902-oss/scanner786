import { ScanCondition, FeatureDefinition } from '@/types/scanner';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface SMCSettingsProps {
  condition: ScanCondition;
  feature: FeatureDefinition;
  onUpdate: (updates: Partial<ScanCondition>) => void;
  disabled?: boolean;
}

export function SMCSettings({ condition, feature, onUpdate, disabled }: SMCSettingsProps) {
  const isBullish = feature.id.includes('bullish') || feature.id === 'discount_zone' || 
                    feature.id === 'liquidity_sweep_low' || feature.id === 'equal_lows' || feature.id === 'uptrend';
  const isBearish = feature.id.includes('bearish') || feature.id === 'premium_zone' || 
                    feature.id === 'liquidity_sweep_high' || feature.id === 'equal_highs' || feature.id === 'downtrend';
  const isTrend = feature.id === 'uptrend' || feature.id === 'downtrend';
  const isDirectional = (isBullish || isBearish) && !isTrend;

  const smcLookback = condition.smcConfirmLookback ?? 2;
  const smcSweepType = condition.smcSweepType ?? 'wick';

  const getExplanation = () => {
    switch (feature.id) {
      case 'bos_bullish': return 'Break of Structure occurs when price breaks above a previous swing high, indicating bullish momentum.';
      case 'bos_bearish': return 'Break of Structure occurs when price breaks below a previous swing low, indicating bearish momentum.';
      case 'choch_bullish': return 'Change of Character occurs when a bearish trend shifts to bullish by breaking structure.';
      case 'choch_bearish': return 'Change of Character occurs when a bullish trend shifts to bearish by breaking structure.';
      case 'bullish_ob': return 'Order Block is the last bearish candle before a strong bullish move. Acts as future support.';
      case 'bearish_ob': return 'Order Block is the last bullish candle before a strong bearish move. Acts as future resistance.';
      case 'bullish_fvg': return 'Fair Value Gap (bullish) is a price gap where selling was exhausted. Price often returns to fill it.';
      case 'bearish_fvg': return 'Fair Value Gap (bearish) is a price gap where buying was exhausted. Price often returns to fill it.';
      case 'liquidity_sweep_high': return 'Liquidity sweep above previous high - smart money grabbing stop losses before reversal.';
      case 'liquidity_sweep_low': return 'Liquidity sweep below previous low - smart money grabbing stop losses before reversal.';
      case 'equal_highs': return 'Equal highs indicate resting liquidity above - likely target for smart money.';
      case 'equal_lows': return 'Equal lows indicate resting liquidity below - likely target for smart money.';
      case 'premium_zone': return 'Price is in premium zone (above 50% of range) - typically better for selling.';
      case 'discount_zone': return 'Price is in discount zone (below 50% of range) - typically better for buying.';
      case 'breaker_block': return 'Failed Order Block that was broken through - now acts as the opposite type of S/R.';
      case 'volume_spike': return 'Volume Spike detects when current candle volume is 2x or more than the 20-period average.';
      case 'uptrend': return 'Uptrend is confirmed when price makes valid Higher Highs (HH) and Higher Lows (HL) with valid Fibonacci pullback retracement.';
      case 'downtrend': return 'Downtrend is confirmed when price makes valid Lower Highs (LH) and Lower Lows (LL) with valid Fibonacci pullback retracement.';
      default: return feature.description;
    }
  };

  const minRetracement = condition.trendMinRetracement ?? 25;
  const bosCount = condition.trendBosCount ?? 2;

  return (
    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border/50">
      <div className="text-sm font-medium text-primary">{feature.name}</div>
      
      <div className="p-3 bg-background/50 rounded-md space-y-3">
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            isBullish ? 'bg-chart-1/20 text-chart-1' : 
            isBearish ? 'bg-destructive/20 text-destructive' : 
            'bg-muted text-muted-foreground'
          }`}>
            {isBullish ? 'Bullish Bias' : isBearish ? 'Bearish Bias' : 'Neutral'}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-chart-5/20 text-chart-5">
            Smart Money Concept
          </span>
        </div>
        
        <p className="text-sm leading-relaxed">{getExplanation()}</p>
        
        <p className="text-[10px] text-muted-foreground">
          This concept will be automatically detected based on recent price action structure.
        </p>
      </div>

      {/* SMC Confirmation - for directional non-trend SMC features */}
      {isDirectional && (
        <div className="space-y-3 p-3 bg-background/50 rounded-md border border-border/30">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Confirmation</Label>
            <Switch
              checked={condition.smcConfirmation ?? false}
              onCheckedChange={(checked) => onUpdate({ smcConfirmation: checked })}
              disabled={disabled}
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            {isBullish 
              ? 'SMC signal ke baad confirmation check karo — sweep neeche aur close upar'
              : 'SMC signal ke baad confirmation check karo — sweep upar aur close neeche'}
          </p>

          {condition.smcConfirmation && (
            <div className="space-y-3 pl-2 border-l-2 border-primary/30">
              {/* Lookback Window */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Confirmation Window</Label>
                  <span className="text-xs font-mono text-primary">{smcLookback} candles</span>
                </div>
                <Slider
                  value={[smcLookback]}
                  onValueChange={([v]) => onUpdate({ smcConfirmLookback: v })}
                  min={2}
                  max={7}
                  step={1}
                  disabled={disabled}
                />
                <p className="text-[10px] text-muted-foreground">
                  SMC signal ke baad kitni candles mein confirmation dhundna hai (2-7)
                </p>
              </div>

              {/* Liquidity Sweep Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs">Liquidity Sweep</Label>
                  <p className="text-[10px] text-muted-foreground">
                    {isBullish 
                      ? 'Candle SMC signal ke low ke neeche jaye'
                      : 'Candle SMC signal ke high ke upar jaye'}
                  </p>
                </div>
                <Switch
                  checked={condition.smcLiquiditySweep ?? true}
                  onCheckedChange={(checked) => onUpdate({ smcLiquiditySweep: checked })}
                  disabled={disabled}
                />
              </div>

              {/* Sweep Type Selection */}
              {(condition.smcLiquiditySweep ?? true) && (
                <div className="space-y-2">
                  <Label className="text-xs">Sweep Detection Method</Label>
                  <Select
                    value={smcSweepType}
                    onValueChange={(v) => onUpdate({ smcSweepType: v as 'wick' | 'close' | 'both' })}
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
                    {smcSweepType === 'wick' && 'Sirf wick/shadow se liquidity sweep detect hogi'}
                    {smcSweepType === 'close' && 'Candle ka close signal ke level ke neeche/upar hona chahiye'}
                    {smcSweepType === 'both' && 'Wick ya candle close — dono tareeqe se sweep detect hogi'}
                  </p>
                </div>
              )}

              {/* Candle Close Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs">Candle Close</Label>
                  <p className="text-[10px] text-muted-foreground">
                    {isBullish 
                      ? 'Last confirmation candle SMC signal ke close ke upar band ho'
                      : 'Last confirmation candle SMC signal ke close ke neeche band ho'}
                  </p>
                </div>
                <Switch
                  checked={condition.smcCandleClose ?? true}
                  onCheckedChange={(checked) => onUpdate({ smcCandleClose: checked })}
                  disabled={disabled}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {isTrend && (
        <div className="space-y-4 pt-2 border-t border-border/50">
          {/* Min Fibonacci Retracement */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Minimum Pullback Retracement (%)</Label>
            <div className="flex items-center gap-3">
              <Slider
                value={[minRetracement]}
                onValueChange={([v]) => onUpdate({ trendMinRetracement: v })}
                min={5}
                max={78.6}
                step={1}
                disabled={disabled}
                className="flex-1"
              />
              <Input
                type="number"
                value={minRetracement}
                onChange={(e) => onUpdate({ trendMinRetracement: Math.max(5, Math.min(100, Number(e.target.value))) })}
                min={5}
                max={100}
                step={1}
                className="h-8 text-xs font-mono w-20"
                disabled={disabled}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              Pullback ko previous impulse ka kam az kam {minRetracement}% retrace karna chahiye. Default: 25%
            </p>
          </div>

          {/* BOS Count */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Break of Structure Count</Label>
            <div className="flex items-center gap-3">
              <Slider
                value={[bosCount]}
                onValueChange={([v]) => onUpdate({ trendBosCount: v })}
                min={1}
                max={5}
                step={1}
                disabled={disabled}
                className="flex-1"
              />
              <Input
                type="number"
                value={bosCount}
                onChange={(e) => onUpdate({ trendBosCount: Math.max(1, Math.min(5, Number(e.target.value))) })}
                min={1}
                max={5}
                step={1}
                className="h-8 text-xs font-mono w-20"
                disabled={disabled}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              Trend confirm karne ke liye kitne BOS chahiye. Default: 2
            </p>
          </div>

          <div className="p-2 bg-muted/50 rounded text-[10px] text-muted-foreground space-y-1">
            <p className="font-medium text-foreground/70">
              {feature.id === 'uptrend' ? '📈 Uptrend Detection:' : '📉 Downtrend Detection:'}
            </p>
            <p>• {bosCount} consecutive {feature.id === 'uptrend' ? 'Higher Highs + Higher Lows' : 'Lower Lows + Lower Highs'} required</p>
            <p>• Har pullback ka minimum {minRetracement}% Fibonacci retracement hona chahiye</p>
          </div>
        </div>
      )}

      {isDirectional && (
        <p className="text-[10px] text-muted-foreground">
          {condition.smcConfirmation 
            ? `${feature.name} + ${smcLookback} candles ke andar confirmation check hogi.`
            : `${feature.name} latest price action par automatically detect hoga.`}
        </p>
      )}
    </div>
  );
}
