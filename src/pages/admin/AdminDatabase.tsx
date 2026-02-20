import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Database, Trash2, Pencil, RefreshCw, Search, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const TABLES = [
  'profiles',
  'user_roles',
  'trades',
  'saved_strategies',
  'community_strategies',
  'strategy_likes',
  'chat_messages',
  'favorite_coins',
] as const;

type TableName = typeof TABLES[number];

export default function AdminDatabase() {
  const [selectedTable, setSelectedTable] = useState<TableName>('profiles');
  const [rows, setRows] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [editRow, setEditRow] = useState<any | null>(null);
  const [editData, setEditData] = useState<Record<string, string>>({});
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 20;
  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const countQuery = supabase.from(selectedTable).select('*', { count: 'exact', head: true });
    const dataQuery = supabase.from(selectedTable).select('*').range(from, to).order('created_at', { ascending: false });

    const [countRes, dataRes] = await Promise.all([countQuery, dataQuery]);
    
    setTotalCount(countRes.count ?? 0);
    const data = dataRes.data ?? [];
    setRows(data);
    if (data.length > 0) {
      setColumns(Object.keys(data[0]));
    } else {
      setColumns([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    setPage(0);
    setSearch('');
  }, [selectedTable]);

  useEffect(() => {
    fetchData();
  }, [selectedTable, page]);

  const filteredRows = search
    ? rows.filter(row =>
        Object.values(row).some(val =>
          String(val ?? '').toLowerCase().includes(search.toLowerCase())
        )
      )
    : rows;

  const handleDelete = async (row: any) => {
    if (!confirm('Are you sure you want to delete this record?')) return;
    const { error } = await supabase.from(selectedTable).delete().eq('id', row.id);
    if (error) {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Record deleted' });
      fetchData();
    }
  };

  const openEdit = (row: any) => {
    setEditRow(row);
    const data: Record<string, string> = {};
    columns.forEach(col => {
      const val = row[col];
      data[col] = val === null ? '' : typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val);
    });
    setEditData(data);
  };

  const handleSave = async () => {
    if (!editRow) return;
    
    const updatePayload: Record<string, any> = {};
    columns.forEach(col => {
      if (col === 'id' || col === 'created_at') return;
      const raw = editData[col];
      // Try parsing JSON for object fields
      if (raw.startsWith('{') || raw.startsWith('[')) {
        try { updatePayload[col] = JSON.parse(raw); return; } catch {}
      }
      // Try number
      if (raw !== '' && !isNaN(Number(raw)) && col !== 'user_id' && col !== 'strategy_id' && !col.endsWith('_at')) {
        updatePayload[col] = Number(raw);
        return;
      }
      // Boolean
      if (raw === 'true' || raw === 'false') {
        updatePayload[col] = raw === 'true';
        return;
      }
      // Null
      if (raw === '') {
        updatePayload[col] = null;
        return;
      }
      updatePayload[col] = raw;
    });

    const { error } = await supabase.from(selectedTable).update(updatePayload).eq('id', editRow.id);
    if (error) {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Record updated' });
      setEditRow(null);
      fetchData();
    }
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const formatCell = (val: any) => {
    if (val === null || val === undefined) return <span className="text-muted-foreground/50 italic">null</span>;
    if (typeof val === 'boolean') return <Badge variant={val ? 'default' : 'outline'}>{val ? 'true' : 'false'}</Badge>;
    if (typeof val === 'object') return <span className="text-xs font-mono">{JSON.stringify(val).slice(0, 60)}...</span>;
    const str = String(val);
    if (str.length > 50) return str.slice(0, 50) + '...';
    return str;
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Database className="w-5 h-5 text-primary" /> Database Manager
        </h2>
        <p className="text-sm text-muted-foreground">View, edit and delete records from all tables</p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={selectedTable} onValueChange={(v) => setSelectedTable(v as TableName)}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TABLES.map(t => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search records..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        <Button variant="outline" size="sm" onClick={fetchData} className="gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>

        <Badge variant="outline" className="text-xs">
          {totalCount} records
        </Badge>
      </div>

      {/* Table */}
      <Card className="border-border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map(col => (
                  <TableHead key={col} className="text-xs whitespace-nowrap">{col}</TableHead>
                ))}
                <TableHead className="text-right text-xs">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={columns.length + 1} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length + 1} className="text-center py-8 text-muted-foreground">
                    No records found
                  </TableCell>
                </TableRow>
              ) : (
                filteredRows.map((row, i) => (
                  <TableRow key={row.id ?? i}>
                    {columns.map(col => (
                      <TableCell key={col} className="text-xs max-w-[200px] truncate">
                        {formatCell(row[col])}
                      </TableCell>
                    ))}
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(row)} className="h-7 w-7 p-0">
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(row)} className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editRow} onOpenChange={() => setEditRow(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Record</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {columns.map(col => (
              <div key={col}>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">{col}</label>
                {col === 'id' || col === 'created_at' ? (
                  <Input value={editData[col] ?? ''} disabled className="text-xs bg-muted" />
                ) : (editData[col]?.length ?? 0) > 100 ? (
                  <Textarea
                    value={editData[col] ?? ''}
                    onChange={e => setEditData(prev => ({ ...prev, [col]: e.target.value }))}
                    className="text-xs font-mono"
                    rows={4}
                  />
                ) : (
                  <Input
                    value={editData[col] ?? ''}
                    onChange={e => setEditData(prev => ({ ...prev, [col]: e.target.value }))}
                    className="text-xs"
                  />
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRow(null)}>Cancel</Button>
            <Button onClick={handleSave}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
