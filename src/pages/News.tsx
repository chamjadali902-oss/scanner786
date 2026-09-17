import { useCallback, useEffect, useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { ExternalLink, Loader2, Newspaper, CalendarDays, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface NewsItem {
  id: string;
  title: string;
  body: string;
  url: string;
  source: string;
  published_on: number;
  categories: string;
  imageurl?: string;
}

interface EconEvent {
  title: string;
  country: string;
  date: string;
  impact: string;
  forecast?: string;
  previous?: string;
}

export default function News() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [events, setEvents] = useState<EconEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [newsError, setNewsError] = useState(false);
  const [eventsError, setEventsError] = useState(false);

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('market-feed');
      if (error) throw error;
      const payload = data as { news?: NewsItem[]; events?: EconEvent[] };
      const nw = Array.isArray(payload?.news) ? payload.news : [];
      const ev = Array.isArray(payload?.events) ? payload.events : [];
      setNews(nw);
      setNewsError(nw.length === 0);
      setEvents(ev);
      setEventsError(ev.length === 0);
      setUpdatedAt(Date.now());
    } catch {
      setNewsError(true);
      setEventsError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => load(false), 120000);
    return () => clearInterval(t);
  }, [load]);

  const impactColor = (impact: string) =>
    /high/i.test(impact) ? 'bg-bearish/15 text-bearish border-bearish/30'
    : /medium/i.test(impact) ? 'bg-warning/15 text-warning border-warning/30'
    : 'bg-muted text-muted-foreground border-border';

  const upcoming = events
    .filter(e => /high|medium/i.test(e.impact) || e.country === 'USD')
    .filter(e => {
      const t = new Date(e.date).getTime();
      return !isNaN(t) && t >= Date.now() - 3600e3;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 25);

  return (
    <AppLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">News &amp; Events</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Latest crypto news and this week's high-impact economic events.
              {updatedAt && <> Updated {new Date(updatedAt).toLocaleTimeString()}</>}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => load()} disabled={loading} className="gap-1.5">
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} /> Refresh
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading news...
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-4">
            {/* Economic calendar */}
            <div className="rounded-xl border bg-card p-3 sm:p-4 lg:order-2">
              <div className="flex items-center gap-2 mb-3">
                <CalendarDays className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-bold">Economic Calendar (This Week)</h2>
              </div>
              {eventsError ? (
                <p className="text-xs text-muted-foreground">Calendar source is unavailable right now. Try refresh.</p>
              ) : upcoming.length === 0 ? (
                <p className="text-xs text-muted-foreground">No major events remaining this week.</p>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                  {upcoming.map((e, i) => (
                    <div key={i} className="rounded-lg border bg-muted/20 p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold leading-snug">{e.title}</p>
                        <span className={cn('shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase', impactColor(e.impact))}>
                          {e.impact}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[10px] text-muted-foreground">
                        <span className="font-semibold">{e.country}</span>
                        <span>{new Date(e.date).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      {(e.forecast || e.previous) && (
                        <p className="text-[10px] text-muted-foreground mt-1 font-mono">
                          {e.forecast && <>Forecast: {e.forecast} </>}
                          {e.previous && <>· Prev: {e.previous}</>}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* News feed */}
            <div className="lg:col-span-2 lg:order-1 space-y-2.5">
              <div className="flex items-center gap-2">
                <Newspaper className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-bold">Latest Crypto News</h2>
              </div>
              {newsError && (
                <p className="text-xs text-muted-foreground">News sources are unavailable right now. Try refresh.</p>
              )}
              {news.map(n => (
                <a
                  key={n.id}
                  href={n.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-xl border bg-card p-3 sm:p-4 hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-snug">{n.title}</p>
                      {n.body && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.body}</p>}
                      <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
                        <span className="font-semibold text-primary">{n.source}</span>
                        {n.published_on > 0 && (
                          <span>{new Date(n.published_on * 1000).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        )}
                        {n.categories && <span className="hidden sm:inline">· {n.categories.split('|').slice(0, 3).join(', ')}</span>}
                      </div>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0 text-muted-foreground mt-1" />
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
