import { useState, useCallback } from 'react';
import { Trade } from '@/hooks/useTrades';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Brain, Loader2, AlertTriangle, TrendingUp, TrendingDown, Shield, Target, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

const BINANCE_DATA_API = 'https://data-api.binance.vision/api/v3';

const SHORT_TFS = ['1m', '5m', '15m', '30m'];
const LONG_TFS = ['1h', '4h', '1d'];
const ALL_TFS = [...SHORT_TFS, ...LONG_TFS];

function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calcEMA(closes: number[], period: number): number {
  if (closes.length < period) return closes[closes.length - 1] ?? 0;
  const k = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < closes.length; i++) ema = closes[i] * k + ema * (1 - k);
  return ema;
}

function calcMACD(closes: number[]): number {
  if (closes.length < 26) return 0;
  return calcEMA(closes, 12) - calcEMA(closes, 26);
}

interface TFData {
  tf: string;
  rsi: number;
  macd: number;
  ema20: number;
  ema50: number;
  currentPrice: number;
  trend: 'up' | 'down' | 'sideways';
  lastCandles: { open: number; high: number; low: number; close: number; volume: number }[];
}

interface Analysis {
  decision: string;
  urgency: string;
  confidence: number;
  currentBias: string;
  shortTermOutlook: string;
  longTermOutlook: string;
  recommendation: string;
  riskLevel: string;
  slSuggestion: number | null;
  tpSuggestion: number | null;
  keyLevels: { support: number; resistance: number };
  reasons: string[];
  warning: string | null;
}

interface Props {
  trade: Trade;
  currentPrice: number | null;
}

const DECISION_COLOR: Record<string, string> = {
  HOLD: 'text-primary bg-primary/10 border-primary/30',
  EXIT_NOW: 'text-bearish bg-bearish/10 border-bearish/30',
  EXIT_PARTIAL: 'text-warning bg-warning/10 border-warning/30',
  ADD_POSITION: 'text-bullish bg-bullish/10 border-bullish/30',
};

const URGENCY_COLOR: Record<string, string> = {
  HIGH: 'text-bearish border-bearish/40',
  MEDIUM: 'text-warning border-warning/40',
  LOW: 'text-muted-foreground border-border',
};

