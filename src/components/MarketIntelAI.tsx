import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Brain, Loader2, RefreshCw, AlertTriangle, ArrowUpRight, ArrowDownRight,
  Newspaper, CalendarClock, ShieldAlert, ListChecks, Gauge, Copy, Check,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface NewsImpact { title: string; impact: string; read: string }
interface EventRisk { event: string; when: string; read: string }
interface Opportunity {
  symbol: string; direction: string; setup: string;
  trigger: string; invalidation: string; confidence: number;
}
interface Brief {
  regime?: string;
  bias?: string;
  confidence?: number;
  headline?: string;
  summary?: string;
  positioning?: string;
  flow?: string;
  sentiment?: string;
  newsImpact?: NewsImpact[];
  eventRisk?: EventRisk[];
  opportunities?: Opportunity[];
  avoid?: string[];
  playbook?: string[];
  invalidation?: string;
  snapshot?: { generatedAt?: string };
}

const BIAS_STYLE: Record<string, string> = {
  BULLISH: 'text-bullish bg-bullish/10 border-bullish/30',
  BEARISH: 'text-bearish bg-bearish/10 border-bearish/30',
  NEUTRAL: 'text-muted-foreground bg-muted border-border',
};

const IMPACT_STYLE = (i: string) =>
  /high/i.test(i) ? 'bg-bearish/15 text-bearish border-bearish/30'
  : /medium/i.test(i) ? 'bg-warning/15 text-warning border-warning/30'
  : 'bg-muted text-muted-foreground border-border';

interface Props {
  /** Optional focus pairs for the positioning section, e.g. ['BTCUSDT','SOLUSDT'] */
  symbols?: string[];
  className?: string;
}

