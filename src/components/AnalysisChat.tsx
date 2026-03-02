import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Brain, Send, Loader2, MessageCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

type Msg = { role: 'user' | 'assistant'; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/trading-chat`;

interface AnalysisChatProps {
  contextSummary: string;
  className?: string;
}

export function AnalysisChat({ contextSummary, className }: AnalysisChatProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: Msg = { role: 'user', content: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    let assistantSoFar = '';
    // Build messages with context as system-like first user message
    const contextMsg: Msg = {
      role: 'user',
      content: `[CONTEXT - This is the current analysis data, answer questions based on this]\n${contextSummary}`,
    };
    const contextAck: Msg = {
      role: 'assistant',
      content: 'I have the analysis data. Ask me anything about it!',
    };
    const allMessages = [contextMsg, contextAck, ...messages, userMsg];

    try {
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: allMessages }),
      });

      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({ error: 'Failed' }));
        throw new Error(err.error || 'Stream failed');
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantSoFar += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
                }
                return [...prev, { role: 'assistant', content: assistantSoFar }];
              });
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${e.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        className={cn('gap-1.5 text-[10px] h-7 border-primary/30 text-primary hover:bg-primary/10', className)}
        onClick={() => setOpen(true)}
      >
        <MessageCircle className="w-3 h-3" /> Ask AI about this
      </Button>
    );
  }

  return (
    <div className={cn('rounded-lg border border-primary/20 bg-card/80 overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-2.5 py-1.5 bg-primary/5 border-b border-primary/10">
        <div className="flex items-center gap-1.5">
          <Brain className="w-3 h-3 text-primary" />
          <span className="text-[10px] font-semibold text-primary">Ask AI about this analysis</span>
        </div>
        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setOpen(false)}>
          <X className="w-3 h-3 text-muted-foreground" />
        </Button>
      </div>

      {/* Messages */}
      <div className="max-h-48 overflow-y-auto p-2 space-y-2 custom-scrollbar">
        {messages.length === 0 && (
          <div className="text-center py-3">
            <p className="text-[10px] text-muted-foreground mb-2">Ask follow-up questions about this analysis</p>
            <div className="flex flex-wrap gap-1 justify-center">
              {['Is this a trap?', 'Best entry point?', 'Risk assessment?'].map(q => (
                <Button key={q} variant="outline" size="sm" className="text-[9px] h-5 px-2" onClick={() => send(q)}>
                  {q}
                </Button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={cn('flex gap-1.5', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            {msg.role === 'assistant' && (
              <div className="w-5 h-5 rounded bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <Brain className="w-2.5 h-2.5 text-primary" />
              </div>
            )}
            <div className={cn(
              'max-w-[85%] rounded-lg px-2 py-1.5 text-[11px]',
              msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted/50 border border-border'
            )}>
              {msg.role === 'assistant' ? (
                <div className="prose prose-sm prose-invert max-w-none [&_p]:mb-1 [&_ul]:mb-1 [&_h1]:text-xs [&_h2]:text-xs [&_h3]:text-[11px] [&_code]:text-[9px] [&_code]:bg-muted [&_code]:px-1 [&_code]:rounded">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
          </div>
        ))}

        {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="flex gap-1.5">
            <div className="w-5 h-5 rounded bg-primary/10 flex items-center justify-center shrink-0">
              <Brain className="w-2.5 h-2.5 text-primary" />
            </div>
            <div className="bg-muted/50 border border-border rounded-lg px-2 py-1.5">
              <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-1.5 p-2 border-t border-border">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); send(input); } }}
          placeholder="Ask a question..."
          className="h-7 text-[11px]"
        />
        <Button onClick={() => send(input)} disabled={!input.trim() || isLoading} size="icon" className="h-7 w-7 shrink-0">
          {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
        </Button>
      </div>
    </div>
  );
}
