import { useEffect, useRef, useState } from 'react';
import { TickerData } from '@/types/scanner';

interface RawTicker {
  s: string; // symbol
  c: string; // last price
  P: string; // price change percent
  p: string; // price change
  h: string; // high
  l: string; // low
  v: string; // base volume
  q: string; // quote volume
}

export interface StreamTicker extends TickerData {
  highPrice: string;
  lowPrice: string;
}

/**
 * Live stream of all Binance spot tickers (!ticker@arr, ~1s batches).
 * Returns a map keyed by symbol plus the last update timestamp.
 */
export function useAllTickersStream(enabled = true) {
  const [map, setMap] = useState<Map<string, StreamTicker>>(new Map());
  const [connected, setConnected] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const buffer = useRef<Map<string, StreamTicker>>(new Map());

  useEffect(() => {
    if (!enabled) return;
    let ws: WebSocket | null = null;
    let closed = false;
    let retry: ReturnType<typeof setTimeout> | null = null;

    const flush = setInterval(() => {
      if (buffer.current.size === 0) return;
      const batch = buffer.current;
      buffer.current = new Map();
      setMap(prev => {
        const next = new Map(prev);
        batch.forEach((v, k) => next.set(k, v));
        return next;
      });
      setUpdatedAt(Date.now());
    }, 1500);

    const connect = () => {
      try {
        ws = new WebSocket('wss://stream.binance.com:9443/ws/!ticker@arr');
      } catch {
        return;
      }
      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        if (!closed) retry = setTimeout(connect, 5000);
      };
      ws.onerror = () => ws?.close();
      ws.onmessage = ev => {
        try {
          const arr = JSON.parse(ev.data) as RawTicker[];
          if (!Array.isArray(arr)) return;
          for (const t of arr) {
            if (!t.s?.endsWith('USDT')) continue;
            buffer.current.set(t.s, {
              symbol: t.s,
              priceChange: t.p,
              priceChangePercent: t.P,
              lastPrice: t.c,
              volume: t.v,
              quoteVolume: t.q,
              highPrice: t.h,
              lowPrice: t.l,
            });
          }
        } catch {
          /* ignore malformed frame */
        }
      };
    };
    connect();

    return () => {
      closed = true;
      clearInterval(flush);
      if (retry) clearTimeout(retry);
      ws?.close();
    };
  }, [enabled]);

  return { tickers: map, connected, updatedAt };
}

/** Live stream for a single symbol's 24h ticker. */
export function useSymbolTickerStream(symbol: string) {
  const [ticker, setTicker] = useState<StreamTicker | null>(null);
  const [connected, setConnected] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!symbol) return;
    let ws: WebSocket | null = null;
    let closed = false;
    let retry: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      try {
        ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@ticker`);
      } catch {
        return;
      }
      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        if (!closed) retry = setTimeout(connect, 5000);
      };
      ws.onerror = () => ws?.close();
      ws.onmessage = ev => {
        try {
          const t = JSON.parse(ev.data) as RawTicker;
          if (!t?.c) return;
          setTicker({
            symbol: t.s,
            priceChange: t.p,
            priceChangePercent: t.P,
            lastPrice: t.c,
            volume: t.v,
            quoteVolume: t.q,
            highPrice: t.h,
            lowPrice: t.l,
          });
          setUpdatedAt(Date.now());
        } catch {
          /* ignore */
        }
      };
    };
    connect();

    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      ws?.close();
    };
  }, [symbol]);

  return { ticker, connected, updatedAt };
}
