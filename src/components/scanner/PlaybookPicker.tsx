import { useState } from 'react';
import { cn } from '@/lib/utils';
import { PLAYBOOKS, Playbook } from '@/lib/playbooks';
import { BookOpen, ChevronDown, TrendingDown, TrendingUp } from 'lucide-react';

interface Props {
  onSelect: (pb: Playbook) => void;
  activeId?: string;
  favoredIds?: string[];
  disabled?: boolean;
}

export function PlaybookPicker({ onSelect, activeId, favoredIds = [], disabled }: Props) {
  const [open, setOpen] = useState(true);

  const sorted = [...PLAYBOOKS].sort((a, b) => {
    const af = favoredIds.includes(a.id) ? 0 : 1;
    const bf = favoredIds.includes(b.id) ? 0 : 1;
    return af - bf;
  });

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between mb-2"
      >
        <h3 className="text-xs font-semibold flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary" />
          Pro Playbooks
        </h3>
        <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <>
          <p className="text-[10px] text-muted-foreground mb-2">
            Ready-made modern setups. Ek click me conditions load ho jaengi.
          </p>
          <div className="space-y-1.5">
            {sorted.map(pb => {
              const favored = favoredIds.includes(pb.id);
              const active = activeId === pb.id;
              return (
                <button
                  key={pb.id}
                  disabled={disabled}
                  onClick={() => onSelect(pb)}
                  className={cn(
                    'w-full text-left p-2 rounded-lg border transition-all',
                    active ? 'border-primary bg-primary/10' : 'border-border bg-muted/20 hover:border-primary/50',
                    disabled && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-semibold">{pb.name}</span>
                    <span className={cn(
                      'flex items-center gap-0.5 px-1 py-px rounded text-[9px] font-semibold',
                      pb.direction === 'long' ? 'bg-bullish/10 text-bullish' : 'bg-bearish/10 text-bearish'
                    )}>
                      {pb.direction === 'long' ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                      {pb.direction.toUpperCase()}
                    </span>
                    <span className="px-1 py-px rounded text-[9px] bg-muted text-muted-foreground">{pb.style}</span>
                    {favored && (
                      <span className="px-1 py-px rounded text-[9px] bg-primary/15 text-primary font-semibold">
                        Regime fit
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1 leading-snug">{pb.description}</p>
                  <p className="text-[9px] text-muted-foreground/70 mt-1 font-mono">
                    {pb.timeframe}{pb.mtfTimeframes ? ` · MTF ${pb.mtfTimeframes.join('/')}` : ''} · min optional {pb.optionalMinMatch}
                  </p>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
