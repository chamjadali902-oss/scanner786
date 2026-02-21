import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Strategy {
  id: string;
  name: string;
  author_name: string;
  description: string | null;
  is_public: boolean;
  likes_count: number;
  copies_count: number;
  created_at: string;
}

export default function AdminStrategies() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchStrategies = async () => {
    setLoading(true);
    const { data } = await supabase.from('community_strategies').select('*').order('created_at', { ascending: false });
    setStrategies(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchStrategies(); }, []);

  const toggleVisibility = async (id: string, current: boolean) => {
    await supabase.from('community_strategies').update({ is_public: !current }).eq('id', id);
    toast({ title: current ? 'Strategy hidden' : 'Strategy made public' });
    fetchStrategies();
  };

  const deleteStrategy = async (id: string) => {
    await supabase.from('community_strategies').delete().eq('id', id);
    toast({ title: 'Strategy deleted' });
    fetchStrategies();
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Strategy Management</h2>
        <p className="text-sm text-muted-foreground">{strategies.length} community strategies</p>
      </div>

      <Card className="border-border overflow-hidden">
        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading...</div>
        ) : (
          <>
            <div className="space-y-3 p-3 md:hidden">
              {strategies.map(s => (
                <div key={s.id} className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-medium text-foreground text-sm truncate">{s.name}</h3>
                    {s.is_public ? (
                      <Badge className="bg-bullish/10 text-bullish border-bullish/20">Public</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">Hidden</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Author: {s.author_name}</p>
                  <p className="text-xs text-muted-foreground">Likes: {s.likes_count} • Copies: {s.copies_count}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => toggleVisibility(s.id, s.is_public)} className="flex-1 text-xs gap-1">
                      {s.is_public ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      {s.is_public ? 'Hide' : 'Show'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => deleteStrategy(s.id)} className="flex-1 text-xs gap-1 text-destructive hover:text-destructive">
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Author</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Likes</TableHead>
                    <TableHead>Copies</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {strategies.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium text-foreground">{s.name}</TableCell>
                      <TableCell className="text-muted-foreground">{s.author_name}</TableCell>
                      <TableCell>
                        {s.is_public ? (
                          <Badge className="bg-bullish/10 text-bullish border-bullish/20">Public</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">Hidden</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{s.likes_count}</TableCell>
                      <TableCell className="text-muted-foreground">{s.copies_count}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="sm" onClick={() => toggleVisibility(s.id, s.is_public)} className="text-xs gap-1">
                          {s.is_public ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          {s.is_public ? 'Hide' : 'Show'}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteStrategy(s.id)} className="text-xs gap-1 text-destructive hover:text-destructive">
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
