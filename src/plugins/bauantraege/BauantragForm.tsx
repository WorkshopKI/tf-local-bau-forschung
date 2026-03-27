import { useState, useEffect } from 'react';
import { Dialog, Button } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import { useBauantraegeStore } from './store';
import type { Vorgang } from '@/core/types/vorgang';

interface BauantragFormProps {
  open: boolean;
  onClose: () => void;
  initialValues?: Vorgang;
}

export function BauantragForm({ open, onClose, initialValues }: BauantragFormProps): React.ReactElement {
  const storage = useStorage();
  const { add, update } = useBauantraegeStore();
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Vorgang['priority']>('normal');
  const [assignee, setAssignee] = useState('');
  const [deadline, setDeadline] = useState('');
  const [tags, setTags] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open && initialValues) {
      setTitle(initialValues.title);
      setPriority(initialValues.priority);
      setAssignee(initialValues.assignee);
      setDeadline(initialValues.deadline ?? '');
      setTags(initialValues.tags.join(', '));
      setNotes(initialValues.notes);
    } else if (open) {
      setTitle(''); setPriority('normal'); setAssignee('');
      setDeadline(''); setTags(''); setNotes('');
    }
  }, [open, initialValues]);

  const handleSave = async (): Promise<void> => {
    if (!title.trim()) return;
    const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
    if (initialValues) {
      await update({
        ...initialValues,
        title, priority, assignee, notes, tags: tagList,
        deadline: deadline || undefined,
      }, storage);
    } else {
      await add({ title, priority, assignee, notes, tags: tagList, deadline: deadline || undefined }, storage);
    }
    onClose();
  };

  const inputClass = 'w-full px-3 py-2 text-sm bg-[var(--tf-bg)] text-[var(--tf-text)] border border-[var(--tf-border)] rounded-[var(--tf-radius-sm)] outline-none focus:ring-2 focus:ring-[var(--tf-primary)]';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={initialValues ? 'Antrag bearbeiten' : 'Neuer Bauantrag'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Abbrechen</Button>
          <Button disabled={!title.trim()} onClick={handleSave}>Speichern</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-[var(--tf-text)]">Titel *</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="z.B. Neubau EFH Musterstr. 12" className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--tf-text)]">Priorität</label>
            <select value={priority} onChange={e => setPriority(e.target.value as Vorgang['priority'])} className={inputClass}>
              <option value="niedrig">Niedrig</option>
              <option value="normal">Normal</option>
              <option value="hoch">Hoch</option>
              <option value="dringend">Dringend</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--tf-text)]">Frist</label>
            <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className={inputClass} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-[var(--tf-text)]">Zuständiger</label>
          <input value={assignee} onChange={e => setAssignee(e.target.value)} placeholder="Name" className={inputClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-[var(--tf-text)]">Tags</label>
          <input value={tags} onChange={e => setTags(e.target.value)} placeholder="Komma-separiert" className={inputClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-[var(--tf-text)]">Notizen</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className={inputClass} />
        </div>
      </div>
    </Dialog>
  );
}
