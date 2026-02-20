import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTrades, Trade } from '@/hooks/useTrades';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, TrendingUp, TrendingDown, Target, Trophy, DollarSign, BarChart3, Trash2, BarChart2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { TradingViewModal } from '@/components/scanner/TradingViewModal';
import { LiveTradeAnalysis } from '@/components/dashboard/LiveTradeAnalysis';

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { trades, loading, addTrade, closeTrade, deleteTrade, getStats } = useTrades(user?.id);
  const [showAdd, setShowAdd] = useState(false);
  const [closeDialog, setCloseDialog] = useState<string | null>(null);
  const [exitPrice, setExitPrice] = useState('');
  const [form, setForm] = useState({
    symbol: '', side: 'long' as 'long' | 'short',
    entry_price: '', quantity: '1', stop_loss: '', take_profit: '', notes: '',
  });

  // Live prices state
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});
  const wsRef = useRef<WebSocket | null>(null);
  const autoClosedRef = useRef<Set<string>>(new Set());

  // Chart modal state
  const [chartSymbol, setChartSymbol] = useState('');
  const [showChart, setShowChart] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  // WebSocket for live prices of open trades
  const openTrades = trades.filter(t => t.status === 'open');
  const openSymbols = [...new Set(openTrades.map(t => t.symbol.toLowerCase()))];

  useEffect(() => {
    if (openSymbols.length === 0) {
      wsRef.current?.close();
      wsRef.current = null;
      return;
    }

    // Close previous connection
    wsRef.current?.close();

    const streams = openSymbols.map(s => `${s}@miniTicker`).join('/');
    const ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.data?.s && msg.data?.c) {
          setLivePrices(prev => ({ ...prev, [msg.data.s]: parseFloat(msg.data.c) }));
        }
      } catch {}
    };

    ws.onerror = () => {
      // Fallback: REST polling
      const interval = setInterval(async () => {
        try {
          const symbols = openSymbols.map(s => `"${s.toUpperCase()}"`).join(',');
          const res = await fetch(`https://data-api.binance.vision/api/v3/ticker/price?symbols=[${symbols}]`);
          const data = await res.json();
          if (Array.isArray(data)) {
            setLivePrices(prev => {
              const updated = { ...prev };
              data.forEach((d: any) => { updated[d.symbol] = parseFloat(d.price); });
              return updated;
            });
          }
        } catch {}
      }, 5000);
      return () => clearInterval(interval);
    };

    return () => { ws.close(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSymbols.join(',')]);

  // Auto-close trades when TP or SL is hit
  useEffect(() => {
    openTrades.forEach(t => {
      const price = livePrices[t.symbol];
      if (!price || autoClosedRef.current.has(t.id)) return;

      let shouldClose = false;
      if (t.side === 'long') {
        if (t.take_profit && price >= t.take_profit) shouldClose = true;
        if (t.stop_loss && price <= t.stop_loss) shouldClose = true;
      } else {
        if (t.take_profit && price <= t.take_profit) shouldClose = true;
        if (t.stop_loss && price >= t.stop_loss) shouldClose = true;
      }

      if (shouldClose) {
        autoClosedRef.current.add(t.id);
        closeTrade(t.id, price);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [livePrices, openTrades]);

  const stats = getStats();

  const handleAddTrade = () => {
    if (!form.symbol || !form.entry_price) return;
    addTrade({
      symbol: form.symbol.toUpperCase(), side: form.side,
      entry_price: parseFloat(form.entry_price), quantity: parseFloat(form.quantity) || 1,
      stop_loss: form.stop_loss ? parseFloat(form.stop_loss) : null,
      take_profit: form.take_profit ? parseFloat(form.take_profit) : null,
      notes: form.notes || null, tags: null, status: 'open',
      opened_at: new Date().toISOString(), exit_price: null,
    });
    setForm({ symbol: '', side: 'long', entry_price: '', quantity: '1', stop_loss: '', take_profit: '', notes: '' });
    setShowAdd(false);
  };

  const handleClose = () => {
    if (closeDialog && exitPrice) {
      closeTrade(closeDialog, parseFloat(exitPrice));
      setCloseDialog(null); setExitPrice('');
    }
  };

  const getUnrealizedPnl = (t: Trade) => {
    const price = livePrices[t.symbol];
    if (!price) return null;
    const pnl = t.side === 'long'
      ? (price - t.entry_price) * t.quantity
      : (t.entry_price - price) * t.quantity;
    const pnlPct = t.side === 'long'
      ? ((price - t.entry_price) / t.entry_price) * 100
      : ((t.entry_price - price) / t.entry_price) * 100;
    return { pnl, pnlPct, price };
  };

  const closedTrades = trades.filter(t => t.status === 'closed').sort((a, b) => new Date(a.closed_at!).getTime() - new Date(b.closed_at!).getTime());
  const pnlChartData = closedTrades.reduce((acc, t, i) => {
    const prev = acc[i] || { cumPnl: 0 };
    acc.push({ date: new Date(t.closed_at!).toLocaleDateString(), pnl: t.pnl ?? 0, cumPnl: prev.cumPnl + (t.pnl ?? 0) });
    return acc;
  }, [] as { date: string; pnl: number; cumPnl: number }[]);

  const winLossData = stats.totalTrades > 0 ? [
    { name: 'Wins', value: Math.round(stats.winRate), color: 'hsl(145, 75%, 50%)' },
    { name: 'Losses', value: Math.round(100 - stats.winRate), color: 'hsl(0, 85%, 55%)' },
  ] : [];

  const formatNum = (n: number) => n < 0 ? `-$${Math.abs(n).toFixed(2)}` : `$${n.toFixed(2)}`;
  const formatPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;

  return (
    <AppLayout className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-6xl">
      {/* Title + Add button */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm sm:text-base font-bold">Portfolio Dashboard</h2>
        <Button size="sm" onClick={() => setShowAdd(true)} className="gap-1.5 h-8 text-xs">
          <Plus className="w-3.5 h-3.5" /> Add Trade
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-5">
        {[
          { label: 'Total P&L', value: formatNum(stats.totalPnl), icon: DollarSign, color: stats.totalPnl >= 0 ? 'text-bullish' : 'text-bearish' },
          { label: 'Win Rate', value: `${stats.winRate.toFixed(1)}%`, icon: Trophy, color: stats.winRate >= 50 ? 'text-bullish' : 'text-bearish' },
          { label: 'Total Trades', value: stats.totalTrades.toString(), icon: BarChart3, color: 'text-primary' },
          { label: 'Open Trades', value: stats.openTrades.toString(), icon: Target, color: 'text-warning' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="p-2.5 sm:p-3 rounded-xl border border-border bg-card card-glow">
            <div className="flex items-center gap-1.5 mb-1">
              <Icon className={cn('w-3.5 h-3.5', color)} />
              <span className="text-[10px] text-muted-foreground">{label}</span>
            </div>
            <p className={cn('text-base sm:text-lg font-bold font-mono', color)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      {stats.totalTrades > 0 && (
        <div className="grid sm:grid-cols-3 gap-3 mb-5">
          <div className="sm:col-span-2 p-3 sm:p-4 rounded-xl border border-border bg-card card-glow">
            <h3 className="text-xs font-semibold mb-2">Cumulative P&L</h3>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={pnlChartData}>
                <defs><linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(185, 100%, 50%)" stopOpacity={0.3} /><stop offset="95%" stopColor="hsl(185, 100%, 50%)" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'hsl(215, 15%, 55%)' }} />
                <YAxis tick={{ fontSize: 9, fill: 'hsl(215, 15%, 55%)' }} />
                <Tooltip contentStyle={{ background: 'hsl(220, 18%, 10%)', border: '1px solid hsl(220, 15%, 18%)', borderRadius: 8, fontSize: 11 }} />
                <Area type="monotone" dataKey="cumPnl" stroke="hsl(185, 100%, 50%)" fill="url(#pnlGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="p-3 sm:p-4 rounded-xl border border-border bg-card card-glow flex flex-col items-center justify-center">
            <h3 className="text-xs font-semibold mb-2">Win / Loss</h3>
            <ResponsiveContainer width="100%" height={140}>
              <PieChart><Pie data={winLossData} dataKey="value" innerRadius={35} outerRadius={55} paddingAngle={4}>{winLossData.map((entry, i) => <Cell key={i} fill={entry.color} />)}</Pie></PieChart>
            </ResponsiveContainer>
            <div className="flex gap-3 mt-1.5 text-xs">
              <span className="text-bullish font-mono font-bold">{Math.round(stats.winRate)}% W</span>
              <span className="text-bearish font-mono font-bold">{Math.round(100 - stats.winRate)}% L</span>
            </div>
          </div>
        </div>
      )}

      {/* Trade List */}
      <div className="rounded-xl border border-border bg-card card-glow overflow-hidden">
        <div className="p-3 border-b border-border"><h3 className="text-xs sm:text-sm font-semibold">Trade Journal</h3></div>
        {trades.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-xs">
            <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-30" />No trades yet. Click "Add Trade" to start.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {trades.map(t => {
              const unrealized = t.status === 'open' ? getUnrealizedPnl(t) : null;
              return (
                <div key={t.id} className="p-2.5 sm:p-3 hover:bg-muted/20 transition-colors">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', t.side === 'long' ? 'bg-bullish/10' : 'bg-bearish/10')}>
                      {t.side === 'long' ? <TrendingUp className="w-3.5 h-3.5 text-bullish" /> : <TrendingDown className="w-3.5 h-3.5 text-bearish" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-bold text-xs">{t.symbol}</span>
                        <span className={cn('text-[9px] uppercase font-semibold px-1 py-0.5 rounded', t.side === 'long' ? 'bg-bullish/10 text-bullish' : 'bg-bearish/10 text-bearish')}>{t.side}</span>
                        <span className={cn('text-[9px] px-1 py-0.5 rounded', t.status === 'open' ? 'bg-warning/10 text-warning' : 'bg-muted text-muted-foreground')}>{t.status}</span>
                      </div>
                      <div className="text-[9px] text-muted-foreground mt-0.5">
                        Entry: <span className="font-mono">${t.entry_price}</span>
                        {t.exit_price && <> → Exit: <span className="font-mono">${t.exit_price}</span></>}
                        {unrealized && (
                          <> | Now: <span className={cn('font-mono font-semibold', unrealized.pnl >= 0 ? 'text-bullish' : 'text-bearish')}>${unrealized.price.toFixed(t.entry_price < 1 ? 6 : 2)}</span></>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {t.status === 'closed' && t.pnl !== null ? (
                        <div>
                          <p className={cn('font-mono font-bold text-xs', (t.pnl ?? 0) >= 0 ? 'text-bullish' : 'text-bearish')}>{formatNum(t.pnl)}</p>
                          {t.pnl_percent !== null && (
                            <p className={cn('font-mono text-[9px]', (t.pnl_percent ?? 0) >= 0 ? 'text-bullish' : 'text-bearish')}>{formatPct(t.pnl_percent)}</p>
                          )}
                        </div>
                      ) : t.status === 'open' && unrealized ? (
                        <div>
                          <p className={cn('font-mono font-bold text-xs', unrealized.pnl >= 0 ? 'text-bullish' : 'text-bearish')}>{formatNum(unrealized.pnl)}</p>
                          <p className={cn('font-mono text-[9px]', unrealized.pnlPct >= 0 ? 'text-bullish' : 'text-bearish')}>{formatPct(unrealized.pnlPct)}</p>
                        </div>
                      ) : t.status === 'open' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                      ) : null}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {t.status === 'open' && (
                        <Button size="sm" variant="outline" className="text-[10px] h-6 px-2" onClick={() => { setCloseDialog(t.id); setExitPrice(unrealized?.price?.toString() || ''); }}>Close</Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setChartSymbol(t.symbol); setShowChart(true); }}>
                        <BarChart2 className="w-3 h-3 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteTrade(t.id)}>
                        <Trash2 className="w-3 h-3 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                  {/* SL/TP progress for open trades */}
                  {t.status === 'open' && (t.stop_loss || t.take_profit) && unrealized && (
                    <div className="mt-1.5 ml-9 flex items-center gap-2 text-[9px] text-muted-foreground">
                      {t.stop_loss && <span>SL: <span className="font-mono text-bearish">${t.stop_loss}</span></span>}
                      {t.stop_loss && t.take_profit && <span>|</span>}
                      {t.take_profit && <span>TP: <span className="font-mono text-bullish">${t.take_profit}</span></span>}
                      {t.stop_loss && t.take_profit && (() => {
                        const range = Math.abs(t.take_profit - t.stop_loss);
                        const progress = t.side === 'long'
                          ? ((unrealized.price - t.stop_loss) / range) * 100
                          : ((t.stop_loss - unrealized.price) / range) * 100;
                        const clamped = Math.max(0, Math.min(100, progress));
                        return (
                          <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden ml-1">
                            <div
                              className={cn('h-full rounded-full transition-all', clamped > 50 ? 'bg-bullish' : 'bg-bearish')}
                              style={{ width: `${clamped}%` }}
                            />
                          </div>
                        );
                      })()}
                    </div>
                  )}
                  {/* Live AI Analysis for open trades */}
                  {t.status === 'open' && (
                    <LiveTradeAnalysis trade={t} currentPrice={unrealized?.price ?? null} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Trade Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-sm sm:max-w-md">
          <DialogHeader><DialogTitle className="text-sm">Add New Trade</DialogTitle></DialogHeader>
          <div className="space-y-2.5">
            <Input placeholder="Symbol (e.g. BTCUSDT)" value={form.symbol} onChange={e => setForm({ ...form, symbol: e.target.value })} className="text-sm" />
            <Select value={form.side} onValueChange={v => setForm({ ...form, side: v as 'long' | 'short' })}><SelectTrigger className="text-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="long">Long</SelectItem><SelectItem value="short">Short</SelectItem></SelectContent></Select>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Entry Price" type="number" value={form.entry_price} onChange={e => setForm({ ...form, entry_price: e.target.value })} className="text-sm" />
              <Input placeholder="Quantity" type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} className="text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Stop Loss" type="number" value={form.stop_loss} onChange={e => setForm({ ...form, stop_loss: e.target.value })} className="text-sm" />
              <Input placeholder="Take Profit" type="number" value={form.take_profit} onChange={e => setForm({ ...form, take_profit: e.target.value })} className="text-sm" />
            </div>
            <Input placeholder="Notes (optional)" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="text-sm" />
            <Button onClick={handleAddTrade} className="w-full text-sm" disabled={!form.symbol || !form.entry_price}>Add Trade</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!closeDialog} onOpenChange={() => setCloseDialog(null)}>
        <DialogContent className="max-w-xs sm:max-w-sm">
          <DialogHeader><DialogTitle className="text-sm">Close Trade</DialogTitle></DialogHeader>
          <div className="space-y-2.5">
            <Input placeholder="Exit Price" type="number" value={exitPrice} onChange={e => setExitPrice(e.target.value)} autoFocus className="text-sm" />
            <Button onClick={handleClose} className="w-full text-sm" disabled={!exitPrice}>Confirm Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* TradingView Chart Modal */}
      <TradingViewModal
        isOpen={showChart}
        onClose={() => setShowChart(false)}
        symbol={chartSymbol}
        timeframe="15m"
      />
    </AppLayout>
  );
}
