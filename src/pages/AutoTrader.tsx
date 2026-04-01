
import { useState, useEffect, useCallback } from "react";
import { AppHeader } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Plus, Trash2, Bell, BellOff, Target, TrendingUp, TrendingDown,
  Minus, Search, Eye, Clock, Shield, Zap, AlertTriangle, ChevronDown, ChevronUp
} from "lucide-react";

interface WatchlistCoin {
  id: string;
  symbol: string;
  added_at: string;
}

interface Signal {
  id: string;
  symbol: string;
  timeframe: string;
  signal_type: string;
  trend: string;
  confidence: number;
  entry_price: number;
  stop_loss: number;
  take_profit_1: number;
  take_profit_2: number;
  take_profit_3: number;
  risk_reward: number;
  reasons: string[];
  indicator_data: Record<string, any>;
  is_read: boolean;
  created_at: string;
}

export default function AutoTrader() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [watchlist, setWatchlist] = useState<WatchlistCoin[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [newSymbol, setNewSymbol] = useState("");
  const [loading, setLoading] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);

  // Auto-prune signals older than 5 minutes
  const MAX_SIGNAL_AGE = 5 * 60 * 1000;
  useEffect(() => {
    const interval = setInterval(() => {
      setSignals(prev => prev.filter(s => Date.now() - new Date(s.created_at).getTime() < MAX_SIGNAL_AGE));
    }, 30000);
    return () => clearInterval(interval);
  }, []);
  const [expandedSignal, setExpandedSignal] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      window.sessionStorage.setItem("postLoginRedirect", "/auto-trader");
      navigate("/auth?redirectTo=/auto-trader", { replace: true, state: { redirectTo: "/auto-trader" } });
      return;
    }
    loadWatchlist();
    loadSignals();
    checkPushStatus();

    // Subscribe to realtime signals
    const channel = supabase
      .channel("signals")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "analysis_signals",
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const newSignal = payload.new as Signal;
        setSignals(prev => [newSignal, ...prev].filter(s => Date.now() - new Date(s.created_at).getTime() < MAX_SIGNAL_AGE));
        toast.success(`🎯 New ${newSignal.signal_type.toUpperCase()} signal: ${newSignal.symbol} (${newSignal.timeframe})`);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, authLoading, navigate]);

  const loadWatchlist = async () => {
    const { data, error } = await supabase
      .from("watchlist_coins")
      .select("*")
      .order("added_at", { ascending: true });
    if (!error && data) setWatchlist(data);
  };

  const loadSignals = async () => {
    const { data, error } = await supabase
      .from("analysis_signals")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (!error && data) setSignals(data as Signal[]);
  };

  const addCoin = async () => {
    if (!newSymbol.trim()) return;
    const symbol = newSymbol.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!symbol.endsWith("USDT")) {
      toast.error("Symbol must end with USDT (e.g., BTCUSDT)");
      return;
    }
    if (watchlist.length >= 20) {
      toast.error("Maximum 20 coins allowed in watchlist");
      return;
    }

    setLoading(true);
    const { error } = await supabase.from("watchlist_coins").insert({
      user_id: user!.id,
      symbol,
    });
    setLoading(false);

    if (error) {
      if (error.message.includes("duplicate")) toast.error("Coin already in watchlist");
      else toast.error(error.message);
    } else {
      toast.success(`${symbol} added to watchlist`);
      setNewSymbol("");
      loadWatchlist();
    }
  };

  const removeCoin = async (id: string, symbol: string) => {
    const { error } = await supabase.from("watchlist_coins").delete().eq("id", id);
    if (!error) {
      toast.success(`${symbol} removed`);
      loadWatchlist();
    }
  };

  const checkPushStatus = () => {
    if ("Notification" in window) {
      setPushEnabled(Notification.permission === "granted");
    }
  };

  const enablePush = async () => {
    if (!("Notification" in window)) {
      toast.error("Push notifications not supported in this browser");
      return;
    }
    const permission = await Notification.requestPermission();
    setPushEnabled(permission === "granted");
    if (permission === "granted") {
      toast.success("Push notifications enabled!");
    } else {
      toast.error("Push notifications denied");
    }
  };

  const markRead = async (id: string) => {
    await supabase.from("analysis_signals").update({ is_read: true }).eq("id", id);
    setSignals(prev => prev.map(s => s.id === id ? { ...s, is_read: true } : s));
  };

  const getSignalColor = (type: string) => {
    if (type.includes("buy")) return "text-bullish bg-bullish/10 border-bullish/30";
    if (type.includes("sell")) return "text-bearish bg-bearish/10 border-bearish/30";
    return "text-muted-foreground bg-muted/10 border-border";
  };

  const getTrendIcon = (trend: string) => {
    if (trend === "uptrend") return <TrendingUp className="w-4 h-4 text-bullish" />;
    if (trend === "downtrend") return <TrendingDown className="w-4 h-4 text-bearish" />;
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };

  const formatPrice = (price: number) => {
    if (price >= 1000) return price.toFixed(2);
    if (price >= 1) return price.toFixed(4);
    return price.toFixed(6);
  };

  const timeSince = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const unreadCount = signals.filter(s => !s.is_read).length;

  if (authLoading || !user) return null;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-6xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
              <Target className="w-6 h-6 text-primary" />
              Auto Trader
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Add coins & get automatic entry signals on every timeframe
            </p>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {unreadCount} new signal{unreadCount > 1 ? "s" : ""}
              </Badge>
            )}
            <Button
              variant={pushEnabled ? "outline" : "default"}
              size="sm"
              onClick={enablePush}
              className="gap-1.5 text-xs"
            >
              {pushEnabled ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
              {pushEnabled ? "Notifications On" : "Enable Notifications"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Watchlist Panel */}
          <Card className="lg:col-span-1 border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-primary" />
                  Watchlist ({watchlist.length}/20)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Add coin */}
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. BTCUSDT"
                  value={newSymbol}
                  onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && addCoin()}
                  className="text-xs h-8 bg-muted/50 border-border"
                />
                <Button size="sm" onClick={addCoin} disabled={loading} className="h-8 px-3 text-xs gap-1">
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </Button>
              </div>

              {/* Info box */}
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
                <div className="flex items-start gap-2">
                  <Zap className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <div className="text-[10px] text-muted-foreground leading-relaxed">
                    <p className="font-medium text-foreground mb-1">Auto Analysis Active</p>
                    <p>Every timeframe (1D → 3m) is analyzed automatically. You'll receive notifications when confirmed entry setups are found.</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {["1D", "4H", "1H", "15m", "5m", "3m"].map(tf => (
                        <span key={tf} className="px-1.5 py-0.5 rounded bg-muted text-[9px] font-mono">{tf}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Coin list */}
              <ScrollArea className="max-h-[400px]">
                <div className="space-y-1.5">
                  {watchlist.map(coin => (
                    <div
                      key={coin.id}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors group"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-bullish animate-pulse" />
                        <span className="text-xs font-mono font-medium text-foreground">{coin.symbol}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeCoin(coin.id, coin.symbol)}
                      >
                        <Trash2 className="w-3 h-3 text-bearish" />
                      </Button>
                    </div>
                  ))}
                  {watchlist.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="text-xs">No coins added yet</p>
                      <p className="text-[10px] mt-1">Add coins like BTCUSDT, ETHUSDT to start</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Signals Panel */}
          <Card className="lg:col-span-2 border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Zap className="w-4 h-4 text-warning" />
                Live Signals
                {unreadCount > 0 && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{unreadCount} new</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="space-y-2">
                  {signals.map(signal => (
                    <div
                      key={signal.id}
                      className={`rounded-lg border p-3 transition-all cursor-pointer ${
                        !signal.is_read ? "bg-primary/5 border-primary/20" : "bg-muted/20 border-border"
                      }`}
                      onClick={() => {
                        if (!signal.is_read) markRead(signal.id);
                        setExpandedSignal(expandedSignal === signal.id ? null : signal.id);
                      }}
                    >
                      {/* Signal header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getTrendIcon(signal.trend)}
                          <span className="font-mono font-bold text-sm text-foreground">{signal.symbol}</span>
                          <Badge className={`text-[10px] px-1.5 py-0 ${getSignalColor(signal.signal_type)}`}>
                            {signal.signal_type.replace("_", " ").toUpperCase()}
                          </Badge>
                          <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {signal.timeframe}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {timeSince(signal.created_at)}
                          </span>
                          {expandedSignal === signal.id
                            ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                            : <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          }
                        </div>
                      </div>

                      {/* Quick info */}
                      <div className="flex items-center gap-3 mt-2 text-[10px]">
                        <span className="text-muted-foreground">
                          Entry: <span className="text-foreground font-mono font-medium">${formatPrice(signal.entry_price)}</span>
                        </span>
                        <span className="text-muted-foreground">
                          SL: <span className="text-bearish font-mono">${formatPrice(signal.stop_loss)}</span>
                        </span>
                        <span className="text-muted-foreground">
                          TP1: <span className="text-bullish font-mono">${formatPrice(signal.take_profit_1)}</span>
                        </span>
                        <span className="text-muted-foreground flex items-center gap-0.5">
                          <Shield className="w-3 h-3" />
                          R:R {signal.risk_reward}
                        </span>
                        <span className="text-muted-foreground">
                          Confidence: <span className="text-primary font-bold">{signal.confidence}%</span>
                        </span>
                      </div>

                      {/* Expanded details */}
                      {expandedSignal === signal.id && (
                        <div className="mt-3 pt-3 border-t border-border space-y-3">
                          {/* Price levels */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <div className="rounded-lg bg-muted/30 p-2">
                              <p className="text-[9px] text-muted-foreground">Entry</p>
                              <p className="text-xs font-mono font-bold text-foreground">${formatPrice(signal.entry_price)}</p>
                            </div>
                            <div className="rounded-lg bg-bearish/10 p-2">
                              <p className="text-[9px] text-bearish">Stop Loss</p>
                              <p className="text-xs font-mono font-bold text-bearish">${formatPrice(signal.stop_loss)}</p>
                              <p className="text-[9px] text-muted-foreground">
                                {((Math.abs(signal.entry_price - signal.stop_loss) / signal.entry_price) * 100).toFixed(2)}%
                              </p>
                            </div>
                            <div className="rounded-lg bg-bullish/10 p-2">
                              <p className="text-[9px] text-bullish">TP1</p>
                              <p className="text-xs font-mono font-bold text-bullish">${formatPrice(signal.take_profit_1)}</p>
                            </div>
                            <div className="rounded-lg bg-bullish/10 p-2">
                              <p className="text-[9px] text-bullish">TP2 / TP3</p>
                              <p className="text-xs font-mono font-bold text-bullish">
                                ${formatPrice(signal.take_profit_2)} / ${formatPrice(signal.take_profit_3)}
                              </p>
                            </div>
                          </div>

                          {/* Reasons */}
                          <div>
                            <p className="text-[10px] font-semibold text-foreground mb-1.5">Analysis Reasons:</p>
                            <div className="space-y-1">
                              {signal.reasons.map((reason: string, idx: number) => (
                                <div key={idx} className="text-[10px] text-muted-foreground flex items-start gap-1.5">
                                  <span className="shrink-0 mt-0.5">•</span>
                                  <span>{reason}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Indicator data */}
                          {signal.indicator_data && (
                            <div className="flex flex-wrap gap-2 text-[9px]">
                              {signal.indicator_data.rsi && (
                                <span className="px-2 py-1 rounded bg-muted text-muted-foreground">
                                  RSI: {typeof signal.indicator_data.rsi === 'number' ? signal.indicator_data.rsi.toFixed(1) : signal.indicator_data.rsi}
                                </span>
                              )}
                              {signal.indicator_data.ema20 && (
                                <span className="px-2 py-1 rounded bg-muted text-muted-foreground">
                                  EMA20: {formatPrice(signal.indicator_data.ema20)}
                                </span>
                              )}
                              {signal.indicator_data.ema50 && (
                                <span className="px-2 py-1 rounded bg-muted text-muted-foreground">
                                  EMA50: {formatPrice(signal.indicator_data.ema50)}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}

                  {signals.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">No signals yet</p>
                      <p className="text-[10px] mt-1">Add coins to your watchlist and signals will appear here automatically</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
