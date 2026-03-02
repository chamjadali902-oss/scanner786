import { Trade } from '@/hooks/useTrades';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Brain, Loader2, AlertTriangle, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ALL_TIMEFRAMES } from '@/lib/market-api';
import { useTradeAnalysis } from './useTradeAnalysis';
import { TimeframeGrid } from './TimeframeGrid';
import { AnalysisResult } from './AnalysisResult';
import { DECISION_COLOR } from './types';

interface Props {
  trade: Trade;
  currentPrice: number | null;
}

export function LiveTradeAnalysis({ trade, currentPrice }: Props) {
  const {
    analysis,
    loading,
    expanded,
    setExpanded,
    error,
    tfData,
    fetchAndAnalyze,
  } = useTradeAnalysis(trade, currentPrice);

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
              <p className="text-[10px] text-muted-foreground">Analyzing {ALL_TIMEFRAMES.length} timeframes...</p>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-1.5 text-bearish text-[10px]">
              <AlertTriangle className="w-3 h-3" />
              {error}
            </div>
          )}

          {!loading && tfData.length > 0 && <TimeframeGrid data={tfData} />}
          {!loading && analysis && <AnalysisResult analysis={analysis} symbol={trade.symbol} />}
        </div>
      )}
    </div>
  );
}
