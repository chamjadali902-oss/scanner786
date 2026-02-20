import { useState, useCallback } from 'react';
import { ScanPool, Timeframe, ScanCondition, ScanResult, TickerData } from '@/types/scanner';
import { fetchTicker24h, getTopCoins, batchFetchKlines, isRateLimited, getRateLimitWaitTime } from '@/lib/binance';
import { calculateAllIndicators, evaluateConditions, determineBullishness } from '@/lib/scanner';
import { addAlert } from '@/lib/alerts';

interface UseScannerOptions {
  onProgress?: (current: number, total: number) => void;
}

interface ScannerState {
  status: 'idle' | 'scanning' | 'error' | 'rate-limited' | 'reconnecting';
  results: ScanResult[];
  error: string | null;
  progress: { current: number; total: number } | null;
  waitTime: number;
}

export function useScanner(options: UseScannerOptions = {}) {
  const [state, setState] = useState<ScannerState>({
    status: 'idle',
    results: [],
    error: null,
    progress: null,
    waitTime: 0,
  });

  const scanSingleTimeframe = useCallback(async (
    symbols: string[],
    timeframe: Timeframe,
    conditions: ScanCondition[],
    tickerMap: Map<string, TickerData>,
    onProgress?: (current: number, total: number) => void
  ): Promise<Map<string, { matched: boolean; reasons: string[]; values: Record<string, any>; isBullish: boolean; price: number }>> => {
    const enabledConditions = conditions.filter(c => c.enabled);
    const resultMap = new Map();

    const klinesMap = await batchFetchKlines(symbols, timeframe, 500, onProgress);

    for (const [symbol, candles] of klinesMap.entries()) {
      if (candles.length < 20) continue;

      let indicatorValues: Record<string, number | boolean | string | number[]> = {};
      for (const condition of enabledConditions) {
        const values = calculateAllIndicators(candles, condition);
        indicatorValues = { ...indicatorValues, ...values };
      }

      const { matched, reasons } = evaluateConditions(enabledConditions, indicatorValues, candles);
      
      resultMap.set(symbol, {
        matched,
        reasons,
        values: indicatorValues,
        isBullish: determineBullishness(indicatorValues),
        price: candles[candles.length - 1].close,
      });
    }

    return resultMap;
  }, []);

  const scan = useCallback(async (
    pool: ScanPool,
    timeframe: Timeframe,
    conditions: ScanCondition[],
    favoriteSymbols?: string[],
    mtfTimeframes?: Timeframe[]
  ) => {
    const enabledConditions = conditions.filter(c => c.enabled);
    
    if (enabledConditions.length === 0) {
      setState(prev => ({ ...prev, status: 'error', error: 'Please enable at least one condition' }));
      return;
    }

    if (isRateLimited()) {
      setState(prev => ({ ...prev, status: 'rate-limited', waitTime: getRateLimitWaitTime() }));
      return;
    }

    setState({ status: 'scanning', results: [], error: null, progress: { current: 0, total: 100 }, waitTime: 0 });

    try {
      let symbols: string[];
      let topCoins: TickerData[] = [];

      if (pool === 'favorites') {
        if (!favoriteSymbols || favoriteSymbols.length === 0) {
          setState(prev => ({ ...prev, status: 'error', error: 'No favorite coins added yet.' }));
          return;
        }
        symbols = favoriteSymbols;
      } else {
        const tickers = await fetchTicker24h();
        topCoins = getTopCoins(tickers, pool, 100);
        symbols = topCoins.map(t => t.symbol);
      }

      setState(prev => ({ ...prev, progress: { current: 0, total: symbols.length } }));

      // Determine all timeframes to scan
      const allTimeframes = mtfTimeframes && mtfTimeframes.length > 0
        ? mtfTimeframes
        : [timeframe];

      // Scan each timeframe
      const tfResults: Map<string, { matched: boolean; reasons: string[]; values: Record<string, any>; isBullish: boolean; price: number }>[] = [];

      for (let i = 0; i < allTimeframes.length; i++) {
        const tf = allTimeframes[i];
        const result = await scanSingleTimeframe(
          symbols, tf, conditions,
          new Map(),
          (current, total) => {
            const overallProgress = Math.floor(((i * symbols.length + current) / (allTimeframes.length * symbols.length)) * symbols.length);
            setState(prev => ({ ...prev, progress: { current: overallProgress, total: symbols.length } }));
            options.onProgress?.(overallProgress, symbols.length);
          }
        );
        tfResults.push(result);
      }

      // Get ticker data for results
      let tickerMap: Map<string, TickerData>;
      if (pool === 'favorites') {
        const tickers = await fetchTicker24h();
        tickerMap = new Map(tickers.filter(t => symbols.includes(t.symbol)).map(t => [t.symbol, t]));
      } else {
        tickerMap = new Map(topCoins.map(t => [t.symbol, t]));
      }

      // Find confluence: symbols that match on ALL timeframes
      const results: ScanResult[] = [];
      for (const symbol of symbols) {
        const allMatched = tfResults.every(tfMap => tfMap.get(symbol)?.matched);
        if (!allMatched) continue;

        // Use primary (first) timeframe for values
        const primary = tfResults[0].get(symbol);
        if (!primary) continue;

        const ticker = tickerMap.get(symbol);
        const confluenceReasons = [...primary.reasons];
        
        if (allTimeframes.length > 1) {
          confluenceReasons.push(`✅ Confluence: ${allTimeframes.length}/${allTimeframes.length} TFs`);
        }

        results.push({
          symbol,
          price: primary.price,
          priceChange24h: ticker ? parseFloat(ticker.priceChangePercent) : 0,
          volume24h: ticker ? parseFloat(ticker.quoteVolume) : 0,
          matchReasons: confluenceReasons,
          indicatorValues: {
            rsi: typeof primary.values.rsi === 'number' ? primary.values.rsi : 0,
            macd: typeof primary.values.macd_histogram === 'number' ? primary.values.macd_histogram : 0,
            adx: typeof primary.values.adx === 'number' ? primary.values.adx : 0,
            stoch_k: typeof primary.values.stoch_k === 'number' ? primary.values.stoch_k : 0,
            bb_bandwidth: typeof primary.values.bb_bandwidth === 'number' ? primary.values.bb_bandwidth : 0,
            mfi: typeof primary.values.mfi === 'number' ? primary.values.mfi : 0,
          },
          timestamp: Date.now(),
          isBullish: primary.isBullish,
        });
      }

      results.sort((a, b) => Math.abs(b.priceChange24h) - Math.abs(a.priceChange24h));

      // Send alerts for matches
      if (results.length > 0) {
        addAlert(
          'scan_match',
          `🎯 ${results.length} Match${results.length > 1 ? 'es' : ''} Found!`,
          results.slice(0, 3).map(r => `${r.symbol} (${r.priceChange24h >= 0 ? '+' : ''}${r.priceChange24h.toFixed(1)}%)`).join(', ') +
          (results.length > 3 ? ` +${results.length - 3} more` : ''),
          results[0].symbol
        );
      }

      setState({ status: 'idle', results, error: null, progress: null, waitTime: 0 });
    } catch (error) {
      console.error('Scan error:', error);
      if (isRateLimited()) {
        setState({ status: 'rate-limited', results: [], error: 'Rate limited by Binance API', progress: null, waitTime: getRateLimitWaitTime() });
      } else {
        setState({ status: 'error', results: [], error: error instanceof Error ? error.message : 'Scan failed', progress: null, waitTime: 0 });
      }
    }
  }, [options, scanSingleTimeframe]);

  const clearResults = useCallback(() => {
    setState({ status: 'idle', results: [], error: null, progress: null, waitTime: 0 });
  }, []);

  return { ...state, scan, clearResults, isScanning: state.status === 'scanning' };
}
