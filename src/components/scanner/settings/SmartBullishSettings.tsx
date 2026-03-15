import { ScanCondition } from '@/types/scanner';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { 
  TrendingUp, Activity, BarChart3, Volume2, ArrowUpCircle, 
  Target, Shield, Crosshair, ArrowDown, ArrowUp, Layers
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
        <TrendingUp className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium text-primary">Smart-Bullish v2</span>
        <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-medium">
          PRICE TARGETS
        </span>
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Deep candle analysis + <strong>exact price targets</strong>. Shows Entry, Stop Loss, 3 Take Profit levels,
        Support/Resistance zones, expected move %, and Risk:Reward ratio.
      </p>

      {/* Lookback Period */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Analysis Window (Candles)</Label>
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
          More candles = more confirmation + better S/R levels. Default: 30
        </p>
      </div>

      {/* Threshold */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Signal Threshold (Score 0-100)</Label>
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
          75+ = Strong Buy, 60+ = Buy, 45+ = Neutral. Default: 60
        </p>
      </div>

      {/* What It Provides */}
      <div className="pt-3 border-t border-border/50 space-y-2">
        <Label className="text-xs text-muted-foreground uppercase tracking-wider">What You Get</Label>
        <div className="grid grid-cols-1 gap-1.5">
          {[
            { icon: Crosshair, label: 'Entry Price', desc: 'Exact entry point based on current price action', color: 'text-blue-400' },
            { icon: Shield, label: 'Stop Loss', desc: 'Below nearest support + ATR buffer for safety', color: 'text-red-400' },
            { icon: Target, label: '3 Take Profit Levels', desc: 'TP1 (conservative), TP2 (moderate), TP3 (aggressive)', color: 'text-green-400' },
            { icon: ArrowUp, label: 'Expected Move %', desc: 'How much price can move up to TP2', color: 'text-emerald-400' },
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

      {/* Analysis Factors */}
      <div className="pt-3 border-t border-border/50 space-y-2">
        <Label className="text-xs text-muted-foreground uppercase tracking-wider">Score Factors</Label>
        <div className="grid grid-cols-1 gap-1.5">
          {[
            { icon: Activity, label: 'Seller Exhaustion', desc: 'Bearish bodies shrinking (25%)' },
            { icon: ArrowUpCircle, label: 'Buyer Absorption', desc: 'Lower wicks increasing (20%)' },
            { icon: TrendingUp, label: 'Momentum Shift', desc: 'Buyer power trend rising (25%)' },
            { icon: Volume2, label: 'Volume Confirmation', desc: 'Higher volume on bullish candles (15%)' },
            { icon: BarChart3, label: 'Price Recovery', desc: 'Higher lows + closes trending up (15%)' },
          ].map(({ icon: Icon, label, desc }) => (
            <div key={label} className="flex items-start gap-2 text-[10px] text-muted-foreground">
              <Icon className="w-3 h-3 mt-0.5 text-primary/70 flex-shrink-0" />
              <span><strong className="text-foreground/80">{label}:</strong> {desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Target Calculation Methods */}
      <div className="pt-3 border-t border-border/50 space-y-2">
        <Label className="text-xs text-muted-foreground uppercase tracking-wider">Target Calculation</Label>
        <div className="grid grid-cols-1 gap-1">
          {[
            'ATR-based: Volatility-adjusted targets & stop loss',
            'Swing Points: Previous highs/lows as natural targets',
            'Volume Profile: High-volume zones as strong S/R levels',
            'All combined for most accurate price prediction',
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
