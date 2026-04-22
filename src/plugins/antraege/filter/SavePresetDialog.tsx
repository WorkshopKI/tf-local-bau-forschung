import { useEffect, useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (name: string, description?: string) => Promise<void> | void;
}

export function SavePresetDialog({ open, onClose, onSave }: Props): React.ReactElement | null {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName('');
      setDescription('');
    }
  }, [open]);

  const handleSave = async (): Promise<void> => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave(name.trim(), description.trim() || undefined);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Als Preset speichern"
      description="Speichert die aktuellen Filter-Einstellungen als privates Preset auf diesem Gerät."
      footer={
        <>
          <Button size="sm" variant="ghost" onClick={onClose}>Abbrechen</Button>
          <Button size="sm" variant="default" onClick={() => void handleSave()} disabled={!name.trim() || saving}>
            Speichern
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div>
          <label className="block text-[13px] font-medium text-[var(--tf-text)] mb-1">Name</label>
          <Input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="z.B. Meine Bewilligten"
          />
        </div>
        <div>
          <label className="block text-[13px] font-medium text-[var(--tf-text)] mb-1">Beschreibung (optional)</label>
          <Input
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>
      </div>
    </Dialog>
  );
}
