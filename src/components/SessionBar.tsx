import { useEffect, useState } from 'react';
import { Clock, Globe } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface MarketSession {
  name: string;
  emoji: string;
  openHourUTC: number;
  closeHourUTC: number;
  color: string;
  activeColor: string;
}

const MARKET_SESSIONS: MarketSession[] = [
  { name: 'Sydney', emoji: '🇦🇺', openHourUTC: 22, closeHourUTC: 7, color: 'text-blue-400', activeColor: 'bg-blue-500/20 border-blue-500/40 text-blue-400' },
  { name: 'Tokyo', emoji: '🇯🇵', openHourUTC: 0, closeHourUTC: 9, color: 'text-rose-400', activeColor: 'bg-rose-500/20 border-rose-500/40 text-rose-400' },
  { name: 'London', emoji: '🇬🇧', openHourUTC: 8, closeHourUTC: 17, color: 'text-amber-400', activeColor: 'bg-amber-500/20 border-amber-500/40 text-amber-400' },
  { name: 'New York', emoji: '🇺🇸', openHourUTC: 13, closeHourUTC: 22, color: 'text-emerald-400', activeColor: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' },
];

function isSessionActive(session: MarketSession, nowUTC: Date): boolean {
  const hour = nowUTC.getUTCHours();
  if (session.openHourUTC < session.closeHourUTC) {
    return hour >= session.openHourUTC && hour < session.closeHourUTC;
  }
  // Wraps midnight (e.g., Sydney 22-7)
  return hour >= session.openHourUTC || hour < session.closeHourUTC;
}

function getTimeUntilClose(session: MarketSession, nowUTC: Date): string {
  const nowMs = nowUTC.getTime();
  const closeToday = new Date(nowUTC);
  closeToday.setUTCHours(session.closeHourUTC, 0, 0, 0);

  let closeMs = closeToday.getTime();
  // If close is before now (wraps midnight), add a day
  if (closeMs <= nowMs) {
    closeMs += 24 * 60 * 60 * 1000;
  }

  const diff = closeMs - nowMs;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function SessionBar() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const activeSessions = MARKET_SESSIONS.filter(s => isSessionActive(s, now));

  return (
    <div className="w-full bg-primary/5 border-b border-primary/10 px-3 sm:px-4 py-1.5">
      <div className="container mx-auto flex items-center justify-between text-[10px] sm:text-xs">
        {/* Left: Market status */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="flex items-center gap-1 text-muted-foreground shrink-0">
            <Globe className="w-3 h-3 text-primary" />
            <span className="hidden sm:inline font-medium">Markets</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto">
            {MARKET_SESSIONS.map(session => {
              const active = isSessionActive(session, now);
              return (
                <Badge
                  key={session.name}
                  variant="outline"
                  className={`text-[9px] sm:text-[10px] px-1.5 py-0 h-5 shrink-0 font-mono transition-all ${
                    active
                      ? session.activeColor
                      : 'border-muted text-muted-foreground/50'
                  }`}
                >
                  <span className="mr-0.5">{session.emoji}</span>
                  <span className="hidden sm:inline mr-1">{session.name}</span>
                  {active ? (
                    <span className="font-semibold">{getTimeUntilClose(session, now)}</span>
                  ) : (
                    <span className="hidden sm:inline">Closed</span>
                  )}
                </Badge>
              );
            })}
          </div>
        </div>

        {/* Right: UTC time */}
        <div className="flex items-center gap-1.5 font-mono shrink-0 ml-2">
          <Clock className="w-3 h-3 text-primary" />
          <span className="text-foreground font-semibold">
            {now.toISOString().slice(11, 19)} UTC
          </span>
        </div>
      </div>
    </div>
  );
}
