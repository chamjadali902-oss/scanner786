import { ScanCondition } from '@/types/scanner';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { TrendingUp, Activity, BarChart3, Volume2, ArrowUpCircle } from 'lucide-react';

interface SmartBullishSettingsProps {
  condition: ScanCondition;
  onUpdate: (updates: Partial<ScanCondition>) => void;
  disabled?: boolean;
}

export function SmartBullishSettings({ condition, onUpdate, disabled }: SmartBullishSettingsProps) {
  const lookback = condition.smartBullishLookback ?? 30;
  const threshold = condition.smartBullishThreshold ?? 60;

  return (
    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border/50">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium text-primary">Smart-Bullish Settings</span>
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Deeply analyzes each candle to detect when sellers are weakening and buyers are gaining control.
        Gives <strong>early signals</strong> before a big bullish move by measuring 5 key factors.
      </p>

      {/* Lookback Period */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Analysis Window (Candles)</Label>
        <div className="flex items-center gap-3">
          <Slider
            value={[lookback]}
            onValueChange={([v]) => onUpdate({ smartBullishLookback: v })}
            min={10}
            max={100}
            step={5}
            disabled={disabled}
            className="flex-1"
          />
          <Input
            type="number"
            value={lookback}
            onChange={(e) => onUpdate({ smartBullishLookback: Math.max(10, Math.min(200, Number(e.target.value))) })}
            min={10}
            max={200}
            className="h-8 text-xs font-mono w-20"
            disabled={disabled}
          />
        </div>
        <p className="text-[10px] text-muted-foreground">
          How many candles to analyze. More candles = more confirmation, fewer = earlier signal. Default: 30
        </p>
      </div>

      {/* Threshold */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Signal Threshold (Score 0-100)</Label>
        <div className="flex items-center gap-3">
          <Slider
            value={[threshold]}
            onValueChange={([v]) => onUpdate({ smartBullishThreshold: v })}
            min={30}
            max={90}
            step={5}
            disabled={disabled}
            className="flex-1"
          />
          <Input
            type="number"
            value={threshold}
            onChange={(e) => onUpdate({ smartBullishThreshold: Math.max(10, Math.min(100, Number(e.target.value))) })}
            min={10}
            max={100}
            className="h-8 text-xs font-mono w-20"
            disabled={disabled}
          />
        </div>
        <p className="text-[10px] text-muted-foreground">
          Minimum score to trigger signal. 75+ = Strong Buy, 60+ = Buy, 45+ = Neutral. Default: 60
        </p>
      </div>

      {/* Analysis Breakdown Info */}
      <div className="pt-3 border-t border-border/50 space-y-2">
        <Label className="text-xs text-muted-foreground uppercase tracking-wider">What It Analyzes</Label>
        <div className="grid grid-cols-1 gap-1.5">
          {[
            { icon: Activity, label: 'Seller Exhaustion', desc: 'Bearish candle bodies shrinking (25%)' },
            { icon: ArrowUpCircle, label: 'Buyer Absorption', desc: 'Lower wicks increasing = buyers absorbing sells (20%)' },
            { icon: TrendingUp, label: 'Momentum Shift', desc: 'Buyer power trend rising across candles (25%)' },
            { icon: Volume2, label: 'Volume Confirmation', desc: 'Higher volume on bullish vs bearish candles (15%)' },
            { icon: BarChart3, label: 'Price Recovery', desc: 'Closes trending higher + higher lows forming (15%)' },
          ].map(({ icon: Icon, label, desc }) => (
            <div key={label} className="flex items-start gap-2 text-[10px] text-muted-foreground">
              <Icon className="w-3 h-3 mt-0.5 text-primary/70 flex-shrink-0" />
              <span><strong className="text-foreground/80">{label}:</strong> {desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
