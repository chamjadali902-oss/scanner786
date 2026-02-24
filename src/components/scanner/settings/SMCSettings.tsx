import { ScanCondition, FeatureDefinition } from '@/types/scanner';

interface SMCSettingsProps {
  condition: ScanCondition;
  feature: FeatureDefinition;
  onUpdate: (updates: Partial<ScanCondition>) => void;
  disabled?: boolean;
}

export function SMCSettings({ feature }: SMCSettingsProps) {
  const isBullish = feature.id.includes('bullish') || feature.id === 'discount_zone';
  const isBearish = feature.id.includes('bearish') || feature.id === 'premium_zone';

  const getExplanation = () => {
    switch (feature.id) {
      case 'bos_bullish':
        return 'Break of Structure occurs when price breaks above a previous swing high, indicating bullish momentum.';
      case 'bos_bearish':
        return 'Break of Structure occurs when price breaks below a previous swing low, indicating bearish momentum.';
      case 'choch_bullish':
        return 'Change of Character occurs when a bearish trend shifts to bullish by breaking structure.';
      case 'choch_bearish':
        return 'Change of Character occurs when a bullish trend shifts to bearish by breaking structure.';
      case 'bullish_ob':
        return 'Order Block is the last bearish candle before a strong bullish move. Acts as future support.';
      case 'bearish_ob':
        return 'Order Block is the last bullish candle before a strong bearish move. Acts as future resistance.';
      case 'bullish_fvg':
        return 'Fair Value Gap (bullish) is a price gap where selling was exhausted. Price often returns to fill it.';
      case 'bearish_fvg':
        return 'Fair Value Gap (bearish) is a price gap where buying was exhausted. Price often returns to fill it.';
      case 'liquidity_sweep_high':
        return 'Liquidity sweep above previous high - smart money grabbing stop losses before reversal.';
      case 'liquidity_sweep_low':
        return 'Liquidity sweep below previous low - smart money grabbing stop losses before reversal.';
      case 'equal_highs':
        return 'Equal highs indicate resting liquidity above - likely target for smart money.';
      case 'equal_lows':
        return 'Equal lows indicate resting liquidity below - likely target for smart money.';
      case 'premium_zone':
        return 'Price is in premium zone (above 50% of range) - typically better for selling.';
      case 'discount_zone':
        return 'Price is in discount zone (below 50% of range) - typically better for buying.';
      case 'breaker_block':
        return 'Failed Order Block that was broken through - now acts as the opposite type of S/R.';
      case 'volume_spike':
        return 'Volume Spike detects when current candle volume is 2x or more than the 20-period average - often confirms breakouts, reversals, or smart money activity.';
      case 'uptrend':
        return 'Uptrend is confirmed when price makes valid Higher Highs (HH) and Higher Lows (HL) based on swing points. This is the foundation of bullish market structure.';
      case 'downtrend':
        return 'Downtrend is confirmed when price makes valid Lower Highs (LH) and Lower Lows (LL) based on swing points. This is the foundation of bearish market structure.';
      default:
        return feature.description;
    }
  };

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
        
        <p className="text-sm leading-relaxed">
          {getExplanation()}
        </p>
        
        <p className="text-[10px] text-muted-foreground">
          This concept will be automatically detected based on recent price action structure.
        </p>
      </div>
    </div>
  );
}
