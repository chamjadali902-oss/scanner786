import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plug, Copy, Check, Brain, MessageSquare, ShieldCheck, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const MCP_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mcp`;
const MCP_URL_SUFFIX = '/mcp';

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

const STEPS_GEMINI = [
  'Gemini custom apps require an eligible personal Google Account, supported location and language, and Keep Activity turned on',
  'Open Gemini on the web → Settings → Connected Apps → Custom apps, then enter the complete MCP URL',
  'If Gemini says the server uses an unsupported authentication method, the URL is not the issue; stop retrying it',
  'Review Google’s OAuth connection requirements below; this app’s Gemini connection is not yet confirmed working',
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
              Connect an AI assistant to this app’s market tools, watchlist, trades and strategies.
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
          <p className="text-[11px] text-muted-foreground">
            The complete address ends in <code className="font-semibold text-foreground">{MCP_URL_SUFFIX}</code>. Your latest screenshot already includes it, so the address is not the cause of Gemini’s current error.
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

          <Card className="p-4 border-border space-y-3">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Gemini</h3>
            </div>
            <ol className="space-y-2">
              {STEPS_GEMINI.map((s, i) => (
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

        <Card className="p-4 border-destructive/40 bg-destructive/5 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Gemini connection status</h3>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              The app’s secure sign-in, OAuth discovery, and automatic client registration are enabled. Gemini is still rejecting this server before sign-in with “authentication method … doesn’t support.” That is a Gemini compatibility error—not a missing <code className="font-semibold text-foreground">/mcp</code> suffix. There is no separate Gemini URL that fixes it, and repeating the same connection will not help. I can’t confirm Gemini access until its OAuth check accepts this server.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" asChild>
              <a href="https://developers.google.com/connected-apps/mcp/oauth" target="_blank" rel="noreferrer">
                Google OAuth requirements <ExternalLink className="w-3 h-3" />
              </a>
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" asChild>
              <a href="https://support.google.com/gemini/answer/17209137?hl=en" target="_blank" rel="noreferrer">
                Gemini custom app requirements <ExternalLink className="w-3 h-3" />
              </a>
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            ChatGPT and Claude have separate connector flows. Gemini custom apps also have Google account, region, age, language and activity requirements. You can still share screenshots in Gemini itself, but this app’s live tools will not be available there until the connection succeeds.
          </p>
        </Card>
      </div>
    </AppLayout>
  );
}
