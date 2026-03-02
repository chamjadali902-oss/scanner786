import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Brain, Loader2, TrendingUp, TrendingDown, Zap, Target, Shield, AlertTriangle, RefreshCw, Flame, ArrowUpRight, ArrowDownRight, Clock, BarChart2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { fetchTicker24h, getTopCoins, fetchKlines } from '@/lib/binance';
import { calculateRSI, calculateMACD, calculateEMA, calculateBollingerBands, calculateStochastic, calculateADX, calculateATR } from '@/lib/indicators';
import { detectDoji, detectHammer, detectShootingStar, detectBullishEngulfing, detectBearishEngulfing, detectMorningStar, detectEveningStar, detectMarubozu, detectBullishHarami, detectBearishHarami, detectInvertedHammer, detectThreeWhiteSoldiers, detectThreeBlackCrows, detectInsideBar } from '@/lib/patterns';
import { detectBullishBOS, detectBearishBOS, detectBullishChoCH, detectBearishChoCH, detectBullishOrderBlock, detectBearishOrderBlock, detectBullishFVG, detectBearishFVG, detectLiquiditySweepHigh, detectLiquiditySweepLow, detectEqualHighs, detectEqualLows, detectPremiumZone, detectDiscountZone, detectUptrend, detectDowntrend } from '@/lib/smc';
import { Timeframe, ScanPool, TIMEFRAME_OPTIONS } from '@/types/scanner';
import { useFavorites } from '@/hooks/useFavorites';
import { TradingViewModal } from '@/components/scanner/TradingViewModal';
import { AnalysisChat } from '@/components/AnalysisChat';

interface SmartSignal {
  symbol: string;
  tradeType: 'REVERSAL' | 'BREAKOUT' | 'SCALP' | 'SWING';
  direction: 'LONG' | 'SHORT';
  signal: 'BUY' | 'SELL';
  confidence: number;
  strength: 'STRONG' | 'MODERATE' | 'WEAK';
  entry: number;
  takeProfit: number[];
  stopLoss: number;
  riskReward: string;
  timeframe: string;
  reasons: string[];
  setup: string;
  warnings: string[];
  urgency: 'HIGH' | 'MEDIUM' | 'LOW';
}

interface SignalsResult {
  signals: SmartSignal[];
  marketSentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  topPick: string;
  summary: string;
}

