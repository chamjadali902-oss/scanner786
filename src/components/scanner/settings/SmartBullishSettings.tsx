import { ScanCondition } from '@/types/scanner';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { 
  TrendingUp, Target, Shield, Crosshair, ArrowDown, ArrowUp, Layers,
  CandlestickChart
} from 'lucide-react';

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
        <CandlestickChart className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium text-primary">Smart-Bullish v3</span>
        <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-medium">
          3-CANDLE BOTTOM
        </span>
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Detects a <strong>3-candle bottom reversal</strong> pattern with price targets.
        Finds liquidity grabs at strong bottoms for high-probability long entries.
      </p>

      {/* Pattern Explanation */}
      <div className="space-y-2 p-3 bg-background/50 rounded-md border border-border/30">
        <Label className="text-xs text-muted-foreground uppercase tracking-wider">Pattern Rules</Label>
        <div className="grid grid-cols-1 gap-2">
          <div className="flex items-start gap-2 text-[10px] text-muted-foreground">
            <span className="text-red-400 font-bold mt-0.5 flex-shrink-0">C1</span>
            <span><strong className="text-foreground/80">Red Candle:</strong> Bearish candle at a bottom — establishes the key low level</span>
          </div>
          <div className="flex items-start gap-2 text-[10px] text-muted-foreground">
            <span className="text-green-400 font-bold mt-0.5 flex-shrink-0">C2</span>
            <span><strong className="text-foreground/80">Liquidity Grab:</strong> Breaks below C1's low (grabs stops) then closes above C1's close — strong rejection</span>
          </div>
          <div className="flex items-start gap-2 text-[10px] text-muted-foreground">
            <span className="text-blue-400 font-bold mt-0.5 flex-shrink-0">C3</span>
            <span><strong className="text-foreground/80">Retest & Hold:</strong> Low equals C1's low (double bottom) and closes bullish — confirms buyers in control</span>
          </div>
        </div>
      </div>

      {/* Lookback Period */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Search Window (Candles)</Label>
        <div className="flex items-center gap-3">
          <Slider
            value={[lookback]}
            onValueChange={([v]) => onUpdate({ smartBullishLookback: v })}
            min={10} max={100} step={5}
            disabled={disabled}
            className="flex-1"
          />
          <Input
            type="number" value={lookback}
            onChange={(e) => onUpdate({ smartBullishLookback: Math.max(10, Math.min(200, Number(e.target.value))) })}
            min={10} max={200}
            className="h-8 text-xs font-mono w-20"
            disabled={disabled}
          />
        </div>
        <p className="text-[10px] text-muted-foreground">
          How many candles back to search for the 3-candle pattern. Default: 30
        </p>
      </div>

      {/* Threshold */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Quality Threshold (Score 0-100)</Label>
        <div className="flex items-center gap-3">
          <Slider
            value={[threshold]}
            onValueChange={([v]) => onUpdate({ smartBullishThreshold: v })}
            min={30} max={90} step={5}
            disabled={disabled}
            className="flex-1"
          />
          <Input
            type="number" value={threshold}
            onChange={(e) => onUpdate({ smartBullishThreshold: Math.max(10, Math.min(100, Number(e.target.value))) })}
            min={10} max={100}
            className="h-8 text-xs font-mono w-20"
            disabled={disabled}
          />
        </div>
        <p className="text-[10px] text-muted-foreground">
          85+ = Strong Buy, 70+ = Buy, 50+ = Neutral. Default: 60
        </p>
      </div>

      {/* What It Provides */}
      <div className="pt-3 border-t border-border/50 space-y-2">
        <Label className="text-xs text-muted-foreground uppercase tracking-wider">What You Get</Label>
        <div className="grid grid-cols-1 gap-1.5">
          {[
            { icon: Crosshair, label: 'Entry Price', desc: 'Current price when pattern is detected', color: 'text-blue-400' },
            { icon: Shield, label: 'Stop Loss', desc: 'Below nearest support + ATR buffer', color: 'text-red-400' },
            { icon: Target, label: '3 Take Profit Levels', desc: 'TP1 (conservative), TP2 (moderate), TP3 (aggressive)', color: 'text-green-400' },
            { icon: ArrowUp, label: 'Expected Move %', desc: 'Upside potential to TP2', color: 'text-emerald-400' },
            { icon: ArrowDown, label: 'Max Downside %', desc: 'Maximum loss if SL hits', color: 'text-orange-400' },
            { icon: Layers, label: 'Support/Resistance Zones', desc: 'Key zones from swing points + volume profile', color: 'text-purple-400' },
          ].map(({ icon: Icon, label, desc, color }) => (
            <div key={label} className="flex items-start gap-2 text-[10px] text-muted-foreground">
              <Icon className={`w-3 h-3 mt-0.5 ${color} flex-shrink-0`} />
              <span><strong className="text-foreground/80">{label}:</strong> {desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Score Bonuses */}
      <div className="pt-3 border-t border-border/50 space-y-2">
        <Label className="text-xs text-muted-foreground uppercase tracking-wider">Quality Score Factors</Label>
        <div className="grid grid-cols-1 gap-1">
          {[
            'Base 70 points when 3-candle pattern is found',
            'Bonus: Deeper C2 wick below C1 low (bigger liquidity grab)',
            'Bonus: C3 closes higher than C2 close (momentum)',
            'Bonus: Volume increases on C2 and C3 vs C1',
            'Bonus: More recent pattern gets higher priority',
          ].map((text) => (
            <p key={text} className="text-[9px] text-muted-foreground pl-3 border-l-2 border-primary/30">
              {text}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
