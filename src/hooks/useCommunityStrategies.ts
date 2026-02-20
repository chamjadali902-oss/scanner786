import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ScanCondition, ScanPool, Timeframe } from '@/types/scanner';
import { useToast } from '@/hooks/use-toast';

export interface CommunityStrategy {
  id: string;
  user_id: string;
  author_name: string;
  name: string;
  description: string | null;
  scan_pool: string;
  timeframe: string;
  conditions: ScanCondition[];
  likes_count: number;
  copies_count: number;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  user_has_liked?: boolean;
}

export function useCommunityStrategies(userId?: string) {
  const [strategies, setStrategies] = useState<CommunityStrategy[]>([]);
  const [loading, setLoading] = useState(false);
  const [userLikes, setUserLikes] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const fetchStrategies = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('community_strategies')
      .select('*')
      .eq('is_public', true)
      .order('likes_count', { ascending: false });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setStrategies((data || []).map(d => ({
        ...d,
        conditions: (d.conditions as any) || [],
      })));
    }
    setLoading(false);
  }, [toast]);

  const fetchUserLikes = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('strategy_likes')
      .select('strategy_id')
      .eq('user_id', userId);
    if (data) {
      setUserLikes(new Set(data.map(d => d.strategy_id)));
    }
  }, [userId]);

  useEffect(() => {
    fetchStrategies();
    fetchUserLikes();
  }, [fetchStrategies, fetchUserLikes]);

  const publishStrategy = async (
    name: string,
    description: string,
    scanPool: ScanPool,
    timeframe: Timeframe,
    conditions: ScanCondition[],
    authorName: string
  ) => {
    if (!userId) return;
    const { error } = await supabase.from('community_strategies').insert({
      user_id: userId,
      author_name: authorName,
      name,
      description,
      scan_pool: scanPool,
      timeframe,
      conditions: conditions as any,
    });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Strategy published to marketplace!' });
      fetchStrategies();
    }
  };

  const toggleLike = async (strategyId: string) => {
    if (!userId) return;
    const hasLiked = userLikes.has(strategyId);

    if (hasLiked) {
      await supabase.from('strategy_likes').delete()
        .eq('user_id', userId)
        .eq('strategy_id', strategyId);
      setUserLikes(prev => { const n = new Set(prev); n.delete(strategyId); return n; });
    } else {
      await supabase.from('strategy_likes').insert({
        user_id: userId,
        strategy_id: strategyId,
      });
      setUserLikes(prev => new Set(prev).add(strategyId));
    }
    fetchStrategies();
  };

  const copyStrategy = async (strategyId: string) => {
    // Increment copy count
    const strategy = strategies.find(s => s.id === strategyId);
    if (strategy) {
      await supabase.from('community_strategies')
        .update({ copies_count: strategy.copies_count + 1 })
        .eq('id', strategyId);
    }
  };

  const deleteStrategy = async (strategyId: string) => {
    const { error } = await supabase.from('community_strategies').delete().eq('id', strategyId);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Strategy removed from marketplace' });
      fetchStrategies();
    }
  };

  const hasLiked = (strategyId: string) => userLikes.has(strategyId);

  return { strategies, loading, publishStrategy, toggleLike, copyStrategy, deleteStrategy, hasLiked, refetch: fetchStrategies };
}
