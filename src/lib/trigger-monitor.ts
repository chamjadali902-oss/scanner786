// Entry Trigger Alert monitor: checks active price alerts against live Binance
// prices and fires in-app alerts + browser notifications when a level is hit.

import { supabase } from '@/integrations/supabase/client';
import { addAlert, requestNotificationPermission } from './alerts';

export interface PriceAlertRow {
  id: string;
  user_id: string;
  symbol: string;
  timeframe: string | null;
  direction: 'above' | 'below';
  trigger_price: number;
  note: string | null;
  source: string | null;
  status: 'active' | 'triggered' | 'paused';
  triggered_at: string | null;
  created_at: string;
}

const POLL_MS = 20_000;
const REFRESH_MS = 90_000;
const SPOT_HOSTS = ['https://data-api.binance.vision', 'https://api.binance.com'];

/**
 * price_alerts is not yet in the generated Database types (schema change pending);
 * cast until the types are regenerated after the table exists.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function alertTable(): any {
  return (supabase.from as unknown as (table: string) => any)('price_alerts');
}

let timer: ReturnType<typeof setInterval> | null = null;
let refreshTimer: ReturnType<typeof setInterval> | null = null;
let active: PriceAlertRow[] = [];
let checking = false;
let currentUserId: string | null = null;

async function fetchPrices(symbols: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  if (symbols.length === 0) return out;
  const uniq = [...new Set(symbols)];
  const list = JSON.stringify(uniq);
  for (const host of SPOT_HOSTS) {
    try {
      const r = await fetch(`${host}/api/v3/ticker/price?symbols=${encodeURIComponent(list)}`);
      if (!r.ok) continue;
      const data: { symbol: string; price: string }[] = await r.json();
      for (const d of data) {
        const p = parseFloat(d.price);
        if (!isNaN(p)) out[d.symbol] = p;
      }
      if (Object.keys(out).length > 0) return out;
    } catch {
      /* next host */
    }
  }
  return out;
}

export async function refreshActiveAlerts(userId?: string) {
  if (userId) currentUserId = userId;
  if (!currentUserId) return;
  const { data, error } = await alertTable()
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false });
  if (error) return;
  active = (data || []) as PriceAlertRow[];
}

async function checkTriggers() {
  if (checking || active.length === 0 || !currentUserId) return;
  checking = true;
  try {
    const prices = await fetchPrices(active.map((a) => a.symbol));
    for (const a of active) {
      const p = prices[a.symbol];
      if (p == null) continue;
      const hit = a.direction === 'above' ? p >= a.trigger_price : p <= a.trigger_price;
      if (!hit) continue;
      const side = a.direction === 'above' ? 'above' : 'below';
      const label = a.note ? ` — ${a.note}` : '';
      addAlert(
        'price_alert',
        `${a.symbol.replace('USDT', '')} trigger hit`,
        `Price ${p} crossed ${side} your level ${a.trigger_price}${label}${a.timeframe ? ` (${a.timeframe})` : ''}. Entry trigger is live — check the chart before acting.`,
        a.symbol
      );
      await supabase
        .from('price_alerts')
        .update({ status: 'triggered', triggered_at: new Date().toISOString() })
        .eq('id', a.id);
      active = active.filter((x) => x.id !== a.id);
    }
  } finally {
    checking = false;
  }
}

/** Start the monitor for a signed-in user. Idempotent. */
export function startTriggerMonitor(userId?: string) {
  if (userId) currentUserId = userId;
  if (!currentUserId) return;
  refreshActiveAlerts().then(checkTriggers);
  if (!timer) {
    timer = setInterval(checkTriggers, POLL_MS);
    refreshTimer = setInterval(() => refreshActiveAlerts().then(checkTriggers), REFRESH_MS);
  }
}

export function stopTriggerMonitor() {
  if (timer) clearInterval(timer);
  if (refreshTimer) clearInterval(refreshTimer);
  timer = null;
  refreshTimer = null;
  active = [];
  currentUserId = null;
}

export function getActiveTriggerCount() {
  return active.length;
}

/** Ensure browser notification permission is requested at alert creation time. */
export async function ensureNotificationPermission() {
  return requestNotificationPermission();
}
