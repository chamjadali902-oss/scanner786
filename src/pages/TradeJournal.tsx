import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTrades } from '@/hooks/useTrades';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Brain, Loader2, BookOpen, Award, AlertTriangle, TrendingUp, Target, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface TradeReview {
  symbol: string;
  grade: string;
  whatWentRight: string;
  whatWentWrong: string;
  lesson: string;
}

interface ImprovementItem {
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  area: string;
  action: string;
  timeframe: string;
}

interface JournalReview {
  overallGrade: string;
  overallScore: number;
  strengths: string[];
  weaknesses: string[];
  emotionalPatterns: string;
  riskManagement: {
    score: number;
    feedback: string;
    suggestions: string[];
  };
  tradeReviews: TradeReview[];
  improvementPlan: ImprovementItem[];
  summary: string;
}

const GRADE_COLORS: Record<string, string> = {
  A: 'text-bullish bg-bullish/10 border-bullish/30',
  B: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  C: 'text-warning bg-warning/10 border-warning/30',
  D: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  F: 'text-bearish bg-bearish/10 border-bearish/30',
};

export default function TradeJournal() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { trades, loading: tradesLoading, getStats } = useTrades(user?.id);
  const [review, setReview] = useState<JournalReview | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  const requestReview = async () => {
    const stats = getStats();
    if (trades.length === 0) {
      toast({ title: 'No trades', description: 'Add some trades first to get an AI review.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('trade-review', {
        body: { trades: trades.slice(0, 30), stats },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setReview(data);
    } catch (err: any) {
      toast({ title: 'Review failed', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const gradeColor = (g: string) => GRADE_COLORS[g] || GRADE_COLORS.C;

  return (
    <AppLayout className="flex-1 overflow-y-auto custom-scrollbar">
      <div className="container mx-auto px-3 sm:px-4 py-4 max-w-4xl space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              <span className="text-gradient-primary">AI Trade Journal</span>
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">AI reviews your trades and gives coaching feedback</p>
          </div>
          <Button onClick={requestReview} disabled={loading || tradesLoading} className="gap-2 h-8 text-xs">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
            {loading ? 'Reviewing...' : 'Get AI Review'}
          </Button>
        </div>

        {/* Empty state */}
        {!review && !loading && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <BookOpen className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-base font-bold mb-1">Trading Coach AI</h2>
            <p className="text-xs text-muted-foreground mb-4 max-w-sm">
              Get AI-powered review of your trades — strengths, weaknesses, emotional patterns, and an improvement plan.
            </p>
            <p className="text-[10px] text-muted-foreground mb-4">
              {trades.length} trades loaded • {trades.filter(t => t.status === 'closed').length} closed
            </p>
            <Button onClick={requestReview} disabled={trades.length === 0} className="gap-2">
              <Brain className="w-4 h-4" /> Analyze My Trades
            </Button>
          </div>
        )}

        {review && (
          <div className="space-y-4">
            {/* Overall Grade */}
            <Card className="p-4 card-glow">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={cn('w-14 h-14 rounded-xl flex items-center justify-center text-2xl font-extrabold border', gradeColor(review.overallGrade))}>
                    {review.overallGrade}
                  </div>
                  <div>
                    <p className="text-sm font-bold">Overall Score</p>
                    <p className="text-xs text-muted-foreground">Score: {review.overallScore}/100</p>
                  </div>
                </div>
                <Award className="w-6 h-6 text-primary opacity-50" />
              </div>
              <p className="text-xs text-muted-foreground">{review.summary}</p>
            </Card>

            {/* Strengths & Weaknesses */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Card className="p-3 space-y-2">
                <p className="text-xs font-bold flex items-center gap-1.5 text-bullish"><CheckCircle2 className="w-3.5 h-3.5" /> Strengths</p>
                {review.strengths?.map((s, i) => (
                  <p key={i} className="text-[11px] flex items-start gap-1.5">
                    <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-bullish shrink-0" /> {s}
                  </p>
                ))}
              </Card>
              <Card className="p-3 space-y-2">
                <p className="text-xs font-bold flex items-center gap-1.5 text-bearish"><XCircle className="w-3.5 h-3.5" /> Weaknesses</p>
                {review.weaknesses?.map((w, i) => (
                  <p key={i} className="text-[11px] flex items-start gap-1.5">
                    <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-bearish shrink-0" /> {w}
                  </p>
                ))}
              </Card>
            </div>

            {/* Risk Management */}
            {review.riskManagement && (
              <Card className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold flex items-center gap-1.5"><Target className="w-3.5 h-3.5 text-primary" /> Risk Management</p>
                  <span className={cn('text-xs font-mono font-bold', review.riskManagement.score >= 70 ? 'text-bullish' : 'text-warning')}>
                    {review.riskManagement.score}/100
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">{review.riskManagement.feedback}</p>
                {review.riskManagement.suggestions?.map((s, i) => (
                  <p key={i} className="text-[11px] flex items-start gap-1.5">
                    <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" /> {s}
                  </p>
                ))}
              </Card>
            )}

            {/* Emotional Patterns */}
            {review.emotionalPatterns && (
              <Card className="p-3 space-y-2">
                <p className="text-xs font-bold flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 text-warning" /> Emotional Patterns</p>
                <p className="text-[11px] text-muted-foreground">{review.emotionalPatterns}</p>
              </Card>
            )}

            {/* Trade Reviews */}
            {review.tradeReviews?.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold">Individual Trade Reviews</p>
                {review.tradeReviews.map((tr, i) => (
                  <Card key={i} className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-xs">{tr.symbol}</span>
                      <Badge variant="outline" className={cn('text-[9px]', gradeColor(tr.grade))}>{tr.grade}</Badge>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                      <div><span className="text-bullish font-medium">✓ Right:</span> <span className="text-muted-foreground">{tr.whatWentRight}</span></div>
                      <div><span className="text-bearish font-medium">✗ Wrong:</span> <span className="text-muted-foreground">{tr.whatWentWrong}</span></div>
                    </div>
                    <p className="text-[10px] text-primary italic">💡 {tr.lesson}</p>
                  </Card>
                ))}
              </div>
            )}

            {/* Improvement Plan */}
            {review.improvementPlan?.length > 0 && (
              <Card className="p-3 space-y-2">
                <p className="text-xs font-bold flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5 text-primary" /> Improvement Plan</p>
                {review.improvementPlan.map((item, i) => (
                  <div key={i} className="flex items-start gap-2 text-[11px] p-2 rounded bg-background/60">
                    <Badge variant="outline" className={cn('text-[8px] shrink-0',
                      item.priority === 'HIGH' ? 'text-bearish border-bearish/30' :
                      item.priority === 'MEDIUM' ? 'text-warning border-warning/30' : 'text-muted-foreground'
                    )}>{item.priority}</Badge>
                    <div>
                      <p className="font-medium">{item.area}</p>
                      <p className="text-muted-foreground">{item.action}</p>
                      <p className="text-[10px] text-primary mt-0.5">⏱ {item.timeframe}</p>
                    </div>
                  </div>
                ))}
              </Card>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
