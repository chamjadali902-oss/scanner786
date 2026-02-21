import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Shield, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Analysis } from './types';
import { DECISION_COLOR, URGENCY_COLOR } from './types';

interface Props {
  analysis: Analysis;
}

export function AnalysisResult({ analysis }: Props) {
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
  );
}
