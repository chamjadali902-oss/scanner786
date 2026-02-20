import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useCommunityStrategies, CommunityStrategy } from '@/hooks/useCommunityStrategies';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Heart, Copy, Search, Globe, Trash2, Users, FlaskConical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScanCondition, FEATURES } from '@/types/scanner';

export default function Marketplace() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { strategies, loading, toggleLike, copyStrategy, deleteStrategy, hasLiked } = useCommunityStrategies(user?.id);
  const [search, setSearch] = useState('');

  useEffect(() => { if (!authLoading && !user) navigate('/auth'); }, [user, authLoading, navigate]);

  const filtered = strategies.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.description || '').toLowerCase().includes(search.toLowerCase()) ||
    s.author_name.toLowerCase().includes(search.toLowerCase())
  );

  const handleCopy = (strategy: CommunityStrategy) => {
    copyStrategy(strategy.id);
    const params = new URLSearchParams({ pool: strategy.scan_pool, timeframe: strategy.timeframe, conditions: JSON.stringify(strategy.conditions) });
    navigate(`/?${params.toString()}`);
  };

  const getConditionNames = (conditions: ScanCondition[]) =>
    conditions.filter(c => c.enabled).map(c => FEATURES.find(f => f.id === c.feature)?.name || c.feature).slice(0, 4);

  return (
    <AppLayout className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-4xl">
      {/* Search */}
      <div className="relative mb-4 sm:mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search strategies..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 text-sm" />
      </div>

      <div className="flex items-center gap-4 mb-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {strategies.length} strategies</span>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-xs">Loading strategies...</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Globe className="w-10 h-10 text-muted-foreground/30 mb-3" />
          <h3 className="text-sm font-semibold text-muted-foreground mb-1">No Strategies Yet</h3>
          <p className="text-[11px] text-muted-foreground/70 text-center max-w-xs">
            Be the first to publish! Save a strategy from the scanner, then publish it.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {filtered.map(strategy => (
            <div key={strategy.id} className="p-3 sm:p-4 rounded-xl border border-border bg-card card-glow hover:border-primary/50 transition-all">
              <div className="flex items-start justify-between mb-2">
                <div className="min-w-0">
                  <h3 className="font-bold text-xs sm:text-sm truncate">{strategy.name}</h3>
                  <p className="text-[9px] sm:text-[10px] text-muted-foreground">by {strategy.author_name}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-primary/10 text-primary">{strategy.timeframe.toUpperCase()}</span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] bg-muted text-muted-foreground capitalize">{strategy.scan_pool}</span>
                </div>
              </div>

              {strategy.description && <p className="text-[10px] sm:text-xs text-muted-foreground mb-2.5 line-clamp-2">{strategy.description}</p>}

              <div className="flex flex-wrap gap-1 mb-2.5">
                {getConditionNames(strategy.conditions).map((name, i) => (
                  <span key={i} className="px-1.5 py-0.5 rounded text-[9px] bg-accent/10 text-accent border border-accent/20">{name}</span>
                ))}
                {strategy.conditions.filter(c => c.enabled).length > 4 && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] bg-muted text-muted-foreground">+{strategy.conditions.filter(c => c.enabled).length - 4}</span>
                )}
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <Button variant="ghost" size="sm" className={cn('gap-1 h-6 text-[10px] px-2', hasLiked(strategy.id) && 'text-bearish')} onClick={() => toggleLike(strategy.id)}>
                  <Heart className={cn('w-3 h-3', hasLiked(strategy.id) && 'fill-current')} />{strategy.likes_count}
                </Button>
                <Button variant="outline" size="sm" className="gap-1 h-6 text-[10px] px-2" onClick={() => handleCopy(strategy)}>
                  <Copy className="w-3 h-3" /> Use ({strategy.copies_count})
                </Button>
                <Button variant="outline" size="sm" className="gap-1 h-6 text-[10px] px-2" onClick={() => {
                  const params = new URLSearchParams({ pool: strategy.scan_pool, timeframe: strategy.timeframe, conditions: JSON.stringify(strategy.conditions) });
                  navigate(`/backtest?${params.toString()}`);
                }}>
                  <FlaskConical className="w-3 h-3" /> Backtest
                </Button>
                {user?.id === strategy.user_id && (
                  <Button variant="ghost" size="sm" className="gap-1 h-6 text-[10px] px-2 ml-auto" onClick={() => deleteStrategy(strategy.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
