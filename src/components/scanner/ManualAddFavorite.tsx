import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  onAdd: (symbols: string[]) => void;
}

export function ManualAddFavorite({ onAdd }: Props) {
  const [value, setValue] = useState('');

  const handleAdd = () => {
    const raw = value.trim();
    if (!raw) return;
    // Support comma/space/newline separated entries, pasted lists
    const tokens = raw
      .split(/[\s,;\n]+/)
      .map((t) => t.trim().toUpperCase().replace(/[^A-Z0-9]/g, ''))
      .filter(Boolean)
      .map((t) => (t.endsWith('USDT') ? t : `${t}USDT`));

    if (tokens.length === 0) {
      toast.error('Enter a valid coin symbol');
      return;
    }
    onAdd(Array.from(new Set(tokens)));
    setValue('');
  };

  return (
    <div className="flex items-center gap-2 mb-3">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleAdd();
          }
        }}
        placeholder="Add coin e.g. BTC, ETH, SOLUSDT"
        className="h-8 text-xs"
      />
      <Button onClick={handleAdd} size="sm" className="h-8 px-2" disabled={!value.trim()}>
        <Plus className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}