export function MarketIntelAI({ symbols, className }: Props) {
  const [brief, setBrief] = useState<Brief | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('market-intel-ai', {
        body: symbols?.length ? { symbols } : {},
      });
      if (fnError) throw fnError;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      setBrief(data as Brief);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  }, [symbols]);

  const copyBrief = async () => {
    if (!brief) return;
    const lines = [
      brief.headline ?? '',
      '',
      brief.summary ?? '',
      '',
      brief.positioning ? `Positioning: ${brief.positioning}` : '',
      brief.flow ? `Order flow: ${brief.flow}` : '',
      brief.sentiment ? `Sentiment: ${brief.sentiment}` : '',
      '',
      ...(brief.opportunities ?? []).map(o =>
        `${o.symbol} ${o.direction} (${o.confidence}%) - ${o.setup}. Trigger: ${o.trigger}. Invalidation: ${o.invalidation}`),
      '',
      ...(brief.playbook ?? []).map(p => `- ${p}`),
      brief.invalidation ? `\nView invalidated if: ${brief.invalidation}` : '',
    ].filter(Boolean).join('\n');
    try {
      await navigator.clipboard.writeText(lines);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' });
    }
  };

  return (
    <div className={cn('rounded-xl border bg-card p-3 sm:p-4 space-y-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-primary" />
          <div>
            <h2 className="text-sm font-bold">AI Market Intelligence</h2>
            <p className="text-[10px] text-muted-foreground">
              Live prices, funding, open interest, news and economic events analysed together.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {brief && (
            <Button variant="ghost" size="sm" onClick={copyBrief} className="gap-1.5 text-xs">
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          )}
          <Button size="sm" onClick={run} disabled={loading} className="gap-1.5">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : brief ? <RefreshCw className="w-3.5 h-3.5" /> : <Brain className="w-3.5 h-3.5" />}
            {loading ? 'Analysing...' : brief ? 'Re-analyse' : 'Analyse market now'}
          </Button>
        </div>
      </div>

      {loading && !brief && (
        <p className="text-xs text-muted-foreground">
          Collecting live market data, futures positioning, news and calendar, then running the analysis. This takes a few seconds.
        </p>
      )}

      {error && (
        <p className="text-xs text-bearish flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {error}
        </p>
      )}

      {brief && (
        <div className="space-y-3">
          {/* Verdict */}
          <div className={cn('rounded-lg border p-3 space-y-2', BIAS_STYLE[String(brief.bias).toUpperCase()] ?? BIAS_STYLE.NEUTRAL)}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-extrabold tracking-tight">{brief.bias ?? 'NEUTRAL'}</span>
              {brief.regime && <Badge variant="outline" className="text-[9px]">{brief.regime.replace('_', ' ')}</Badge>}
              {typeof brief.confidence === 'number' && (
                <span className="text-[10px] font-mono flex items-center gap-1">
                  <Gauge className="w-3 h-3" /> {brief.confidence}%
                </span>
              )}
              {brief.snapshot?.generatedAt && (
                <span className="text-[10px] font-mono opacity-70">
                  {new Date(brief.snapshot.generatedAt).toLocaleTimeString()}
                </span>
              )}
            </div>
            {brief.headline && <p className="text-sm font-semibold leading-snug">{brief.headline}</p>}
            {brief.summary && <p className="text-xs leading-relaxed opacity-90">{brief.summary}</p>}
          </div>

          {/* Reads */}
          <div className="grid sm:grid-cols-3 gap-2">
            {[
              { label: 'Positioning', value: brief.positioning },
              { label: 'Order Flow', value: brief.flow },
              { label: 'Sentiment', value: brief.sentiment },
            ].filter(r => r.value).map(r => (
              <div key={r.label} className="rounded-lg border bg-muted/20 p-2.5">
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">{r.label}</p>
                <p className="text-xs leading-relaxed">{r.value}</p>
              </div>
            ))}
          </div>

          {/* Opportunities */}
          {!!brief.opportunities?.length && (
            <div className="space-y-2">
              <p className="text-xs font-bold flex items-center gap-1.5"><ListChecks className="w-3.5 h-3.5 text-primary" /> Trade Ideas</p>
              <div className="grid sm:grid-cols-2 gap-2">
                {brief.opportunities.map((o, i) => {
                  const long = /long/i.test(o.direction);
                  return (
                    <div key={i} className="rounded-lg border bg-muted/20 p-2.5 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold">{o.symbol}</span>
                        <span className={cn('text-[10px] font-bold flex items-center gap-0.5', long ? 'text-bullish' : 'text-bearish')}>
                          {long ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {o.direction}
                          {typeof o.confidence === 'number' && <span className="font-mono ml-1">{o.confidence}%</span>}
                        </span>
                      </div>
                      {o.setup && <p className="text-xs">{o.setup}</p>}
                      {o.trigger && <p className="text-[10px] text-muted-foreground">Trigger: {o.trigger}</p>}
                      {o.invalidation && <p className="text-[10px] text-bearish">Invalidation: {o.invalidation}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* News impact */}
          {!!brief.newsImpact?.length && (
            <div className="space-y-1.5">
              <p className="text-xs font-bold flex items-center gap-1.5"><Newspaper className="w-3.5 h-3.5 text-primary" /> News That Matters</p>
              {brief.newsImpact.map((n, i) => (
                <div key={i} className="rounded-lg border bg-muted/20 p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold leading-snug">{n.title}</p>
                    <span className={cn('shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase', IMPACT_STYLE(n.impact ?? ''))}>
                      {n.impact}
                    </span>
                  </div>
                  {n.read && <p className="text-[10px] text-muted-foreground mt-1">{n.read}</p>}
                </div>
              ))}
            </div>
          )}

          {/* Event risk */}
          {!!brief.eventRisk?.length && (
            <div className="space-y-1.5">
              <p className="text-xs font-bold flex items-center gap-1.5"><CalendarClock className="w-3.5 h-3.5 text-primary" /> Event Risk</p>
              {brief.eventRisk.map((e, i) => (
                <div key={i} className="rounded-lg border bg-muted/20 p-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-semibold">{e.event}</p>
                    {e.when && <span className="text-[10px] font-mono text-muted-foreground">{e.when}</span>}
                  </div>
                  {e.read && <p className="text-[10px] text-muted-foreground mt-1">{e.read}</p>}
                </div>
              ))}
            </div>
          )}

          {/* Playbook + avoid */}
          <div className="grid sm:grid-cols-2 gap-2">
            {!!brief.playbook?.length && (
              <div className="rounded-lg border bg-muted/20 p-2.5">
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1.5">Playbook</p>
                <ul className="space-y-1">
                  {brief.playbook.map((p, i) => (
                    <li key={i} className="text-xs flex items-start gap-1.5">
                      <span className="mt-1.5 w-1 h-1 rounded-full bg-primary shrink-0" />{p}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {!!brief.avoid?.length && (
              <div className="rounded-lg border border-warning/25 bg-warning/5 p-2.5">
                <p className="text-[9px] uppercase tracking-wider text-warning mb-1.5 flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3" /> Avoid
                </p>
                <ul className="space-y-1">
                  {brief.avoid.map((a, i) => (
                    <li key={i} className="text-xs flex items-start gap-1.5 text-warning">
                      <span className="mt-1.5 w-1 h-1 rounded-full bg-warning shrink-0" />{a}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {brief.invalidation && (
            <p className="text-[10px] text-muted-foreground border-t pt-2">
              <span className="font-semibold text-foreground">View invalidated if: </span>{brief.invalidation}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
