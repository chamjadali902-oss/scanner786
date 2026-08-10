import { cn } from '@/lib/utils';
import { SetupScore } from '@/types/scanner';
import { TrendingDown, TrendingUp, Target, ShieldAlert } from 'lucide-react';

interface Props {
  setup: SetupScore;
  compact?: boolean;
}

const gradeStyles: Record<string, string> = {
  'A+': 'bg-bullish text-background',
  A: 'bg-bullish/80 text-background',
  B: 'bg-primary/80 text-background',
  C: 'bg-warning/80 text-background',
  D: 'bg-muted text-muted-foreground',
};

function fmt(n: number) {
  if (!isFinite(n)) return '-';
  if (Math.abs(n) < 0.0001) return n.toExponential(3);
  if (Math.abs(n) < 1) return n.toFixed(6);
  if (Math.abs(n) < 100) return n.toFixed(4);
  return n.toFixed(2);
}

export function SetupScorePanel({ setup, compact }: Props) {
  const { plan } = setup;
  const long = setup.direction === 'long';

  return (
    <div className="space-y-2.5">
      {/* Score header */}
      <div className="flex items-center gap-2">
        <span className={cn('px-2 py-0.5 rounded-md text-[11px] font-bold tracking-wide', gradeStyles[setup.grade])}>
          {setup.grade}
        </span>
        <div className="flex-1">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
            <span className="uppercase tracking-wider font-semibold">Setup Score</span>
            <span className="font-mono">{setup.score}/100</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn('h-full transition-all', setup.score >= 74 ? 'bg-bullish' : setup.score >= 60 ? 'bg-primary' : 'bg-warning')}
              style={{ width: `${setup.score}%` }}
            />
          </div>
        </div>
        <span className={cn(
          'flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold',
          long ? 'bg-bullish/10 text-bullish' : 'bg-bearish/10 text-bearish'
        )}>
          {long ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {long ? 'LONG' : 'SHORT'}
        </span>
      </div>

      {setup.biasConflict && (
        <p className="text-[10px] rounded-md border border-warning/40 bg-warning/10 text-warning px-2 py-1">
          Counter-trend: chart structure is setup ke opposite hai — size chhoti rakhein.
        </p>
      )}


      {/* Trade plan */}
      <div className="rounded-lg border border-border bg-muted/20 p-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
          <Target className="w-3 h-3" /> Trade Plan
        </p>
        <div className="grid grid-cols-3 gap-1.5 text-[10px]">
          <div>
            <p className="text-muted-foreground">Entry</p>
            <p className="font-mono font-medium">{fmt(plan.entry)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Stop</p>
            <p className="font-mono font-medium text-bearish">{fmt(plan.stopLoss)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">R:R</p>
            <p className="font-mono font-medium">{plan.riskReward.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">TP1</p>
            <p className="font-mono font-medium text-bullish">{fmt(plan.tp1)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">TP2</p>
            <p className="font-mono font-medium text-bullish">{fmt(plan.tp2)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">TP3</p>
            <p className="font-mono font-medium text-bullish">{fmt(plan.tp3)}</p>
          </div>
        </div>
        <p className="mt-1.5 text-[9px] text-muted-foreground flex items-start gap-1">
          <ShieldAlert className="w-3 h-3 shrink-0 mt-px" />
          Risk {plan.riskPercent.toFixed(2)}% · {plan.invalidation}
        </p>
      </div>

      {/* Factor breakdown */}
      {!compact && (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Why this score</p>
          {setup.factors.map(f => (
            <div key={f.key} className="text-[10px]">
              <div className="flex items-center justify-between">
                <span className="font-medium">{f.label}</span>
                <span className="font-mono text-muted-foreground">{f.points}/{f.weight}</span>
              </div>
              <div className="h-1 rounded-full bg-muted overflow-hidden mt-0.5">
                <div className="h-full bg-primary/70" style={{ width: `${(f.points / f.weight) * 100}%` }} />
              </div>
              <p className="text-muted-foreground mt-0.5 leading-snug">{f.note}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
