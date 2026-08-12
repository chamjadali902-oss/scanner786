import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Activity, BarChart2, ChevronDown, Loader2, ShieldCheck, TriangleAlert } from 'lucide-react';
import { Timeframe, SetupDirection } from '@/types/scanner';
import { fetchKlines } from '@/lib/binance';
import { computeEdgeStats, calibrateScore, EdgeStats } from '@/lib/edge-stats';
import { getOrderFlow, OrderFlowSignal } from '@/lib/order-flow';

interface FlowStatsPanelProps {
  symbol: string;
  timeframe: Timeframe;
  direction: SetupDirection;
  rawScore?: number;
}

const verdictStyles: Record<string, string> = {
  confirms: 'bg-bullish/10 text-bullish border-bullish/30',
  divergent: 'bg-bearish/10 text-bearish border-bearish/30',
  absorbing: 'bg-primary/10 text-primary border-primary/30',
  neutral: 'bg-muted text-muted-foreground border-border',
};

const verdictLabel: Record<string, string> = {
  confirms: 'Flow confirms setup',
  divergent: 'Flow against setup',
  absorbing: 'Absorption detected',
  neutral: 'Flow neutral',
};

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="rounded-lg bg-muted/40 p-2 text-center">
      <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          'font-mono text-xs font-semibold',
          tone === 'good' && 'text-bullish',
          tone === 'bad' && 'text-bearish'
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function FlowStatsPanel({ symbol, timeframe, direction, rawScore }: FlowStatsPanelProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<EdgeStats | null>(null);
  const [flow, setFlow] = useState<OrderFlowSignal | null>(null);

  const load = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const [candles, flowSignal] = await Promise.all([
        fetchKlines(symbol, timeframe, 500),
        getOrderFlow(symbol, timeframe, direction, 150).catch(() => null),
      ]);
      setStats(computeEdgeStats(candles, direction));
      setFlow(flowSignal);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Flow/stats load failed');
    } finally {
      setLoading(false);
    }
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !stats && !loading) load();
  };

  const calibrated =
    stats && rawScore !== undefined ? calibrateScore(rawScore, stats, flow?.scoreAdjust ?? 0) : null;

  return (
    <div className="rounded-lg border border-border/60 bg-background/40">
      <Button
        variant="ghost"
        size="sm"
        onClick={toggle}
        className="w-full h-8 justify-between px-2 text-[11px] font-semibold"
      >
        <span className="flex items-center gap-1.5">
          <BarChart2 className="w-3.5 h-3.5" />
          Flow &amp; Stats
          {flow && (
            <span className={cn('rounded border px-1 py-0.5 text-[9px] font-medium', verdictStyles[flow.verdict])}>
              {verdictLabel[flow.verdict]}
            </span>
          )}
        </span>
        <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', open && 'rotate-180')} />
      </Button>

      {open && (
        <div className="space-y-3 border-t border-border/60 p-2.5">
          {loading && (
            <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Historical occurrences aur order flow calculate ho raha hai…
            </p>
          )}
          {error && <p className="text-[11px] text-bearish">{error}</p>}

          {stats && !loading && (
            <>
              {/* Calibrated confidence */}
              <div>
                <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
                  <span>Statistically calibrated score</span>
                  <span className="font-mono text-foreground">
                    {calibrated ?? stats.confidence}
                    {rawScore !== undefined && (
                      <span className="text-muted-foreground"> / raw {rawScore}</span>
                    )}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      'h-full rounded-full',
                      (calibrated ?? stats.confidence) >= 70
                        ? 'bg-bullish'
                        : (calibrated ?? stats.confidence) >= 50
                        ? 'bg-primary'
                        : 'bg-bearish'
                    )}
                    style={{ width: `${calibrated ?? stats.confidence}%` }}
                  />
                </div>
              </div>

              {/* Rolling backtest */}
              <div>
                <p className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <ShieldCheck className="w-3 h-3" />
                  Rolling backtest ({direction} · {stats.sample} occurrences · {stats.reliability})
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  <Stat
                    label="Win rate"
                    value={`${stats.winRate.toFixed(0)}%`}
                    tone={stats.winRate >= 50 ? 'good' : 'bad'}
                  />
                  <Stat
                    label="Expectancy"
                    value={`${stats.expectancyR >= 0 ? '+' : ''}${stats.expectancyR.toFixed(2)}R`}
                    tone={stats.expectancyR > 0 ? 'good' : 'bad'}
                  />
                  <Stat
                    label="Profit factor"
                    value={stats.profitFactor >= 99 ? '∞' : stats.profitFactor.toFixed(2)}
                    tone={stats.profitFactor >= 1 ? 'good' : 'bad'}
                  />
                  <Stat label="Avg MFE" value={`${stats.avgMfeR.toFixed(2)}R`} />
                  <Stat label="Avg MAE" value={`${stats.avgMaeR.toFixed(2)}R`} />
                  <Stat label="Avg hold" value={`${stats.avgBars.toFixed(0)} bars`} />
                  <Stat label="95% floor" value={`${stats.winRateLow.toFixed(0)}%`} />
                  <Stat label="Best" value={`${stats.bestR.toFixed(1)}R`} />
                  <Stat label="Worst" value={`${stats.worstR.toFixed(1)}R`} />
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{stats.verdict}</p>
              </div>

              {/* Order flow */}
              {flow ? (
                <div>
                  <p className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <Activity className="w-3 h-3" />
                    Order flow (CVD / delta / absorption)
                  </p>
                  <div className="grid grid-cols-3 gap-1.5">
                    <Stat
                      label="CVD slope"
                      value={`${flow.cvdSlope >= 0 ? '+' : ''}${(flow.cvdSlope * 100).toFixed(1)}`}
                      tone={
                        (direction === 'long' && flow.cvdSlope > 0) || (direction === 'short' && flow.cvdSlope < 0)
                          ? 'good'
                          : 'bad'
                      }
                    />
                    <Stat label="Buy pressure" value={`${flow.buyPressure.toFixed(0)}%`} />
                    <Stat label="Delta z" value={flow.deltaZScore.toFixed(2)} />
                    <Stat label="Divergence" value={flow.divergence ? flow.divergence : 'none'} />
                    <Stat
                      label="Absorption"
                      value={flow.absorption ? flow.absorption.replace('at_', '') : 'none'}
                    />
                    <Stat
                      label="Flow adj"
                      value={`${flow.scoreAdjust >= 0 ? '+' : ''}${flow.scoreAdjust}`}
                      tone={flow.scoreAdjust >= 0 ? 'good' : 'bad'}
                    />
                  </div>
                  <ul className="mt-1.5 space-y-1">
                    {flow.notes.slice(0, 4).map((n, i) => (
                      <li key={i} className="flex gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
                        <span className="text-primary">•</span>
                        {n}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <TriangleAlert className="w-3 h-3" />
                  Order flow data is symbol ke liye available nahi.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
