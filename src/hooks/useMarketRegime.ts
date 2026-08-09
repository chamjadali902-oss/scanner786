import { useEffect, useState } from 'react';
import { detectMarketRegime, MarketRegime } from '@/lib/market-regime';

export function useMarketRegime() {
  const [regime, setRegime] = useState<MarketRegime | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await detectMarketRegime();
        if (!cancelled) setRegime(r);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Regime detect failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { regime, loading, error };
}
