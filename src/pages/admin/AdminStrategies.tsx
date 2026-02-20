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
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Strategy Management</h2>
        <p className="text-sm text-muted-foreground">{strategies.length} community strategies</p>
      </div>

      <Card className="border-border overflow-hidden">
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
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
            ) : strategies.map(s => (
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
      </Card>
    </div>
  );
}
