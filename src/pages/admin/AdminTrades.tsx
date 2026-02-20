import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Trash2, Pencil, Search, TrendingUp, TrendingDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Trade {
  id: string;
  user_id: string;
  symbol: string;
  side: string;
  entry_price: number;
  exit_price: number | null;
  quantity: number;
  pnl: number | null;
  pnl_percent: number | null;
  status: string;
  stop_loss: number | null;
  take_profit: number | null;
  notes: string | null;
  opened_at: string;
  closed_at: string | null;
}

export default function AdminTrades() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editTrade, setEditTrade] = useState<Trade | null>(null);
  const [editData, setEditData] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const fetchTrades = async () => {
    setLoading(true);
    const { data } = await supabase.from('trades').select('*').order('created_at', { ascending: false }).limit(200);
    setTrades(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchTrades(); }, []);

  const filtered = search
    ? trades.filter(t => t.symbol.toLowerCase().includes(search.toLowerCase()) || t.side.toLowerCase().includes(search.toLowerCase()))
    : trades;

  const deleteTrade = async (id: string) => {
    if (!confirm('Delete this trade?')) return;
    const { error } = await supabase.from('trades').delete().eq('id', id);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Trade deleted' }); fetchTrades(); }
  };

  const openEdit = (trade: Trade) => {
    setEditTrade(trade);
    setEditData({
      symbol: trade.symbol,
      side: trade.side,
      entry_price: String(trade.entry_price),
      exit_price: trade.exit_price !== null ? String(trade.exit_price) : '',
      quantity: String(trade.quantity),
      stop_loss: trade.stop_loss !== null ? String(trade.stop_loss) : '',
      take_profit: trade.take_profit !== null ? String(trade.take_profit) : '',
      pnl: trade.pnl !== null ? String(trade.pnl) : '',
      pnl_percent: trade.pnl_percent !== null ? String(trade.pnl_percent) : '',
      status: trade.status,
      notes: trade.notes ?? '',
    });
  };

  const handleSave = async () => {
    if (!editTrade) return;
    const payload: Record<string, any> = {
      symbol: editData.symbol,
      side: editData.side,
      entry_price: Number(editData.entry_price),
      exit_price: editData.exit_price ? Number(editData.exit_price) : null,
      quantity: Number(editData.quantity),
      stop_loss: editData.stop_loss ? Number(editData.stop_loss) : null,
      take_profit: editData.take_profit ? Number(editData.take_profit) : null,
      pnl: editData.pnl ? Number(editData.pnl) : null,
      pnl_percent: editData.pnl_percent ? Number(editData.pnl_percent) : null,
      status: editData.status,
      notes: editData.notes || null,
    };
    const { error } = await supabase.from('trades').update(payload).eq('id', editTrade.id);
    if (error) toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Trade updated' }); setEditTrade(null); fetchTrades(); }
  };

  const totalPnl = trades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Trades Management</h2>
          <p className="text-sm text-muted-foreground">{trades.length} trades • Total PnL: <span className={totalPnl >= 0 ? 'text-bullish' : 'text-bearish'}>${totalPnl.toFixed(2)}</span></p>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search symbol..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8" />
        </div>
      </div>

      <Card className="border-border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead>Side</TableHead>
                <TableHead>Entry</TableHead>
                <TableHead>Exit</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>PnL</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : filtered.map(trade => (
                <TableRow key={trade.id}>
                  <TableCell className="font-medium text-foreground">{trade.symbol}</TableCell>
                  <TableCell>
                    <Badge className={trade.side === 'long' ? 'bg-bullish/10 text-bullish border-bullish/20' : 'bg-bearish/10 text-bearish border-bearish/20'}>
                      {trade.side === 'long' ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                      {trade.side}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">${trade.entry_price}</TableCell>
                  <TableCell className="text-muted-foreground">{trade.exit_price ? `$${trade.exit_price}` : '-'}</TableCell>
                  <TableCell className="text-muted-foreground">{trade.quantity}</TableCell>
                  <TableCell>
                    {trade.pnl !== null ? (
                      <span className={trade.pnl >= 0 ? 'text-bullish' : 'text-bearish'}>
                        ${trade.pnl.toFixed(2)} ({trade.pnl_percent?.toFixed(1)}%)
                      </span>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={trade.status === 'open' ? 'default' : 'outline'}>
                      {trade.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(trade.opened_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(trade)} className="h-7 w-7 p-0">
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteTrade(trade.id)} className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editTrade} onOpenChange={() => setEditTrade(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Trade</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {['symbol', 'side', 'entry_price', 'exit_price', 'quantity', 'stop_loss', 'take_profit', 'pnl', 'pnl_percent', 'status', 'notes'].map(field => (
              <div key={field}>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">{field}</label>
                <Input
                  value={editData[field] ?? ''}
                  onChange={e => setEditData(prev => ({ ...prev, [field]: e.target.value }))}
                  className="text-xs"
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTrade(null)}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
