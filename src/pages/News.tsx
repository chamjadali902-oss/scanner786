import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { ExternalLink, Loader2, Newspaper, CalendarDays, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

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
  const [eventsError, setEventsError] = useState(false);

  const load = async () => {
    setLoading(true);
    setEventsError(false);
    const [nw, ev] = await Promise.allSettled([
      fetch('https://min-api.cryptocompare.com/data/v2/news/?lang=EN').then(r => r.json()),
      fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.json').then(r => r.json()),
    ]);
    if (nw.status === 'fulfilled' && Array.isArray(nw.value?.Data)) setNews(nw.value.Data.slice(0, 40));
    if (ev.status === 'fulfilled' && Array.isArray(ev.value)) {
      setEvents(ev.value.filter((e: EconEvent) => e.impact === 'High' || e.country === 'USD'));
    } else {
      setEventsError(true);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const impactColor = (impact: string) =>
    impact === 'High' ? 'bg-bearish/15 text-bearish border-bearish/30'
    : impact === 'Medium' ? 'bg-warning/15 text-warning border-warning/30'
    : 'bg-muted text-muted-foreground border-border';

  const upcoming = events.filter(e => new Date(e.date).getTime() >= Date.now() - 3600e3).slice(0, 20);

  return (
    <AppLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">News & Events</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Latest crypto news and this week's high-impact economic events.</p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-1.5">
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
                <p className="text-xs text-muted-foreground">Calendar unavailable right now. Try refresh.</p>
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
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.body}</p>
                      <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
                        <span className="font-semibold text-primary">{n.source}</span>
                        <span>{new Date(n.published_on * 1000).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
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
