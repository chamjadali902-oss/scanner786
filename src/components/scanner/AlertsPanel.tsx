import { useAlerts } from '@/hooks/useAlerts';
import { usePriceAlerts } from '@/hooks/usePriceAlerts';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Bell, BellOff, Check, Trash2, X, Target, Pause, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export function AlertsPanel() {
  const { alerts, unreadCount, notificationsEnabled, enableNotifications, markRead, markAllRead, clearAlerts } = useAlerts();
  const { alerts: triggers, removeAlert, setStatus, clearTriggered } = usePriceAlerts();

  const activeTriggers = triggers.filter((t) => t.status === 'active');
  const otherTriggers = triggers.filter((t) => t.status !== 'active');

  const fmt = (p: number) => (p < 1 ? p.toExponential(4) : p < 100 ? p.toFixed(4) : p.toFixed(2));

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative h-7 sm:h-8 w-7 sm:w-8 p-0">
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-bearish text-[9px] text-white font-bold flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <Tabs defaultValue="feed">
          <div className="flex items-center justify-between p-3 pb-0">
            <TabsList className="h-7">
              <TabsTrigger value="feed" className="h-6 px-2.5 text-[11px]">Alerts</TabsTrigger>
              <TabsTrigger value="triggers" className="h-6 px-2.5 text-[11px] gap-1">
                <Target className="w-3 h-3" />
                Triggers
                {activeTriggers.length > 0 && <span className="text-[9px] text-primary">{activeTriggers.length}</span>}
              </TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-1">
              {!notificationsEnabled && (
                <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={enableNotifications}>
                  <BellOff className="w-3 h-3" /> Enable
                </Button>
              )}
            </div>
          </div>

          <TabsContent value="feed" className="mt-0">
            <div className="flex items-center justify-between px-3 pb-1.5">
              <span />
              {alerts.length > 0 && (
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={markAllRead}>
                    <Check className="w-3 h-3" /> Read all
                  </Button>
                  <Button variant="ghost" size="sm" className="h-6" onClick={clearAlerts}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>
            <div className="max-h-64 overflow-y-auto">
              {alerts.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">No alerts yet</div>
              ) : (
                alerts.slice(0, 20).map(alert => (
                  <div key={alert.id}
                    className={cn('p-2.5 border-b border-border/50 hover:bg-muted/20 cursor-pointer transition-colors', !alert.read && 'bg-primary/5')}
                    onClick={() => markRead(alert.id)}>
                    <div className="flex items-start gap-2">
                      {!alert.read && <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate">{alert.title}</p>
                        <p className="text-[10px] text-muted-foreground line-clamp-2">{alert.message}</p>
                        <p className="text-[9px] text-muted-foreground/50 mt-0.5">{new Date(alert.timestamp).toLocaleTimeString()}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="triggers" className="mt-0">
            <div className="flex items-center justify-between px-3 pb-1.5">
              <span className="text-[10px] text-muted-foreground">Monitored while the app is open</span>
              {otherTriggers.length > 0 && (
                <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={clearTriggered}>
                  <Trash2 className="w-3 h-3" /> Clear hit
                </Button>
              )}
            </div>
            <div className="max-h-64 overflow-y-auto">
              {activeTriggers.length === 0 && otherTriggers.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  No trigger alerts. Set one from any scanner result card with the bell icon.
                </div>
              ) : (
                <>
                  {activeTriggers.map(t => (
                    <div key={t.id} className="p-2.5 border-b border-border/50">
                      <div className="flex items-center gap-2">
                        <Target className="w-3.5 h-3.5 text-primary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate">
                            {t.symbol.replace('USDT', '')} {t.direction === 'above' ? 'above' : 'below'} {fmt(Number(t.trigger_price))}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {t.note ? `${t.note} · ` : ''}{t.timeframe ? `${t.timeframe} · ` : ''}{t.direction === 'above' ? 'long' : 'short'} trigger
                          </p>
                        </div>
                        <button
                          onClick={() => setStatus(t.id, 'paused')}
                          className="p-1 rounded hover:bg-muted/50 transition-colors"
                          title="Pause"
                        >
                          <Pause className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => removeAlert(t.id)}
                          className="p-1 rounded hover:bg-muted/50 transition-colors"
                          title="Delete"
                        >
                          <X className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {otherTriggers.map(t => (
                    <div key={t.id} className={cn('p-2.5 border-b border-border/50', t.status === 'triggered' && 'bg-primary/5')}>
                      <div className="flex items-center gap-2">
                        <Target className={cn('w-3.5 h-3.5 shrink-0', t.status === 'triggered' ? 'text-bullish' : 'text-muted-foreground')} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate">
                            {t.symbol.replace('USDT', '')} {t.direction === 'above' ? 'above' : 'below'} {fmt(Number(t.trigger_price))}
                            {t.status === 'triggered' && <span className="ml-1.5 text-[9px] font-bold text-bullish uppercase">hit</span>}
                            {t.status === 'paused' && <span className="ml-1.5 text-[9px] font-bold text-muted-foreground uppercase">paused</span>}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {t.status === 'triggered' && t.triggered_at ? `Hit at ${new Date(t.triggered_at).toLocaleString()}` : 'Paused'}
                          </p>
                        </div>
                        {t.status === 'paused' && (
                          <button onClick={() => setStatus(t.id, 'active')} className="p-1 rounded hover:bg-muted/50" title="Resume">
                            <Play className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                        )}
                        <button onClick={() => removeAlert(t.id)} className="p-1 rounded hover:bg-muted/50" title="Delete">
                          <X className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
