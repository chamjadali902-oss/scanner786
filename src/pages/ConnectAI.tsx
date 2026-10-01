import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plug, Copy, Check, Brain, MessageSquare, ShieldCheck, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const MCP_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mcp`;

const TOOLS = [
  { name: 'get_market_snapshot', desc: 'Live Binance price, 24h stats, EMA20/50, RSI, swing levels for any coin & timeframe' },
  { name: 'list_favorite_coins', desc: 'Read your scanner watchlist' },
  { name: 'add_favorite_coin', desc: 'Add a coin to your watchlist' },
  { name: 'remove_favorite_coin', desc: 'Remove a coin from your watchlist' },
  { name: 'list_trades', desc: 'Read your trade journal (open/closed)' },
  { name: 'log_trade', desc: 'Record a new trade in your journal' },
  { name: 'list_saved_strategies', desc: 'Read your saved scanner strategies' },
];

const STEPS_CHATGPT = [
  'Open ChatGPT (paid plan required for custom connectors) → Settings → Connectors → Advanced → Developer Mode ON',
  'Create a new connector and paste the MCP URL below',
  'Authentication: OAuth — approve access when this app asks you to sign in',
  'Start a chat and ask things like "Give me a BTC 4h snapshot" or "Show my favorite coins"',
];

const STEPS_CLAUDE = [
  'Open Claude → Settings → Connectors → Add custom connector',
  'Paste the MCP URL below',
  'Sign in with your app account when the approval screen opens',
  'Ask Claude to analyse any coin using your live data',
];

export default function ConnectAI() {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(MCP_URL);
      setCopied(true);
      toast({ title: 'Copied', description: 'MCP URL copied to clipboard' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Copy failed', description: MCP_URL, variant: 'destructive' });
    }
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-3 sm:px-4 py-6 max-w-3xl space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Plug className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Connect your AI</h1>
            <p className="text-xs text-muted-foreground">
              Link ChatGPT or Claude to this app so it can analyse with your live market data, watchlist, trades and strategies.
            </p>
          </div>
        </div>

        {/* MCP URL */}
        <Card className="p-4 border-border space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Your MCP connection URL</h2>
            <Badge className="bg-bullish/10 text-bullish border-bullish/20 gap-1">
              <ShieldCheck className="w-3 h-3" /> Secure sign-in
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-[11px] bg-muted/60 border border-border rounded-lg px-3 py-2.5 overflow-x-auto whitespace-nowrap">
              {MCP_URL}
            </code>
            <Button size="sm" onClick={copyUrl} className="gap-1.5 shrink-0">
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            When the AI connects, it signs in as you — it only sees your own data, never anyone else's.
          </p>
        </Card>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-4 border-border space-y-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">ChatGPT</h3>
            </div>
            <ol className="space-y-2">
              {STEPS_CHATGPT.map((s, i) => (
                <li key={i} className="flex gap-2 text-[11px] text-muted-foreground">
                  <span className="w-4 h-4 rounded-full bg-primary/10 text-primary text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
          </Card>

          <Card className="p-4 border-border space-y-3">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Claude</h3>
            </div>
            <ol className="space-y-2">
              {STEPS_CLAUDE.map((s, i) => (
                <li key={i} className="flex gap-2 text-[11px] text-muted-foreground">
                  <span className="w-4 h-4 rounded-full bg-primary/10 text-primary text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
          </Card>
        </div>

        {/* What the AI can do */}
        <Card className="p-4 border-border space-y-3">
          <h3 className="text-sm font-semibold text-foreground">What your AI gets access to</h3>
          <div className="space-y-2">
            {TOOLS.map(t => (
              <div key={t.name} className="flex items-start gap-2 text-[11px]">
                <code className="bg-muted/60 border border-border rounded px-1.5 py-0.5 text-[10px] text-primary shrink-0">{t.name}</code>
                <span className="text-muted-foreground">{t.desc}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4 border-border bg-muted/30">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground">Note:</span> ChatGPT requires a paid plan for custom connectors. Claude supports custom connectors on its app. Gemini does not currently support external connectors. After connecting, you can chat with your AI normally and share screenshots — it will combine them with this app's live data.
          </p>
          <Button variant="outline" size="sm" className="mt-3 gap-1.5 text-xs" asChild>
            <a href="https://modelcontextprotocol.io" target="_blank" rel="noreferrer">
              Learn more about MCP <ExternalLink className="w-3 h-3" />
            </a>
          </Button>
        </Card>
      </div>
    </AppLayout>
  );
}
