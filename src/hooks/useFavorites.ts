import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface FavoriteCoin {
  id: string;
  symbol: string;
  added_at: string;
}

export function useFavorites(userId?: string) {
  const [favorites, setFavorites] = useState<FavoriteCoin[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchFavorites = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('favorite_coins')
      .select('id, symbol, added_at')
      .eq('user_id', userId)
      .order('added_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch favorites:', error);
    } else {
      setFavorites(data || []);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  const addFavorite = useCallback(async (symbol: string) => {
    if (!userId) return;
    const { error } = await supabase
      .from('favorite_coins')
      .insert({ user_id: userId, symbol });

    if (error) {
      if (error.code === '23505') {
        toast.info(`${symbol} is already in favorites`);
      } else {
        toast.error('Failed to add favorite');
      }
      return;
    }
    toast.success(`${symbol.replace('USDT', '')} added to favorites`);
    fetchFavorites();
  }, [userId, fetchFavorites]);

  const addAllFavorites = useCallback(async (symbols: string[]) => {
    if (!userId || symbols.length === 0) return;
    const existingSymbols = favorites.map(f => f.symbol);
    const newSymbols = symbols.filter(s => !existingSymbols.includes(s));
    if (newSymbols.length === 0) {
      toast.info('All coins are already in favorites');
      return;
    }
    const rows = newSymbols.map(symbol => ({ user_id: userId, symbol }));
    const { error } = await supabase
      .from('favorite_coins')
      .insert(rows);

    if (error) {
      toast.error('Failed to add favorites');
      return;
    }
    toast.success(`${newSymbols.length} coins added to favorites`);
    fetchFavorites();
  }, [userId, favorites, fetchFavorites]);

  const removeAllFavorites = useCallback(async () => {
    if (!userId || favorites.length === 0) return;
    const { error } = await supabase
      .from('favorite_coins')
      .delete()
      .eq('user_id', userId);

    if (error) {
      toast.error('Failed to remove all favorites');
      return;
    }
    toast.success(`All favorites removed`);
    setFavorites([]);
  }, [userId, favorites]);

  const removeFavorite = useCallback(async (symbol: string) => {
    if (!userId) return;
    const { error } = await supabase
      .from('favorite_coins')
      .delete()
      .eq('user_id', userId)
      .eq('symbol', symbol);

    if (error) {
      toast.error('Failed to remove favorite');
      return;
    }
    toast.success(`${symbol.replace('USDT', '')} removed from favorites`);
    setFavorites(prev => prev.filter(f => f.symbol !== symbol));
  }, [userId]);

  const isFavorite = useCallback((symbol: string) => {
    return favorites.some(f => f.symbol === symbol);
  }, [favorites]);

  const getFavoriteSymbols = useCallback(() => {
    return favorites.map(f => f.symbol);
  }, [favorites]);

  return { favorites, loading, addFavorite, addAllFavorites, removeFavorite, removeAllFavorites, isFavorite, getFavoriteSymbols, fetchFavorites };
}
