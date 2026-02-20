import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Globe } from 'lucide-react';

interface SaveStrategyDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (name: string, description: string) => void;
  onPublish?: (name: string, description: string, authorName: string) => void;
  initialName?: string;
  initialDescription?: string;
  mode?: 'save' | 'edit';
  showPublish?: boolean;
}

export function SaveStrategyDialog({ open, onClose, onSave, onPublish, initialName = '', initialDescription = '', mode = 'save', showPublish = false }: SaveStrategyDialogProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [alsoPublish, setAlsoPublish] = useState(false);
  const [authorName, setAuthorName] = useState('');

  const handleSave = () => {
    if (!name.trim()) return;
    if (alsoPublish && !authorName.trim()) return;
    onSave(name.trim(), description.trim());
    if (alsoPublish && onPublish) {
      onPublish(name.trim(), description.trim(), authorName.trim());
    }
    setName('');
    setDescription('');
    setAlsoPublish(false);
    setAuthorName('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md bg-card border-border" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{mode === 'edit' ? 'Edit Strategy' : 'Save Strategy'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="Strategy name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Textarea
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
          {showPublish && mode === 'save' && (
            <>
              <div className="flex items-center gap-2 pt-1">
                <Checkbox id="also-publish" checked={alsoPublish} onCheckedChange={(v) => setAlsoPublish(!!v)} />
                <label htmlFor="also-publish" className="text-sm flex items-center gap-1.5 cursor-pointer">
                  <Globe className="w-3.5 h-3.5 text-primary" />
                  Also publish to Marketplace
                </label>
              </div>
              {alsoPublish && (
                <Input
                  placeholder="Your display name (public)"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                />
              )}
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!name.trim() || (alsoPublish && !authorName.trim())}>
            {mode === 'edit' ? 'Update' : alsoPublish ? 'Save & Publish' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
