// Proxy for crypto news + economic calendar (avoids browser CORS/blocked sources).
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

async function getJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MarketFeed/1.0)',
        Accept: 'application/json,text/plain,*/*',
      },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchNews(): Promise<NewsItem[]> {
  const cc = await getJson('https://min-api.cryptocompare.com/data/v2/news/?lang=EN') as
    | { Data?: Array<Record<string, unknown>> }
    | null;
  if (cc?.Data?.length) {
    return cc.Data.slice(0, 50).map((n) => ({
      id: String(n.id ?? n.guid ?? n.url),
      title: String(n.title ?? ''),
      body: String(n.body ?? ''),
      url: String(n.url ?? ''),
      source: String(n.source_info && (n.source_info as Record<string, unknown>).name || n.source || 'News'),
      published_on: Number(n.published_on ?? 0),
      categories: String(n.categories ?? ''),
      imageurl: n.imageurl ? String(n.imageurl) : undefined,
    }));
  }

  // Fallback: CoinDesk / Cointelegraph RSS via a lightweight XML parse
  const feeds = [
    { url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', source: 'CoinDesk' },
    { url: 'https://cointelegraph.com/rss', source: 'Cointelegraph' },
  ];
  const out: NewsItem[] = [];
  for (const f of feeds) {
    try {
      const res = await fetch(f.url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!res.ok) continue;
      const xml = await res.text();
      const items = xml.split(/<item[\s>]/).slice(1);
      for (const it of items.slice(0, 25)) {
        const pick = (tag: string) => {
          const m = it.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
          if (!m) return '';
          return m[1]
            .replace(/<!\[CDATA\[|\]\]>/g, '')
            .replace(/<[^>]+>/g, '')
            .replace(/&amp;/g, '&')
            .replace(/&#8217;|&rsquo;/g, "'")
            .replace(/&quot;/g, '"')
            .trim();
        };
        const title = pick('title');
        const link = pick('link');
        if (!title || !link) continue;
        const pub = pick('pubDate');
        out.push({
          id: link,
          title,
          body: pick('description').slice(0, 400),
          url: link,
          source: f.source,
          published_on: pub ? Math.floor(new Date(pub).getTime() / 1000) : Math.floor(Date.now() / 1000),
          categories: '',
        });
      }
    } catch {
      /* skip feed */
    }
  }
  return out.sort((a, b) => b.published_on - a.published_on).slice(0, 50);
}

async function fetchCalendar(): Promise<EconEvent[]> {
  const urls = [
    'https://nfs.faireconomy.media/ff_calendar_thisweek.json',
    'https://cdn-nfs.faireconomy.media/ff_calendar_thisweek.json',
  ];
  for (const u of urls) {
    const data = await getJson(u) as Array<Record<string, unknown>> | null;
    if (Array.isArray(data) && data.length) {
      return data.map((e) => ({
        title: String(e.title ?? ''),
        country: String(e.country ?? ''),
        date: String(e.date ?? ''),
        impact: String(e.impact ?? ''),
        forecast: e.forecast ? String(e.forecast) : undefined,
        previous: e.previous ? String(e.previous) : undefined,
      }));
    }
  }
  return [];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const [news, events] = await Promise.all([fetchNews(), fetchCalendar()]);
    return new Response(JSON.stringify({ news, events, fetchedAt: Date.now() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message, news: [], events: [] }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