export function LiveTradeAnalysis({ trade, currentPrice }: Props) {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tfData, setTfData] = useState<TFData[]>([]);

  const fetchAndAnalyze = useCallback(async () => {
    setLoading(true);
    setError(null);
    setExpanded(true);

    try {
      // Fetch klines for all timeframes in parallel
      const klineResults = await Promise.all(
        ALL_TFS.map(async (tf) => {
          try {
            const res = await fetch(`${BINANCE_DATA_API}/klines?symbol=${trade.symbol}&interval=${tf}&limit=100`);
            if (!res.ok) return null;
            const raw: any[][] = await res.json();
            return { tf, candles: raw.map(c => ({ open: +c[1], high: +c[2], low: +c[3], close: +c[4], volume: +c[5] })) };
          } catch { return null; }
        })
      );

      const timeframeData: TFData[] = klineResults
        .filter(Boolean)
        .map(({ tf, candles }: any) => {
          const closes = candles.map((c: any) => c.close);
          const rsi = calcRSI(closes);
          const macd = calcMACD(closes);
          const ema20 = calcEMA(closes, 20);
          const ema50 = calcEMA(closes, 50);
          const price = closes[closes.length - 1];
          const trend: 'up' | 'down' | 'sideways' =
            price > ema20 && ema20 > ema50 ? 'up' :
            price < ema20 && ema20 < ema50 ? 'down' : 'sideways';

          return {
            tf,
            rsi,
            macd,
            ema20,
            ema50,
            currentPrice: currentPrice ?? price,
            trend,
            lastCandles: candles.slice(-5),
          };
        });

      setTfData(timeframeData);

      // Call edge function
      const { data, error: fnError } = await supabase.functions.invoke('live-trade-analysis', {
        body: {
          symbol: trade.symbol,
          side: trade.side,
          entryPrice: trade.entry_price,
          stopLoss: trade.stop_loss,
          takeProfit: trade.take_profit,
          quantity: trade.quantity,
          timeframeData,
        },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setAnalysis(data);
    } catch (e: any) {
      setError(e.message || 'Analysis failed');
    } finally {
      setLoading(false);
    }
  }, [trade, currentPrice]);

  if (!expanded && !analysis) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="text-[10px] h-6 px-2 gap-1 border-primary/30 text-primary hover:bg-primary/10"
        onClick={fetchAndAnalyze}
        disabled={loading}
      >
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
        AI Analysis
      </Button>
    );
  }

  return (
    <div className="mt-2 ml-9 rounded-lg border border-border bg-card/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border bg-muted/20">
        <div className="flex items-center gap-1.5">
          <Brain className="w-3 h-3 text-primary" />
          <span className="text-[10px] font-semibold text-primary">Live AI Analysis</span>
          {analysis && (
            <Badge variant="outline" className={cn('text-[8px] px-1.5 py-0', DECISION_COLOR[analysis.decision] || 'text-muted-foreground')}>
              {analysis.decision.replace('_', ' ')}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={fetchAndAnalyze} disabled={loading}>
            <RefreshCw className={cn('w-2.5 h-2.5 text-muted-foreground', loading && 'animate-spin')} />
          </Button>
          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setExpanded(v => !v)}>
            {expanded ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="p-2.5 space-y-2">
          {loading && (
            <div className="flex flex-col items-center py-4 gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <p className="text-[10px] text-muted-foreground">Analyzing {ALL_TFS.length} timeframes...</p>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-1.5 text-bearish text-[10px]">
              <AlertTriangle className="w-3 h-3" />
              {error}
            </div>
          )}

          {/* Timeframe grid */}
          {!loading && tfData.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide">Timeframe Overview</p>
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-1">
                {tfData.map(tf => (
                  <div key={tf.tf} className={cn(
                    'rounded p-1.5 border text-center',
                    tf.trend === 'up' ? 'border-bullish/30 bg-bullish/5' :
                    tf.trend === 'down' ? 'border-bearish/30 bg-bearish/5' :
                    'border-border bg-muted/20'
                  )}>
                    <p className="text-[8px] font-mono font-bold text-muted-foreground">{tf.tf}</p>
                    <div className="flex justify-center mt-0.5">
                      {tf.trend === 'up' ? <TrendingUp className="w-2.5 h-2.5 text-bullish" /> :
                       tf.trend === 'down' ? <TrendingDown className="w-2.5 h-2.5 text-bearish" /> :
                       <span className="text-[8px] text-muted-foreground">—</span>}
                    </div>
                    <p className={cn('text-[8px] font-mono mt-0.5',
                      tf.rsi > 70 ? 'text-bearish' : tf.rsi < 30 ? 'text-bullish' : 'text-muted-foreground'
                    )}>RSI {tf.rsi.toFixed(0)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Analysis Result */}
          {!loading && analysis && (
            <div className="space-y-2">
              {/* Decision Banner */}
              <div className={cn('rounded-lg p-2 border', DECISION_COLOR[analysis.decision] || 'border-border')}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold">{analysis.decision.replace('_', ' ')}</p>
                    <p className="text-[9px] opacity-80">{analysis.currentBias} Bias • {analysis.confidence}% Confidence</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant="outline" className={cn('text-[8px]', URGENCY_COLOR[analysis.urgency] || '')}>
                      {analysis.urgency} URGENCY
                    </Badge>
                    <Badge variant="outline" className="text-[8px]">
                      Risk: {analysis.riskLevel}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Warning */}
              {analysis.warning && (
                <div className="flex items-start gap-1.5 p-1.5 rounded bg-bearish/10 border border-bearish/20">
                  <AlertTriangle className="w-3 h-3 text-bearish shrink-0 mt-0.5" />
                  <p className="text-[10px] text-bearish">{analysis.warning}</p>
                </div>
              )}

              {/* Recommendation */}
              <div className="text-[10px] text-foreground leading-relaxed bg-muted/20 rounded p-2">
                {analysis.recommendation}
              </div>

              {/* Short/Long term */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-0.5">
                  <p className="text-[8px] font-semibold text-muted-foreground uppercase">Short Term (1m-30m)</p>
                  <p className="text-[10px] text-foreground">{analysis.shortTermOutlook}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[8px] font-semibold text-muted-foreground uppercase">Long Term (1h-1d)</p>
                  <p className="text-[10px] text-foreground">{analysis.longTermOutlook}</p>
                </div>
              </div>

              {/* Key Levels + SL/TP suggestions */}
              <div className="flex flex-wrap gap-1.5 text-[9px]">
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted border border-border">
                  <Shield className="w-2.5 h-2.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Support:</span>
                  <span className="font-mono">${analysis.keyLevels?.support?.toFixed(4)}</span>
                </div>
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted border border-border">
                  <Target className="w-2.5 h-2.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Resistance:</span>
                  <span className="font-mono">${analysis.keyLevels?.resistance?.toFixed(4)}</span>
                </div>
                {analysis.slSuggestion && (
                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-bearish/10 border border-bearish/30">
                    <span className="text-bearish">Suggested SL:</span>
                    <span className="font-mono text-bearish">${analysis.slSuggestion.toFixed(4)}</span>
                  </div>
                )}
                {analysis.tpSuggestion && (
                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-bullish/10 border border-bullish/30">
                    <span className="text-bullish">Suggested TP:</span>
                    <span className="font-mono text-bullish">${analysis.tpSuggestion.toFixed(4)}</span>
                  </div>
                )}
              </div>

              {/* Reasons */}
              <div className="space-y-0.5">
                {analysis.reasons?.map((r, i) => (
                  <p key={i} className="text-[10px] text-muted-foreground flex items-start gap-1">
                    <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" /> {r}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
