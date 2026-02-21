import { useState, useCallback } from 'react';
import { Trade } from '@/hooks/useTrades';
import { supabase } from '@/integrations/supabase/client';
import { calcRSI, calcEMA, calcMACD, detectTrend } from '@/lib/trade-indicators';
import { fetchKlinesRaw, ALL_TIMEFRAMES } from '@/lib/market-api';
import type { TFData, Analysis } from './types';

export function useTradeAnalysis(trade: Trade, currentPrice: number | null) {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tfData, setTfData] = useState<TFData[]>([]);

  const fetchAndAnalyze = useCallback(async () => {
    setLoading(true);
    setError(null);
    setExpanded(true);

    try {
      // Fetch klines for all timeframes in parallel
      const klineResults = await Promise.all(
        ALL_TIMEFRAMES.map(async (tf) => {
          const candles = await fetchKlinesRaw(trade.symbol, tf, 500);
          return candles ? { tf, candles } : null;
        })
      );

      const timeframeData: TFData[] = klineResults
        .filter(Boolean)
        .map(({ tf, candles }: any) => {
          const closes = candles.map((c: any) => c.close);
          const rsi = calcRSI(closes);
          const macd = calcMACD(closes);
          const ema20 = calcEMA(closes, 20);
          const ema50 = calcEMA(closes, 50);
          const price = closes[closes.length - 1];
          const trend = detectTrend(currentPrice ?? price, ema20, ema50);

          return {
            tf,
            rsi,
            macd,
            ema20,
            ema50,
            currentPrice: currentPrice ?? price,
            trend,
            lastCandles: candles.slice(-5),
          };
        });

      setTfData(timeframeData);

      const { data, error: fnError } = await supabase.functions.invoke('live-trade-analysis', {
        body: {
          symbol: trade.symbol,
          side: trade.side,
          entryPrice: trade.entry_price,
          stopLoss: trade.stop_loss,
          takeProfit: trade.take_profit,
          quantity: trade.quantity,
          timeframeData,
        },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setAnalysis(data);
    } catch (e: any) {
      setError(e.message || 'Analysis failed');
    } finally {
      setLoading(false);
    }
  }, [trade, currentPrice]);

  return {
    analysis,
    loading,
    expanded,
    setExpanded,
    error,
    tfData,
    fetchAndAnalyze,
  };
}
