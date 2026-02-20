import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Users, Globe, BarChart3, TrendingUp } from 'lucide-react';

export default function AdminDashboard() {
  const [stats, setStats] = useState({ users: 0, strategies: 0, trades: 0, communityStrategies: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      const [profiles, strategies, trades, community] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('saved_strategies').select('id', { count: 'exact', head: true }),
        supabase.from('trades').select('id', { count: 'exact', head: true }),
        supabase.from('community_strategies').select('id', { count: 'exact', head: true }),
      ]);
      setStats({
        users: profiles.count ?? 0,
        strategies: strategies.count ?? 0,
        trades: trades.count ?? 0,
        communityStrategies: community.count ?? 0,
      });
    };
    fetchStats();
  }, []);

  const cards = [
    { label: 'Total Users', value: stats.users, icon: Users, color: 'text-primary' },
    { label: 'Saved Strategies', value: stats.strategies, icon: BarChart3, color: 'text-accent' },
    { label: 'Total Trades', value: stats.trades, icon: TrendingUp, color: 'text-bullish' },
    { label: 'Community Strategies', value: stats.communityStrategies, icon: Globe, color: 'text-primary' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Dashboard</h2>
        <p className="text-sm text-muted-foreground">Overview of your platform</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(card => (
          <Card key={card.label} className="p-5 bg-card border-border">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-muted-foreground font-medium">{card.label}</span>
              <card.icon className={`w-4 h-4 ${card.color}`} />
            </div>
            <p className="text-2xl font-bold text-foreground">{card.value}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
