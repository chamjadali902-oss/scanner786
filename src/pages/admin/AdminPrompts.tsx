import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Brain, Save, RefreshCw, ChevronDown, ChevronUp, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface AIPrompt {
  id: string;
  key: string;
  name: string;
  description: string | null;
  system_prompt: string;
  updated_at: string;
}

const PROMPT_COLORS: Record<string, string> = {
  scanner_ai: 'text-primary bg-primary/10 border-primary/20',
  dashboard_ai: 'text-bullish bg-bullish/10 border-bullish/20',
  journal_ai: 'text-warning bg-warning/10 border-warning/20',
  smart_signals_ai: 'text-accent bg-accent/10 border-accent/20',
};

export default function AdminPrompts() {
  const [prompts, setPrompts] = useState<AIPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});

  const fetchPrompts = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('ai_prompts')
      .select('*')
      .order('created_at');
    if (!error && data) {
      const typed = data as unknown as AIPrompt[];
      setPrompts(typed);
      const initial: Record<string, string> = {};
      typed.forEach(p => { initial[p.key] = p.system_prompt; });
      setEdits(initial);
    }
    setLoading(false);
  };

  useEffect(() => { fetchPrompts(); }, []);

  const handleSave = async (prompt: AIPrompt) => {
    const newPrompt = edits[prompt.key];
    if (!newPrompt?.trim()) return;
    setSaving(prompt.key);
    const { error } = await (supabase as any)
      .from('ai_prompts')
      .update({ system_prompt: newPrompt })
      .eq('id', prompt.id);
    if (error) {
      toast.error('Save nahi hua: ' + error.message);
    } else {
      toast.success(`${prompt.name} prompt save ho gaya!`);
      await fetchPrompts();
    }
    setSaving(null);
  };

  const handleReset = (prompt: AIPrompt) => {
    setEdits(prev => ({ ...prev, [prompt.key]: prompt.system_prompt }));
  };

  const isDirty = (prompt: AIPrompt) => edits[prompt.key] !== prompt.system_prompt;

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            AI Prompts Management
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Scanner, Dashboard, Journal aur Smart Signals ke AI prompts edit karein
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchPrompts} className="gap-1.5 text-xs">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      <div className="grid gap-4">
        {prompts.map(prompt => {
          const isExpanded = expanded === prompt.key;
          const dirty = isDirty(prompt);
          const isSaving = saving === prompt.key;

          return (
            <Card key={prompt.id} className="border-border overflow-hidden">
              {/* Header */}
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/20 transition-colors"
                onClick={() => setExpanded(isExpanded ? null : prompt.key)}
              >
                <div className="flex items-center gap-3">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-foreground">{prompt.name}</span>
                      {dirty && (
                        <Badge variant="outline" className="text-[9px] text-warning border-warning/40 py-0">
                          Unsaved changes
                        </Badge>
                      )}
                    </div>
                    {prompt.description && (
                      <p className="text-xs text-muted-foreground">{prompt.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={cn('text-[10px] font-mono', PROMPT_COLORS[prompt.key] || 'text-muted-foreground')}>
                    {prompt.key}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(prompt.updated_at).toLocaleDateString('ur-PK')}
                  </span>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
              </div>

              {/* Expanded editor */}
              {isExpanded && (
                <div className="border-t border-border p-4 space-y-3 bg-card/50">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">System Prompt</p>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span>{(edits[prompt.key] || '').length} chars</span>
                      <span>•</span>
                      <span>{(edits[prompt.key] || '').split('\n').length} lines</span>
                    </div>
                  </div>

                  <Textarea
                    value={edits[prompt.key] || ''}
                    onChange={e => setEdits(prev => ({ ...prev, [prompt.key]: e.target.value }))}
                    className="font-mono text-xs min-h-[300px] resize-y bg-background border-border"
                    placeholder="System prompt yahan likhein..."
                  />

                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-muted-foreground">
                      ⚠️ Prompt change karne ke baad AI ka behaviour immediately update ho jaega
                    </p>
                    <div className="flex items-center gap-2">
                      {dirty && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-7 gap-1 text-muted-foreground"
                          onClick={() => handleReset(prompt)}
                        >
                          <RefreshCw className="w-3 h-3" /> Reset
                        </Button>
                      )}
                      <Button
                        size="sm"
                        className="text-xs h-7 gap-1.5"
                        disabled={!dirty || isSaving}
                        onClick={() => handleSave(prompt)}
                      >
                        {isSaving ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Save className="w-3 h-3" />
                        )}
                        {isSaving ? 'Saving...' : 'Save Prompt'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Info card */}
      <Card className="p-4 border-border bg-muted/20">
        <div className="flex items-start gap-3">
          <Brain className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs font-semibold text-foreground">Prompt Guide</p>
            <ul className="text-xs text-muted-foreground space-y-0.5">
              <li>• <strong>Scanner AI</strong> — Coin scan karke trade analysis deta hai (analyze-trade)</li>
              <li>• <strong>Dashboard Live Trade AI</strong> — Open trades ki real-time multi-timeframe analysis (live-trade-analysis)</li>
              <li>• <strong>Journal Trade Review AI</strong> — Trading journal ka AI coaching review (trade-review)</li>
              <li>• <strong>Smart Signals AI</strong> — Smart signals page ke liye multi-coin signals (smart-signals)</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
