import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { PriceAlertRow, refreshActiveAlerts, ensureNotificationPermission } from '@/lib/trigger-monitor';

export interface CreateAlertInput {
  symbol: string;
  timeframe?: string | null;
  direction: 'above' | 'below';
  triggerPrice: number;
  note?: string | null;
  source?: string | null;
}

export function usePriceAlerts() {
  const [alerts, setAlerts] = useState<PriceAlertRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('price_alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) {
      toast.error('Could not load trigger alerts');
    } else {
      setAlerts((data || []) as PriceAlertRow[]);
      refreshActiveAlerts();
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const createAlert = useCallback(
    async (input: CreateAlertInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Sign in to set entry trigger alerts');
        return false;
      }
      const { error } = await supabase.from('price_alerts').insert({
        user_id: user.id,
        symbol: input.symbol,
        timeframe: input.timeframe ?? null,
        direction: input.direction,
        trigger_price: input.triggerPrice,
        note: input.note ?? null,
        source: input.source ?? null,
        status: 'active',
      });
      if (error) {
        toast.error('Failed to create alert');
        return false;
      }
      await ensureNotificationPermission();
      toast.success(`${input.symbol.replace('USDT', '')} trigger set at ${input.triggerPrice}`);
      fetchAlerts();
      return true;
    },
    [fetchAlerts]
  );

  const removeAlert = useCallback(
    async (id: string) => {
      await supabase.from('price_alerts').delete().eq('id', id);
      setAlerts((prev) => prev.filter((a) => a.id !== id));
      refreshActiveAlerts();
    },
    []
  );

  const setStatus = useCallback(
    async (id: string, status: 'active' | 'paused') => {
      await supabase.from('price_alerts').update({ status }).eq('id', id);
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
      refreshActiveAlerts();
    },
    []
  );

  const clearTriggered = useCallback(async () => {
    await supabase.from('price_alerts').delete().eq('status', 'triggered');
    setAlerts((prev) => prev.filter((a) => a.status !== 'triggered'));
  }, []);

  return { alerts, loading, createAlert, removeAlert, setStatus, clearTriggered, refetch: fetchAlerts };
}
