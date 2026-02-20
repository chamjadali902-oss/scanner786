import { useAlerts } from '@/hooks/useAlerts';
import { Button } from '@/components/ui/button';
import { Bell, BellOff, Check, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export function AlertsPanel() {
  const { alerts, unreadCount, notificationsEnabled, enableNotifications, markRead, markAllRead, clearAlerts } = useAlerts();

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
        <div className="p-3 border-b border-border flex items-center justify-between">
          <h3 className="text-xs font-semibold">Alerts</h3>
          <div className="flex items-center gap-1">
            {!notificationsEnabled && (
              <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={enableNotifications}>
                <BellOff className="w-3 h-3" /> Enable
              </Button>
            )}
            {alerts.length > 0 && (
              <>
                <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={markAllRead}>
                  <Check className="w-3 h-3" /> Read all
                </Button>
                <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={clearAlerts}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </>
            )}
          </div>
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
      </PopoverContent>
    </Popover>
  );
}