const TRADE_TYPE_CONFIG = {
  REVERSAL: { icon: RefreshCw, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30', label: 'Reversal' },
  BREAKOUT: { icon: Zap, color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', label: 'Breakout' },
  SCALP: { icon: Clock, color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/30', label: 'Scalp' },
  SWING: { icon: TrendingUp, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30', label: 'Swing' },
};

export default function SmartSignals() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [signals, setSignals] = useState<SignalsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanProgress, setScanProgress] = useState('');
  const [pool, setPool] = useState<ScanPool>('volume');
  const [timeframe, setTimeframe] = useState<Timeframe>('1h');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [chartSymbol, setChartSymbol] = useState<string | null>(null);
  const { getFavoriteSymbols, favorites } = useFavorites(user?.id);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  const scanForSignals = async () => {
    setLoading(true);
    setSignals(null);
    try {
      setScanProgress('Fetching market data...');
      let topCoins: any[];
      if (pool === 'favorites') {
        const favSymbols = getFavoriteSymbols();
        if (favSymbols.length === 0) {
          toast({ title: 'No favorites', description: 'Add coins to favorites first from the Scanner page.', variant: 'destructive' });
          setLoading(false);
          setScanProgress('');
          return;
        }
        const tickers = await fetchTicker24h();
        topCoins = tickers.filter((t: any) => favSymbols.includes(t.symbol));
      } else {
        const tickers = await fetchTicker24h();
        topCoins = getTopCoins(tickers, pool, 100);
      }

      setScanProgress('Analyzing indicators (0/100)...');
      const coinsData = [];
      for (let i = 0; i < Math.min(topCoins.length, 100); i++) {
        const t = topCoins[i];
        try {
          const candles = await fetchKlines(t.symbol, timeframe, 500);
          if (candles.length < 30) continue;
          const rsi = calculateRSI(candles);
          const macd = calculateMACD(candles);
          const ema20 = calculateEMA(candles, 20);
          const bb = calculateBollingerBands(candles);
          const stoch = calculateStochastic(candles);
          const adx = calculateADX(candles);
          const atr = calculateATR(candles);
          const last = candles.length - 1;
          const indicators: Record<string, number | string> = {
            RSI: rsi[last] || 0,
            MACD: macd.macdLine[last] || 0,
            MACD_Signal: macd.signalLine[last] || 0,
            MACD_Hist: macd.histogram[last] || 0,
            EMA20: ema20[last] || 0,
            BB_Upper: bb.upper[last] || 0,
            BB_Lower: bb.lower[last] || 0,
            Stoch_K: stoch.k[last] || 0,
            ADX: adx[last] || 0,
            ATR: atr[last] || 0,
          };
          const patterns: string[] = [];
          if (detectDoji(candles)) patterns.push('Doji');
          if (detectHammer(candles)) patterns.push('Hammer');
          if (detectShootingStar(candles)) patterns.push('Shooting Star');
          if (detectBullishEngulfing(candles)) patterns.push('Bullish Engulfing');
          if (detectBearishEngulfing(candles)) patterns.push('Bearish Engulfing');
          if (detectMorningStar(candles)) patterns.push('Morning Star');
          if (detectEveningStar(candles)) patterns.push('Evening Star');
          if (detectMarubozu(candles)) patterns.push('Marubozu');
          if (detectBullishHarami(candles)) patterns.push('Bullish Harami');
          if (detectBearishHarami(candles)) patterns.push('Bearish Harami');
          if (detectInvertedHammer(candles)) patterns.push('Inverted Hammer');
          if (detectThreeWhiteSoldiers(candles)) patterns.push('Three White Soldiers');
          if (detectThreeBlackCrows(candles)) patterns.push('Three Black Crows');
          if (detectInsideBar(candles)) patterns.push('Inside Bar');

          const smcSignals: string[] = [];
          if (detectBullishBOS(candles)) smcSignals.push('Bullish BOS');
          if (detectBearishBOS(candles)) smcSignals.push('Bearish BOS');
          if (detectBullishChoCH(candles)) smcSignals.push('Bullish ChoCH');
          if (detectBearishChoCH(candles)) smcSignals.push('Bearish ChoCH');
          if (detectBullishOrderBlock(candles)) smcSignals.push('Bullish Order Block');
          if (detectBearishOrderBlock(candles)) smcSignals.push('Bearish Order Block');
          if (detectBullishFVG(candles)) smcSignals.push('Bullish FVG');
          if (detectBearishFVG(candles)) smcSignals.push('Bearish FVG');
          if (detectLiquiditySweepHigh(candles)) smcSignals.push('Liquidity Sweep High');
          if (detectLiquiditySweepLow(candles)) smcSignals.push('Liquidity Sweep Low');
          if (detectEqualHighs(candles)) smcSignals.push('Equal Highs');
          if (detectEqualLows(candles)) smcSignals.push('Equal Lows');
          if (detectPremiumZone(candles)) smcSignals.push('Premium Zone');
          if (detectDiscountZone(candles)) smcSignals.push('Discount Zone');
          if (detectUptrend(candles)) smcSignals.push('Uptrend (HH/HL)');
          if (detectDowntrend(candles)) smcSignals.push('Downtrend (LH/LL)');

          const lastCandle = candles[last];
          coinsData.push({
            symbol: t.symbol,
            price: lastCandle.close,
            priceChange24h: parseFloat(t.priceChangePercent),
            volume24h: parseFloat(t.quoteVolume),
            indicatorValues: indicators,
            patterns,
            smcSignals,
            isBullish: lastCandle.close > lastCandle.open,
          });
        } catch { /* skip */ }
        if (i % 5 === 4) {
          setScanProgress(`Analyzing indicators (${i + 1}/100)...`);
          await new Promise(r => setTimeout(r, 300));
        }
      }

      setScanProgress('AI analyzing opportunities...');
      const { data, error } = await supabase.functions.invoke('smart-signals', {
        body: { coins: coinsData },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setSignals(data);
    } catch (err: any) {
      toast({ title: 'Scan failed', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
      setScanProgress('');
    }
  };

  const formatPrice = (p: number) => {
    if (p < 1) return p.toFixed(6);
    if (p < 100) return p.toFixed(4);
    return p.toFixed(2);
  };

  const filteredSignals = signals?.signals?.filter(s => filterType === 'ALL' || s.tradeType === filterType) || [];

  return (
    <AppLayout className="flex-1 overflow-y-auto custom-scrollbar">
      <div className="container mx-auto px-3 sm:px-4 py-4 max-w-5xl space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary" />
              <span className="text-gradient-primary">Smart Trade Signals</span>
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">AI-powered opportunity scanner — Reversals, Breakouts, Scalps & Swings</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={pool} onValueChange={(v) => setPool(v as ScanPool)}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="volume">Top 100 Volume</SelectItem>
                <SelectItem value="gainers">Top 100 Gainers</SelectItem>
                <SelectItem value="losers">Top 100 Losers</SelectItem>
                {favorites.length > 0 && <SelectItem value="favorites">⭐ My Favorites ({favorites.length})</SelectItem>}
              </SelectContent>
            </Select>
            <Select value={timeframe} onValueChange={(v) => setTimeframe(v as Timeframe)}>
              <SelectTrigger className="w-28 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEFRAME_OPTIONS.map(tf => (
                  <SelectItem key={tf.value} value={tf.value}>{tf.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={scanForSignals} disabled={loading} className="gap-2 h-8 text-xs">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {loading ? scanProgress || 'Scanning...' : 'Scan Now'}
            </Button>
          </div>
        </div>

        {/* Market Sentiment */}
        {signals && (
          <Card className="p-3 card-glow">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className={cn('px-3 py-1 rounded-full text-xs font-bold',
                  signals.marketSentiment === 'BULLISH' ? 'bg-bullish/15 text-bullish' :
                  signals.marketSentiment === 'BEARISH' ? 'bg-bearish/15 text-bearish' : 'bg-muted text-muted-foreground'
                )}>
                  {signals.marketSentiment}
                </div>
                {signals.topPick && (
                  <span className="text-xs text-muted-foreground">
                    Top Pick: <span className="font-bold text-primary">{signals.topPick}</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{signals.summary}</p>
            </div>
          </Card>
        )}

        {/* Filter tabs */}
        {signals && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {['ALL', 'REVERSAL', 'BREAKOUT', 'SCALP', 'SWING'].map(type => (
              <Button key={type} variant={filterType === type ? 'default' : 'outline'} size="sm"
                onClick={() => setFilterType(type)} className="h-7 text-[10px] px-2.5 shrink-0">
                {type === 'ALL' ? 'All' : TRADE_TYPE_CONFIG[type as keyof typeof TRADE_TYPE_CONFIG]?.label || type}
                {type !== 'ALL' && signals?.signals && (
                  <span className="ml-1 opacity-60">
                    ({signals.signals.filter(s => s.tradeType === type).length})
                  </span>
                )}
              </Button>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!signals && !loading && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Brain className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-base font-bold mb-1">AI Smart Signals</h2>
            <p className="text-xs text-muted-foreground mb-4 max-w-sm">
              Scan the market for high-probability trade setups including reversals, breakouts, scalps, and swing trades.
            </p>
            <Button onClick={scanForSignals} className="gap-2">
              <Zap className="w-4 h-4" /> Start AI Scan
            </Button>
          </div>
        )}

        {/* Signals Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredSignals.map((sig, i) => {
            const typeConfig = TRADE_TYPE_CONFIG[sig.tradeType] || TRADE_TYPE_CONFIG.SWING;
            const TypeIcon = typeConfig.icon;
            const isLong = sig.direction === 'LONG';
            return (
              <Card key={i} className={cn('p-3 space-y-3 border', isLong ? 'card-bullish' : 'card-bearish')}>
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-extrabold text-sm">{sig.symbol.replace('USDT', '')}</span>
                    <Badge variant="outline" className={cn('text-[9px] gap-1', typeConfig.color, typeConfig.bg, typeConfig.border)}>
                      <TypeIcon className="w-3 h-3" /> {typeConfig.label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {sig.urgency === 'HIGH' && <Flame className="w-3.5 h-3.5 text-bearish animate-pulse" />}
                    <Badge variant={isLong ? 'default' : 'destructive'} className="text-[10px] gap-0.5">
                      {isLong ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      {sig.direction}
                    </Badge>
                  </div>
                </div>

                {/* Confidence bar */}
                <div>
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-muted-foreground">Confidence</span>
                    <span className={cn('font-bold', sig.confidence >= 75 ? 'text-bullish' : sig.confidence >= 50 ? 'text-warning' : 'text-bearish')}>
                      {sig.confidence}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all', sig.confidence >= 75 ? 'bg-bullish' : sig.confidence >= 50 ? 'bg-warning' : 'bg-bearish')}
                      style={{ width: `${sig.confidence}%` }} />
                  </div>
                </div>

                {/* Entry / SL / TP */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded bg-background/60">
                    <p className="text-muted-foreground flex items-center gap-1"><Target className="w-3 h-3" /> Entry</p>
                    <p className="font-mono font-bold">${formatPrice(sig.entry)}</p>
                  </div>
                  <div className="p-2 rounded bg-background/60">
                    <p className="text-muted-foreground flex items-center gap-1"><Shield className="w-3 h-3" /> Stop Loss</p>
                    <p className="font-mono font-bold text-bearish">${formatPrice(sig.stopLoss)}</p>
                  </div>
                </div>
                <div className="space-y-1">
                  {sig.takeProfit?.map((tp, j) => (
                    <div key={j} className="flex justify-between items-center text-xs p-1.5 rounded bg-background/60">
                      <span className="text-muted-foreground">TP{j + 1}</span>
                      <span className="font-mono font-bold text-bullish">${formatPrice(tp)}</span>
                    </div>
                  ))}
                </div>

                {/* R:R */}
                <div className="text-[10px] text-center text-muted-foreground">
                  R:R <span className="font-mono font-bold text-foreground">{sig.riskReward}</span>
                  {sig.strength && <span className="ml-2">• {sig.strength}</span>}
                </div>

                {/* Setup */}
                <p className="text-xs text-muted-foreground">{sig.setup}</p>

                {/* Reasons */}
                <div className="space-y-1">
                  {sig.reasons?.map((r, j) => (
                    <p key={j} className="text-[11px] flex items-start gap-1.5">
                      <span className={cn('mt-0.5 w-1.5 h-1.5 rounded-full shrink-0', isLong ? 'bg-bullish' : 'bg-bearish')} />
                      {r}
                    </p>
                  ))}
                </div>

                {/* Warnings */}
                {sig.warnings?.length > 0 && (
                  <div className="p-2 rounded bg-warning/5 border border-warning/20 space-y-1">
                    {sig.warnings.map((w, j) => (
                      <p key={j} className="text-[10px] flex items-start gap-1.5 text-warning">
                        <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" /> {w}
                      </p>
                    ))}
                  </div>
                )}

                {/* View Chart */}
                <div className="flex gap-1.5">
                  <Button variant="outline" size="sm" className="flex-1 gap-2 text-xs h-7"
                    onClick={() => setChartSymbol(sig.symbol)}>
                    <BarChart2 className="w-3.5 h-3.5" /> View Chart
                  </Button>
                </div>

                {/* Follow-up Chat */}
                <AnalysisChat
                  contextSummary={`Symbol: ${sig.symbol}, Type: ${sig.tradeType}, Direction: ${sig.direction}, Confidence: ${sig.confidence}%, Entry: $${sig.entry}, SL: $${sig.stopLoss}, TP: ${sig.takeProfit?.map(t => '$' + t).join(', ')}, R:R: ${sig.riskReward}, Setup: ${sig.setup}, Reasons: ${sig.reasons?.join('; ')}, Warnings: ${sig.warnings?.join('; ')}`}
                />
              </Card>
            );
          })}
        </div>

        {signals && filteredSignals.length === 0 && (
          <p className="text-center text-xs text-muted-foreground py-8">No signals found for this filter.</p>
        )}
      </div>

      {chartSymbol && (
        <TradingViewModal
          isOpen={!!chartSymbol}
          onClose={() => setChartSymbol(null)}
          symbol={chartSymbol}
          timeframe={timeframe}
        />
      )}
    </AppLayout>
  );
}
