import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ScanCondition, ScanPool, Timeframe } from '@/types/scanner';
import { useToast } from '@/hooks/use-toast';

export interface SavedStrategy {
  id: string;
  name: string;
  description: string | null;
  scan_pool: string;
  timeframe: string;
  conditions: ScanCondition[];
  created_at: string;
  updated_at: string;
}

export function useStrategies(userId: string | undefined) {
  const [strategies, setStrategies] = useState<SavedStrategy[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchStrategies = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('saved_strategies')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setStrategies((data || []).map(d => ({
        ...d,
        conditions: (d.conditions as any) || [],
      })));
    }
    setLoading(false);
  }, [userId, toast]);

  useEffect(() => {
    fetchStrategies();
  }, [fetchStrategies]);

  const saveStrategy = async (name: string, description: string, scanPool: ScanPool, timeframe: Timeframe, conditions: ScanCondition[]) => {
    if (!userId) return;
    const { error } = await supabase.from('saved_strategies').insert({
      user_id: userId,
      name,
      description,
      scan_pool: scanPool,
      timeframe,
      conditions: conditions as any,
    });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Strategy saved!' });
      fetchStrategies();
    }
  };

  const updateStrategy = async (id: string, name: string, description: string) => {
    const { error } = await supabase.from('saved_strategies').update({ name, description }).eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Strategy updated!' });
      fetchStrategies();
    }
  };

  const deleteStrategy = async (id: string) => {
    const { error } = await supabase.from('saved_strategies').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Strategy deleted' });
      fetchStrategies();
    }
  };

  return { strategies, loading, saveStrategy, updateStrategy, deleteStrategy, refetch: fetchStrategies };
}
