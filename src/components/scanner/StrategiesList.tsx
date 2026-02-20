import { useState } from 'react';
import { SavedStrategy } from '@/hooks/useStrategies';
import { Button } from '@/components/ui/button';
import { Play, Pencil, Trash2, Clock } from 'lucide-react';
import { SaveStrategyDialog } from './SaveStrategyDialog';
import { ScanCondition, ScanPool, Timeframe } from '@/types/scanner';

interface StrategiesListProps {
  strategies: SavedStrategy[];
  loading: boolean;
  onLoad: (pool: ScanPool, timeframe: Timeframe, conditions: ScanCondition[]) => void;
  onUpdate: (id: string, name: string, description: string) => void;
  onDelete: (id: string) => void;
}

export function StrategiesList({ strategies, loading, onLoad, onUpdate, onDelete }: StrategiesListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = strategies.find(s => s.id === editingId);

  if (loading) {
    return <p className="text-xs text-muted-foreground text-center py-4">Loading strategies...</p>;
  }

  if (strategies.length === 0) {
    return <p className="text-xs text-muted-foreground text-center py-4">No saved strategies yet</p>;
  }

  return (
    <>
      <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
        {strategies.map((s) => (
          <div key={s.id} className="p-3 rounded-lg border border-border bg-background/50 space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-sm">{s.name}</p>
                {s.description && <p className="text-xs text-muted-foreground">{s.description}</p>}
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onLoad(s.scan_pool as ScanPool, s.timeframe as Timeframe, s.conditions)}>
                  <Play className="w-3 h-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(s.id)}>
                  <Pencil className="w-3 h-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onDelete(s.id)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
            <div className="flex gap-2 text-[10px] text-muted-foreground">
              <span className="px-1.5 py-0.5 rounded bg-muted">{s.scan_pool}</span>
              <span className="px-1.5 py-0.5 rounded bg-muted">{s.timeframe}</span>
              <span className="px-1.5 py-0.5 rounded bg-muted">{s.conditions.length} conditions</span>
              <span className="flex items-center gap-1 ml-auto">
                <Clock className="w-3 h-3" />
                {new Date(s.updated_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <SaveStrategyDialog
          open={!!editingId}
          onClose={() => setEditingId(null)}
          onSave={(name, desc) => onUpdate(editing.id, name, desc)}
          initialName={editing.name}
          initialDescription={editing.description || ''}
          mode="edit"
        />
      )}
    </>
  );
}
