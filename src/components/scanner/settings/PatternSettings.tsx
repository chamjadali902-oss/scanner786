import { ScanCondition, FeatureDefinition } from '@/types/scanner';

interface PatternSettingsProps {
  condition: ScanCondition;
  feature: FeatureDefinition;
  onUpdate: (updates: Partial<ScanCondition>) => void;
  disabled?: boolean;
}

export function PatternSettings({ feature }: PatternSettingsProps) {
  const isBullish = feature.name.toLowerCase().includes('bullish') || 
                    ['hammer', 'morning_star', 'inverted_hammer', 'three_white_soldiers'].includes(feature.id);
  const isBearish = feature.name.toLowerCase().includes('bearish') || 
                    ['shooting_star', 'evening_star', 'three_black_crows'].includes(feature.id);

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
        
        <p className="text-[10px] text-muted-foreground mt-2">
          This pattern will be automatically detected when it forms on the latest candle.
        </p>
      </div>
    </div>
  );
}
