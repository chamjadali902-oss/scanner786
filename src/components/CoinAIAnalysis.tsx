import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Brain, Send, Loader2, Sparkles, Copy, Check } from 'lucide-react';
import { MarkdownMessage } from '@/components/MarkdownMessage';
import { cn } from '@/lib/utils';

type Msg = { role: 'user' | 'assistant'; content: string };
const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/trading-chat`;

export function CoinAIAnalysis({ symbol, timeframe }: { symbol: string; timeframe: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMessages([]); }, [symbol]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [messages]);

  const send = async (text: string, history: Msg[] = messages) => {
    if (!text.trim() || loading) return;
    const userMsg: Msg = { role: 'user', content: text.trim() };
    const all = [...history, userMsg];
    setMessages(all);
    setInput('');
    setLoading(true);
    let acc = '';
    try {
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ messages: all }),
      });
      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({ error: 'AI request failed' }));
        throw new Error(err.error || 'AI request failed');
      }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let done = false;
      while (!done) {
        const r = await reader.read();
        if (r.done) break;
        buf += decoder.decode(r.value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf('\n')) !== -1) {
          let line = buf.slice(0, idx);
          buf = buf.slice(idx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (json === '[DONE]') { done = true; break; }
          try {
            const c = JSON.parse(json).choices?.[0]?.delta?.content as string | undefined;
            if (c) {
              acc += c;
              setMessages([...all, { role: 'assistant', content: acc }]);
            }
          } catch { buf = line + '\n' + buf; break; }
        }
      }
    } catch (e) {
      setMessages([...all, { role: 'assistant', content: `Error: ${(e as Error).message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const runFull = () => send(
    `Give me the complete professional analysis of ${symbol} on the ${timeframe} timeframe (futures) using fresh live data: market structure, SMC and ICT (order blocks, FVG, liquidity sweeps, BOS/CHoCH), price action, live indicators (RSI, EMA, MACD, Supertrend, volume), funding, open interest, long/short ratio and order flow. End with a clear trade plan: bias, entry zone, stop loss, targets and invalidation.`,
    [],
  );

  const lastAnswer = [...messages].reverse().find(m => m.role === 'assistant')?.content;

  return (
    <div className="rounded-xl border bg-card p-3 sm:p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-bold">AI Full Analysis</h2>
          <span className="text-[10px] text-muted-foreground">{symbol} · {timeframe} · live data, indicators, SMC</span>
        </div>
        <div className="flex gap-2">
          {lastAnswer && (
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => { navigator.clipboard.writeText(lastAnswer); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} Copy
            </Button>
          )}
          <Button size="sm" onClick={runFull} disabled={loading} className="gap-1.5">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {messages.length ? 'Re-analyse' : 'Analyse with AI'}
          </Button>
        </div>
      </div>

      {messages.length > 0 && (
        <div className="max-h-[600px] overflow-y-auto space-y-3 pr-1">
          {messages.slice(1).length === 0 && loading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-4"><Loader2 className="w-4 h-4 animate-spin" /> Reading live data...</div>
          )}
          {messages.map((m, i) => i === 0 ? null : (
            <div key={i} className={cn('rounded-lg px-3 py-2 text-sm', m.role === 'user' ? 'bg-primary text-primary-foreground ml-auto max-w-[85%] w-fit' : 'bg-muted/40 border')}>
              {m.role === 'assistant' ? <MarkdownMessage content={m.content} /> : <p className="whitespace-pre-wrap">{m.content}</p>}
            </div>
          ))}
          {loading && messages[messages.length - 1]?.role === 'user' && messages.length > 1 && (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {messages.length > 1 && (
        <div className="flex gap-2">
          <Input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); send(`${input} (about ${symbol} ${timeframe})`); } }} placeholder="Ask a follow-up question..." className="h-9 text-sm" />
          <Button size="icon" className="h-9 w-9 shrink-0" disabled={!input.trim() || loading} onClick={() => send(`${input} (about ${symbol} ${timeframe})`)}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
