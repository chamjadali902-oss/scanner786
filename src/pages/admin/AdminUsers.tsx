import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shield, User, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Profile {
  id: string;
  user_id: string;
  username: string | null;
  created_at: string;
}

export default function AdminUsers() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    const { data: profilesData } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    setProfiles(profilesData ?? []);

    const { data: rolesData } = await supabase.from('user_roles').select('*');
    const rolesMap: Record<string, string[]> = {};
    rolesData?.forEach(r => {
      if (!rolesMap[r.user_id]) rolesMap[r.user_id] = [];
      rolesMap[r.user_id].push(r.role);
    });
    setRoles(rolesMap);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const toggleAdmin = async (userId: string) => {
    const isCurrentlyAdmin = roles[userId]?.includes('admin');
    if (isCurrentlyAdmin) {
      await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', 'admin');
    } else {
      await supabase.from('user_roles').insert({ user_id: userId, role: 'admin' as any });
    }
    toast({ title: isCurrentlyAdmin ? 'Admin role removed' : 'Admin role granted' });
    fetchData();
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">User Management</h2>
        <p className="text-sm text-muted-foreground">{profiles.length} registered users</p>
      </div>

      <Card className="border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
            ) : profiles.map(profile => (
              <TableRow key={profile.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium text-foreground">{profile.username || 'No username'}</span>
                  </div>
                </TableCell>
                <TableCell>
                  {roles[profile.user_id]?.includes('admin') ? (
                    <Badge className="bg-primary/10 text-primary border-primary/20">Admin</Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">User</Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {new Date(profile.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => toggleAdmin(profile.user_id)} className="gap-1 text-xs">
                    <Shield className="w-3.5 h-3.5" />
                    {roles[profile.user_id]?.includes('admin') ? 'Remove Admin' : 'Make Admin'}
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
