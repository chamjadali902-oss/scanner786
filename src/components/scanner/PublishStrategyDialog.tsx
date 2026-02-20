import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Globe } from 'lucide-react';

interface PublishStrategyDialogProps {
  open: boolean;
  onClose: () => void;
  onPublish: (name: string, description: string, authorName: string) => void;
}

export function PublishStrategyDialog({ open, onClose, onPublish }: PublishStrategyDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [authorName, setAuthorName] = useState('');

  const handlePublish = () => {
    if (!name.trim() || !authorName.trim()) return;
    onPublish(name.trim(), description.trim(), authorName.trim());
    setName('');
    setDescription('');
    setAuthorName('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            Publish to Marketplace
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Your display name" value={authorName} onChange={e => setAuthorName(e.target.value)} />
          <Input placeholder="Strategy name" value={name} onChange={e => setName(e.target.value)} />
          <Textarea placeholder="Description (optional)" value={description} onChange={e => setDescription(e.target.value)} rows={3} />
          <Button onClick={handlePublish} className="w-full" disabled={!name.trim() || !authorName.trim()}>
            Publish Strategy
          </Button>
          <p className="text-[10px] text-muted-foreground text-center">Your strategy conditions will be visible to everyone.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
