import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Play, Loader2, TrendingUp, TrendingDown, Target, AlertTriangle, BarChart3, DollarSign, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScanCondition, Timeframe, TIMEFRAME_OPTIONS } from '@/types/scanner';
import { LogicBuilder } from '@/components/scanner/LogicBuilder';
import { fetchKlines } from '@/lib/binance';
import { runBacktest, BacktestResult } from '@/lib/backtester';
import { AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';

export default function Backtest() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => { if (!authLoading && !user) navigate('/auth'); }, [user, authLoading, navigate]);

  useEffect(() => {
    const tf = searchParams.get('timeframe') as Timeframe;
    const conds = searchParams.get('conditions');
    if (tf) setTimeframe(tf);
    if (conds) { try { setConditions(JSON.parse(conds)); } catch {} }
  }, [searchParams]);

  const [symbol, setSymbol] = useState('BTCUSDT');
  const [timeframe, setTimeframe] = useState<Timeframe>('1h');
  const [conditions, setConditions] = useState<ScanCondition[]>([
    { id: 'rsi-default', feature: 'rsi', category: 'indicator', mode: 'range', minValue: 5, maxValue: 30, enabled: true },
  ]);
  const [config, setConfig] = useState({
    entryMode: 'auto' as 'long' | 'short' | 'auto',
    takeProfitPercent: 3, stopLossPercent: 2, positionSizePercent: 10, initialCapital: 10000,
  });
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);

  const handleRun = async () => {
    setRunning(true); setResult(null);
    try {
      const candles = await fetchKlines(symbol.toUpperCase(), timeframe, 500);
      const res = runBacktest(candles, { conditions, ...config });
      setResult(res);
    } catch (e: any) { console.error('Backtest error:', e); }
    setRunning(false);
  };

  const formatPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
  const formatUsd = (n: number) => `${n >= 0 ? '+' : '-'}$${Math.abs(n).toFixed(2)}`;

  return (
    <AppLayout className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-6xl">
      <div className="grid lg:grid-cols-12 gap-4 sm:gap-5">
        {/* Config Panel */}
        <div className="lg:col-span-4 space-y-3 sm:space-y-4">
          <div className="p-3 sm:p-4 rounded-xl border border-border bg-card card-glow space-y-2.5">
            <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Symbol & Timeframe</h3>
            <Input placeholder="Symbol" value={symbol} onChange={e => setSymbol(e.target.value)} className="font-mono text-sm" />
            <div className="flex flex-wrap gap-1.5">
              {TIMEFRAME_OPTIONS.filter(t => ['15m', '1h', '4h', '1d'].includes(t.value)).map(opt => (
                <button key={opt.value} onClick={() => setTimeframe(opt.value)}
                  className={cn('px-2.5 py-1 rounded-lg font-mono text-[10px] font-medium border transition-all',
                    timeframe === opt.value ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:border-primary/50'
                  )}>
                  {opt.value.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="p-3 sm:p-4 rounded-xl border border-border bg-card card-glow space-y-2.5">
            <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Trade Settings</h3>
            <Select value={config.entryMode} onValueChange={v => setConfig({ ...config, entryMode: v as any })}>
              <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto</SelectItem>
                <SelectItem value="long">Long Only</SelectItem>
                <SelectItem value="short">Short Only</SelectItem>
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-[9px] text-muted-foreground">TP %</label><Input type="number" value={config.takeProfitPercent} onChange={e => setConfig({ ...config, takeProfitPercent: +e.target.value })} className="text-xs" /></div>
              <div><label className="text-[9px] text-muted-foreground">SL %</label><Input type="number" value={config.stopLossPercent} onChange={e => setConfig({ ...config, stopLossPercent: +e.target.value })} className="text-xs" /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-[9px] text-muted-foreground">Size %</label><Input type="number" value={config.positionSizePercent} onChange={e => setConfig({ ...config, positionSizePercent: +e.target.value })} className="text-xs" /></div>
              <div><label className="text-[9px] text-muted-foreground">Capital $</label><Input type="number" value={config.initialCapital} onChange={e => setConfig({ ...config, initialCapital: +e.target.value })} className="text-xs" /></div>
            </div>
          </div>

          <div className="p-3 sm:p-4 rounded-xl border border-border bg-card card-glow">
            <LogicBuilder conditions={conditions} onChange={setConditions} disabled={running} />
          </div>

          <Button onClick={handleRun} disabled={running || conditions.filter(c => c.enabled).length === 0} className="w-full h-10 sm:h-11 text-sm font-semibold">
            {running ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Running...</> : <><Play className="w-4 h-4 mr-2" /> Run Backtest</>}
          </Button>
        </div>

        {/* Results */}
        <div className="lg:col-span-8">
          {!result && !running && (
            <div className="flex flex-col items-center justify-center h-[250px] sm:h-[350px] rounded-xl border border-dashed border-border bg-card/30">
              <Activity className="w-10 h-10 text-muted-foreground/30 mb-3" />
              <h3 className="text-sm font-semibold text-muted-foreground mb-1">No Results Yet</h3>
              <p className="text-[11px] text-muted-foreground/70 text-center max-w-xs">Configure conditions and run backtest.</p>
            </div>
          )}

          {running && (
            <div className="flex flex-col items-center justify-center h-[250px] sm:h-[350px] rounded-xl border border-border bg-card/30">
              <Loader2 className="w-10 h-10 text-primary animate-spin mb-3" />
              <p className="text-xs text-muted-foreground">Running backtest on {symbol}...</p>
            </div>
          )}

          {result && (
            <div className="space-y-3 sm:space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                {[
                  { label: 'Total P&L', value: formatUsd(result.totalPnl), icon: DollarSign, color: result.totalPnl >= 0 ? 'text-bullish' : 'text-bearish' },
                  { label: 'Win Rate', value: `${result.winRate.toFixed(1)}%`, icon: Target, color: result.winRate >= 50 ? 'text-bullish' : 'text-bearish' },
                  { label: 'Profit Factor', value: result.profitFactor === Infinity ? '∞' : result.profitFactor.toFixed(2), icon: TrendingUp, color: result.profitFactor >= 1 ? 'text-bullish' : 'text-bearish' },
                  { label: 'Sharpe', value: result.sharpeRatio.toFixed(2), icon: BarChart3, color: result.sharpeRatio >= 1 ? 'text-bullish' : 'text-bearish' },
                  { label: 'Max DD', value: `${result.maxDrawdownPercent.toFixed(2)}%`, icon: AlertTriangle, color: 'text-bearish' },
                  { label: 'Trades', value: result.totalTrades.toString(), icon: Activity, color: 'text-primary' },
                  { label: 'Best', value: formatPct(result.bestTrade), icon: TrendingUp, color: 'text-bullish' },
                  { label: 'Worst', value: formatPct(result.worstTrade), icon: TrendingDown, color: 'text-bearish' },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className="p-2.5 sm:p-3 rounded-xl border border-border bg-card card-glow">
                    <div className="flex items-center gap-1 mb-0.5">
                      <Icon className={cn('w-3 h-3', color)} />
                      <span className="text-[9px] text-muted-foreground">{label}</span>
                    </div>
                    <p className={cn('text-sm sm:text-base font-bold font-mono', color)}>{value}</p>
                  </div>
                ))}
              </div>

              {result.equityCurve.length > 0 && (
                <div className="p-3 sm:p-4 rounded-xl border border-border bg-card card-glow">
                  <h3 className="text-xs font-semibold mb-2">Equity Curve</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={result.equityCurve.filter((_, i) => i % Math.max(1, Math.floor(result.equityCurve.length / 200)) === 0)}>
                      <defs><linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(185, 100%, 50%)" stopOpacity={0.3} /><stop offset="95%" stopColor="hsl(185, 100%, 50%)" stopOpacity={0} /></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
                      <XAxis dataKey="time" tick={{ fontSize: 9, fill: 'hsl(215, 15%, 55%)' }} tickFormatter={t => new Date(t).toLocaleDateString()} />
                      <YAxis tick={{ fontSize: 9, fill: 'hsl(215, 15%, 55%)' }} tickFormatter={v => `$${v}`} />
                      <Tooltip contentStyle={{ background: 'hsl(220, 18%, 10%)', border: '1px solid hsl(220, 15%, 18%)', borderRadius: 8, fontSize: 11 }} formatter={(v: number) => [`$${v.toFixed(2)}`, 'Equity']} labelFormatter={t => new Date(t).toLocaleString()} />
                      <Area type="monotone" dataKey="equity" stroke="hsl(185, 100%, 50%)" fill="url(#eqGrad)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {result.trades.length > 0 && (
                <div className="p-3 sm:p-4 rounded-xl border border-border bg-card card-glow">
                  <h3 className="text-xs font-semibold mb-2">Trade P&L Distribution</h3>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={result.trades.map((t, i) => ({ idx: i + 1, pnl: t.pnlPercent }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
                      <XAxis dataKey="idx" tick={{ fontSize: 9, fill: 'hsl(215, 15%, 55%)' }} />
                      <YAxis tick={{ fontSize: 9, fill: 'hsl(215, 15%, 55%)' }} tickFormatter={v => `${v}%`} />
                      <Tooltip contentStyle={{ background: 'hsl(220, 18%, 10%)', border: '1px solid hsl(220, 15%, 18%)', borderRadius: 8, fontSize: 11 }} formatter={(v: number) => [`${v.toFixed(2)}%`, 'P&L']} />
                      <Bar dataKey="pnl" radius={[2, 2, 0, 0]}>{result.trades.map((t, i) => <Cell key={i} fill={t.pnl >= 0 ? 'hsl(145, 75%, 50%)' : 'hsl(0, 85%, 55%)'} />)}</Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="p-3 sm:p-4 rounded-xl border border-border bg-card card-glow">
                <h3 className="text-xs font-semibold mb-2">Additional Stats</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div><span className="text-muted-foreground">Avg Win:</span> <span className="font-mono text-bullish">${result.avgWin.toFixed(2)}</span></div>
                  <div><span className="text-muted-foreground">Avg Loss:</span> <span className="font-mono text-bearish">${result.avgLoss.toFixed(2)}</span></div>
                  <div><span className="text-muted-foreground">Avg Hold:</span> <span className="font-mono">{result.avgHoldingBars.toFixed(0)} bars</span></div>
                  <div><span className="text-muted-foreground">Final:</span> <span className="font-mono">${result.finalEquity.toFixed(2)}</span></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
