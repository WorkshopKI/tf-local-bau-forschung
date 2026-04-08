import { useState } from 'react';
import { Trash2, FileText, Database, Pencil, Check, Cpu } from 'lucide-react';
import { Button, Badge, ListItem } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import type { DirectoryEntry } from '@/core/types/config';

export function DirectoriesStep(): React.ReactElement {
  const storage = useStorage();
  const [directories, setDirectories] = useState<DirectoryEntry[]>(storage.getDirectories());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [error, setError] = useState('');

  const refresh = (): void => setDirectories(storage.getDirectories());

  const handleAdd = async (type: 'documents' | 'data' | 'models'): Promise<void> => {
    setError('');
    const result = await storage.addDirectory(type);
    if (result) refresh();
    else setError('Verzeichnis konnte nicht verbunden werden.');
  };

  const handleRemove = async (id: string): Promise<void> => {
    await storage.removeDirectory(id);
    refresh();
  };

  const startEdit = (dir: DirectoryEntry): void => {
    setEditingId(dir.id);
    setEditLabel(dir.label);
  };

  const saveEdit = async (): Promise<void> => {
    if (!editingId || !editLabel.trim()) return;
    await storage.updateDirectoryLabel(editingId, editLabel.trim());
    setEditingId(null); setEditLabel('');
    refresh();
  };

  return (
    <div className="space-y-3">
      {directories.length === 0 && (
          <p className="text-[12px] text-[var(--tf-text-secondary)]">
            Verbinden Sie ein Datenverzeichnis (fuer Index und geteilte Dokumente) und ein Dokumentverzeichnis (fuer Quelldateien).
          </p>
        )}

        {directories.map((dir, i) => (
          <ListItem key={dir.id}
            icon={dir.type === 'documents' ? <FileText size={14} className="text-[var(--tf-text-tertiary)]" /> : <Database size={14} className="text-[var(--tf-text-tertiary)]" />}
            title={editingId === dir.id ? (
              <div className="flex items-center gap-1.5">
                <input value={editLabel} onChange={e => setEditLabel(e.target.value)}
                  className="px-2 py-0.5 text-[13px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none"
                  style={{ border: '0.5px solid var(--tf-border)', minWidth: '120px' }}
                  onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null); }}
                  onBlur={saveEdit} autoFocus />
                <button onClick={saveEdit} className="p-0.5 text-[var(--tf-text-secondary)] cursor-pointer hover:text-[var(--tf-text)]"><Check size={12} /></button>
              </div>
            ) : dir.label}
            subtitle={dir.folderName ?? ''}
            meta={
              <div className="flex items-center gap-2">
                <Badge variant={dir.type === 'documents' ? 'info' : dir.type === 'models' ? 'default' : 'success'}>{dir.type === 'documents' ? 'Dokumente' : dir.type === 'models' ? 'Modelle' : 'Daten'}</Badge>
                {editingId !== dir.id && (
                  <button onClick={() => startEdit(dir)} className="p-1 text-[var(--tf-text-tertiary)] cursor-pointer hover:text-[var(--tf-text)]"><Pencil size={12} /></button>
                )}
                <button onClick={() => handleRemove(dir.id)} className="p-1 text-[var(--tf-danger-text)] cursor-pointer"><Trash2 size={12} /></button>
              </div>
            }
            last={i === directories.length - 1}
          />
        ))}

        <div className="flex gap-3">
          <Button variant="secondary" icon={FileText} size="sm" onClick={() => handleAdd('documents')}>Dokumentverzeichnis</Button>
          <Button variant="secondary" icon={Database} size="sm" onClick={() => handleAdd('data')}>Datenverzeichnis</Button>
          <Button variant="secondary" icon={Cpu} size="sm" onClick={() => handleAdd('models')}>Modellverzeichnis</Button>
        </div>
        {error && <p className="text-[12px] text-[var(--tf-danger-text)]">{error}</p>}
    </div>
  );
}
