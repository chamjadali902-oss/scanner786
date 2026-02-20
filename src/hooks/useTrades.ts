import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Trade {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  entry_price: number;
  exit_price: number | null;
  quantity: number;
  stop_loss: number | null;
  take_profit: number | null;
  status: 'open' | 'closed' | 'cancelled';
  pnl: number | null;
  pnl_percent: number | null;
  notes: string | null;
  tags: string[] | null;
  opened_at: string;
  closed_at: string | null;
  created_at: string;
}

export interface TradeStats {
  totalTrades: number;
  winRate: number;
  totalPnl: number;
  avgPnlPercent: number;
  bestTrade: number;
  worstTrade: number;
  openTrades: number;
}

export function useTrades(userId?: string) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchTrades = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setTrades((data || []).map(d => ({
        ...d,
        entry_price: Number(d.entry_price),
        exit_price: d.exit_price ? Number(d.exit_price) : null,
        quantity: Number(d.quantity),
        stop_loss: d.stop_loss ? Number(d.stop_loss) : null,
        take_profit: d.take_profit ? Number(d.take_profit) : null,
        pnl: d.pnl ? Number(d.pnl) : null,
        pnl_percent: d.pnl_percent ? Number(d.pnl_percent) : null,
      })) as Trade[]);
    }
    setLoading(false);
  }, [userId, toast]);

  useEffect(() => { fetchTrades(); }, [fetchTrades]);

  const addTrade = async (trade: Omit<Trade, 'id' | 'created_at' | 'pnl' | 'pnl_percent' | 'closed_at'>) => {
    if (!userId) return;
    const { error } = await supabase.from('trades').insert({ ...trade, user_id: userId } as any);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Trade added!' });
      fetchTrades();
    }
  };

  const closeTrade = async (id: string, exitPrice: number) => {
    if (!userId) return;
    const trade = trades.find(t => t.id === id);
    if (!trade) return;

    const pnl = trade.side === 'long'
      ? (exitPrice - trade.entry_price) * trade.quantity
      : (trade.entry_price - exitPrice) * trade.quantity;
    const pnlPercent = trade.side === 'long'
      ? ((exitPrice - trade.entry_price) / trade.entry_price) * 100
      : ((trade.entry_price - exitPrice) / trade.entry_price) * 100;

    const { error } = await supabase.from('trades').update({
      exit_price: exitPrice,
      pnl: pnl,
      pnl_percent: pnlPercent,
      status: 'closed',
      closed_at: new Date().toISOString(),
    }).eq('id', id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Trade closed!' });
      fetchTrades();
    }
  };

  const deleteTrade = async (id: string) => {
    const { error } = await supabase.from('trades').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Trade deleted' });
      fetchTrades();
    }
  };

  const getStats = useCallback((): TradeStats => {
    const closed = trades.filter(t => t.status === 'closed');
    const wins = closed.filter(t => (t.pnl ?? 0) > 0);
    const totalPnl = closed.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
    const avgPnl = closed.length > 0
      ? closed.reduce((sum, t) => sum + (t.pnl_percent ?? 0), 0) / closed.length
      : 0;
    const pnls = closed.map(t => t.pnl ?? 0);

    return {
      totalTrades: closed.length,
      winRate: closed.length > 0 ? (wins.length / closed.length) * 100 : 0,
      totalPnl,
      avgPnlPercent: avgPnl,
      bestTrade: pnls.length > 0 ? Math.max(...pnls) : 0,
      worstTrade: pnls.length > 0 ? Math.min(...pnls) : 0,
      openTrades: trades.filter(t => t.status === 'open').length,
    };
  }, [trades]);

  return { trades, loading, addTrade, closeTrade, deleteTrade, getStats, refetch: fetchTrades };
}
