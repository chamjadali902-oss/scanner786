import { useState } from 'react';
import { ScanResult, Timeframe } from '@/types/scanner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Brain, TrendingUp, TrendingDown, Minus, Target, Shield, Loader2, AlertTriangle, RefreshCw, Zap, Clock, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AIAnalysis {
  signal: 'BUY' | 'SELL' | 'HOLD';
  tradeType?: 'REVERSAL' | 'BREAKOUT' | 'SCALP' | 'SWING' | 'TREND_CONTINUATION';
  direction?: 'LONG' | 'SHORT';
  confidence: number;
  strength?: 'STRONG' | 'MODERATE' | 'WEAK';
  entry: number;
  takeProfit: number[];
  stopLoss: number;
  riskReward: string;
  reasons: string[];
  setup?: string;
  warnings?: string[];
  keyLevels?: { support: number[]; resistance: number[] };
  summary: string;
}

interface AIAnalysisPanelProps {
  result: ScanResult;
  timeframe: Timeframe;
}

export function AIAnalysisPanel({ result, timeframe }: AIAnalysisPanelProps) {
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const analyze = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-trade', {
        body: {
          symbol: result.symbol,
          price: result.price,
          priceChange24h: result.priceChange24h,
          volume24h: result.volume24h,
          indicatorValues: result.indicatorValues,
          matchReasons: result.matchReasons,
          isBullish: result.isBullish,
          timeframe,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAnalysis(data);
    } catch (err: any) {
      toast({ title: 'Analysis failed', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (p: number) => {
    if (p < 1) return p.toFixed(6);
    if (p < 100) return p.toFixed(4);
    return p.toFixed(2);
  };

  if (!analysis) {
    return (
      <Button onClick={analyze} disabled={loading} variant="outline" size="sm" className="w-full gap-2">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
        {loading ? 'Analyzing...' : 'AI Analysis'}
      </Button>
    );
  }

  const signalConfig = {
    BUY: { icon: TrendingUp, color: 'text-bullish', bg: 'bg-bullish/10', border: 'border-bullish/30' },
    SELL: { icon: TrendingDown, color: 'text-bearish', bg: 'bg-bearish/10', border: 'border-bearish/30' },
    HOLD: { icon: Minus, color: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/30' },
  };

  const tradeTypeConfig: Record<string, { icon: any; label: string; color: string }> = {
    REVERSAL: { icon: RefreshCw, label: 'Reversal', color: 'text-purple-400' },
    BREAKOUT: { icon: Zap, label: 'Breakout', color: 'text-yellow-400' },
    SCALP: { icon: Clock, label: 'Scalp', color: 'text-primary' },
    SWING: { icon: TrendingUp, label: 'Swing', color: 'text-blue-400' },
    TREND_CONTINUATION: { icon: ArrowUpRight, label: 'Trend', color: 'text-primary' },
  };

  const cfg = signalConfig[analysis.signal] || signalConfig.HOLD;
  const SignalIcon = cfg.icon;
  const ttCfg = analysis.tradeType ? tradeTypeConfig[analysis.tradeType] : null;

  return (
    <div className={cn('mt-3 p-3 rounded-lg border space-y-3', cfg.bg, cfg.border)}>
      {/* Signal Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SignalIcon className={cn('w-5 h-5', cfg.color)} />
          <span className={cn('font-bold text-lg', cfg.color)}>{analysis.signal}</span>
          {analysis.direction && (
            <Badge variant="outline" className="text-[9px] gap-0.5">
              {analysis.direction === 'LONG' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {analysis.direction}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {ttCfg && (
            <Badge variant="outline" className={cn('text-[9px] gap-0.5', ttCfg.color)}>
              <ttCfg.icon className="w-3 h-3" /> {ttCfg.label}
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">
            <span className="font-mono font-bold">{analysis.confidence}%</span>
          </span>
        </div>
      </div>

      {/* Confidence bar */}
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', analysis.confidence >= 75 ? 'bg-bullish' : analysis.confidence >= 50 ? 'bg-warning' : 'bg-bearish')}
          style={{ width: `${analysis.confidence}%` }} />
      </div>

      {/* Setup description */}
      {analysis.setup && <p className="text-xs text-muted-foreground">{analysis.setup}</p>}

      {/* Entry / TP / SL */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="p-2 rounded bg-background/50">
          <p className="text-muted-foreground flex items-center gap-1"><Target className="w-3 h-3" /> Entry</p>
          <p className="font-mono font-bold">${formatPrice(analysis.entry)}</p>
        </div>
        <div className="p-2 rounded bg-background/50">
          <p className="text-muted-foreground flex items-center gap-1"><Shield className="w-3 h-3" /> Stop Loss</p>
          <p className="font-mono font-bold text-bearish">${formatPrice(analysis.stopLoss)}</p>
        </div>
      </div>

      {/* Take Profit Levels */}
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Take Profit Levels</p>
        {analysis.takeProfit.map((tp, i) => (
          <div key={i} className="flex justify-between items-center text-xs p-1.5 rounded bg-background/50">
            <span className="text-muted-foreground">TP{i + 1}</span>
            <span className="font-mono font-bold text-bullish">${formatPrice(tp)}</span>
          </div>
        ))}
      </div>

      {/* Risk/Reward */}
      <div className="text-xs text-center text-muted-foreground">
        Risk/Reward: <span className="font-mono font-bold text-foreground">{analysis.riskReward}</span>
        {analysis.strength && <span className="ml-2">• {analysis.strength}</span>}
      </div>

      {/* Reasons */}
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Key Reasons</p>
        {analysis.reasons.map((r, i) => (
          <p key={i} className="text-xs flex items-start gap-1.5">
            <span className={cn('mt-0.5 w-1.5 h-1.5 rounded-full shrink-0', analysis.signal === 'BUY' ? 'bg-bullish' : analysis.signal === 'SELL' ? 'bg-bearish' : 'bg-warning')} />
            {r}
          </p>
        ))}
      </div>

      {/* Warnings */}
      {analysis.warnings && analysis.warnings.length > 0 && (
        <div className="p-2 rounded bg-warning/5 border border-warning/20 space-y-1">
          {analysis.warnings.map((w, i) => (
            <p key={i} className="text-[10px] flex items-start gap-1.5 text-warning">
              <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" /> {w}
            </p>
          ))}
        </div>
      )}

      {/* Key Levels */}
      {analysis.keyLevels && (
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div className="p-1.5 rounded bg-background/50">
            <p className="text-muted-foreground mb-0.5">Support</p>
            {analysis.keyLevels.support?.map((s, i) => (
              <p key={i} className="font-mono text-bullish">${formatPrice(s)}</p>
            ))}
          </div>
          <div className="p-1.5 rounded bg-background/50">
            <p className="text-muted-foreground mb-0.5">Resistance</p>
            {analysis.keyLevels.resistance?.map((r, i) => (
              <p key={i} className="font-mono text-bearish">${formatPrice(r)}</p>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      <p className="text-xs text-muted-foreground italic">{analysis.summary}</p>

      <Button onClick={analyze} disabled={loading} variant="ghost" size="sm" className="w-full text-xs gap-1">
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
        Re-analyze
      </Button>
    </div>
  );
}
