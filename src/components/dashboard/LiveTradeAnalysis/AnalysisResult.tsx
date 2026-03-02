import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Shield, Target, TrendingUp, TrendingDown, Minus, Crosshair, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Analysis } from './types';
import { DECISION_COLOR, URGENCY_COLOR } from './types';
import { AnalysisChat } from '@/components/AnalysisChat';

interface Props {
  analysis: Analysis;
  symbol?: string;
}

const SIGNAL_ICON: Record<string, React.ReactNode> = {
  BUY: <TrendingUp className="w-2.5 h-2.5 text-bullish" />,
  SELL: <TrendingDown className="w-2.5 h-2.5 text-bearish" />,
  NEUTRAL: <Minus className="w-2.5 h-2.5 text-muted-foreground" />,
};

export function AnalysisResult({ analysis, symbol }: Props) {
  const contextSummary = `Symbol: ${symbol || 'Unknown'}
Decision: ${analysis.decision}, Confidence: ${analysis.confidence}%, Bias: ${analysis.currentBias}
Risk: ${analysis.riskLevel}, Urgency: ${analysis.urgency}
Short Term: ${analysis.shortTermOutlook}
Long Term: ${analysis.longTermOutlook}
Recommendation: ${analysis.recommendation}
${analysis.trapWarning ? `Trap Warning: ${analysis.trapWarning}` : ''}
${analysis.targetAnalysis ? `Target: ${analysis.targetAchievable ? 'Achievable' : 'Unlikely'} - ${analysis.targetAnalysis}` : ''}
${analysis.priceRange ? `Short Term Range: $${analysis.priceRange.shortTerm?.min} - $${analysis.priceRange.shortTerm?.max}, Long Term Range: $${analysis.priceRange.longTerm?.min} - $${analysis.priceRange.longTerm?.max}` : ''}
Key Levels: Support $${analysis.keyLevels?.support}, Resistance $${analysis.keyLevels?.resistance}
${analysis.conflictingSignals?.length ? `Conflicts: ${analysis.conflictingSignals.join('; ')}` : ''}
Reasons: ${analysis.reasons?.join('; ')}`;

  return (
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

      {/* Trap Warning */}
      {analysis.trapWarning && (
        <div className="flex items-start gap-1.5 p-2 rounded bg-warning/10 border border-warning/30">
          <TriangleAlert className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] font-semibold text-warning">⚠ Trap Warning</p>
            <p className="text-[9px] text-warning/80">{analysis.trapWarning}</p>
          </div>
        </div>
      )}

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

      {/* Target Analysis */}
      {analysis.targetAnalysis && (
        <div className={cn('rounded-lg p-2 border', analysis.targetAchievable ? 'border-bullish/30 bg-bullish/5' : 'border-bearish/30 bg-bearish/5')}>
          <div className="flex items-center gap-1.5 mb-1">
            <Crosshair className={cn('w-3 h-3', analysis.targetAchievable ? 'text-bullish' : 'text-bearish')} />
            <p className={cn('text-[10px] font-semibold', analysis.targetAchievable ? 'text-bullish' : 'text-bearish')}>
              Target {analysis.targetAchievable ? 'Achievable ✓' : 'Unlikely ✗'}
            </p>
          </div>
          <p className="text-[9px] text-muted-foreground">{analysis.targetAnalysis}</p>
        </div>
      )}

      {/* Price Range Predictions */}
      {analysis.priceRange && (
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg p-2 border border-border bg-muted/10">
            <p className="text-[8px] font-semibold text-muted-foreground uppercase mb-1">Short Term Range</p>
            <p className="text-[10px] font-mono text-foreground">
              ${analysis.priceRange.shortTerm?.min?.toFixed(4)} — ${analysis.priceRange.shortTerm?.max?.toFixed(4)}
            </p>
            <p className="text-[8px] text-muted-foreground">{analysis.priceRange.shortTerm?.timeframe}</p>
          </div>
          <div className="rounded-lg p-2 border border-border bg-muted/10">
            <p className="text-[8px] font-semibold text-muted-foreground uppercase mb-1">Long Term Range</p>
            <p className="text-[10px] font-mono text-foreground">
              ${analysis.priceRange.longTerm?.min?.toFixed(4)} — ${analysis.priceRange.longTerm?.max?.toFixed(4)}
            </p>
            <p className="text-[8px] text-muted-foreground">{analysis.priceRange.longTerm?.timeframe}</p>
          </div>
        </div>
      )}

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

      {/* Timeframe Summary Grid */}
      {analysis.timeframeSummary && analysis.timeframeSummary.length > 0 && (
        <div>
          <p className="text-[8px] font-semibold text-muted-foreground uppercase mb-1">Timeframe Signals</p>
          <div className="flex flex-wrap gap-1">
            {analysis.timeframeSummary.map((item, i) => (
              <div key={i} className={cn(
                'flex items-center gap-1 px-1.5 py-0.5 rounded border text-[8px] font-mono',
                item.signal === 'BUY' ? 'border-bullish/30 bg-bullish/5' :
                item.signal === 'SELL' ? 'border-bearish/30 bg-bearish/5' :
                'border-border bg-muted/10'
              )}>
                {SIGNAL_ICON[item.signal] || SIGNAL_ICON.NEUTRAL}
                <span className="font-semibold">{item.tf}</span>
                <span className="text-muted-foreground">{item.strength}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conflicting Signals */}
      {analysis.conflictingSignals && analysis.conflictingSignals.length > 0 && (
        <div className="space-y-0.5">
          <p className="text-[8px] font-semibold text-warning uppercase">⚡ Conflicting Signals</p>
          {analysis.conflictingSignals.map((s, i) => (
            <p key={i} className="text-[9px] text-warning/80 flex items-start gap-1">
              <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-warning shrink-0" /> {s}
            </p>
          ))}
        </div>
      )}

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

      {/* Follow-up Chat */}
      <AnalysisChat contextSummary={contextSummary} className="mt-2" />
    </div>
  );
}
