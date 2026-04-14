import { useState } from 'react';
import { Trash2, FileText, Database, Pencil, Check, FlaskConical } from 'lucide-react';
import { Button, Badge, SectionHeader, ListItem } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import type { DirectoryEntry } from '@/core/types/config';
import { shouldShowOpfsOption } from '@/core/utils/environment';

export function SpeicherTab(): React.ReactElement {
  const storage = useStorage();
  const [directories, setDirectories] = useState<DirectoryEntry[]>(storage.getDirectories());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [error, setError] = useState('');

  const refresh = (): void => setDirectories(storage.getDirectories());

  const handleAdd = async (type: 'documents' | 'data'): Promise<void> => {
    setError('');
    const result = await storage.addDirectory(type);
    if (result) {
      refresh();
    } else {
      setError('Verzeichnis konnte nicht verbunden werden. Bitte erneut versuchen.');
    }
  };

  const handleAddOpfs = async (type: 'documents' | 'data' | 'models'): Promise<void> => {
    setError('');
    const result = await storage.addOPFSDirectory(type);
    if (result) {
      refresh();
    } else {
      setError('OPFS-Verzeichnis konnte nicht erstellt werden.');
    }
  };

  const showOpfs = shouldShowOpfsOption();

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
    setEditingId(null);
    setEditLabel('');
    refresh();
  };

  return (
    <div className="space-y-6">
      <SectionHeader label="Verbundene Verzeichnisse" />

      {directories.length === 0 ? (
        <p className="text-[13px] text-[var(--tf-text-secondary)]">Keine Verzeichnisse verbunden</p>
      ) : (
        directories.map((dir, i) => (
          <ListItem key={dir.id}
            icon={dir.type === 'documents' ? <FileText size={14} className="text-[var(--tf-text-tertiary)]" /> : <Database size={14} className="text-[var(--tf-text-tertiary)]" />}
            title={editingId === dir.id ? (
              <div className="flex items-center gap-1.5">
                <input value={editLabel} onChange={e => setEditLabel(e.target.value)}
                  className="px-2 py-0.5 text-[13px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none"
                  style={{ border: '0.5px solid var(--tf-border)', minWidth: '120px' }}
                  onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null); }}
                  onBlur={saveEdit}
                  autoFocus />
                <button onClick={saveEdit} className="p-0.5 text-[var(--tf-text-secondary)] cursor-pointer hover:text-[var(--tf-text)]" title="Speichern">
                  <Check size={12} />
                </button>
              </div>
            ) : dir.label}
            subtitle={dir.folderName ?? ''}
            meta={
              <div className="flex items-center gap-2">
                <Badge variant={dir.type === 'documents' ? 'info' : 'success'}>{dir.type === 'documents' ? 'Dokumente' : 'Daten'}</Badge>
                {dir.kind === 'opfs' && (
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                    title="OPFS — lokaler Browser-Storage, kein Sharing zwischen Browsern oder Geräten"
                  >
                    <FlaskConical size={10} /> Sandbox
                  </span>
                )}
                {editingId !== dir.id && (
                  <button onClick={() => startEdit(dir)} className="p-1 text-[var(--tf-text-tertiary)] cursor-pointer hover:text-[var(--tf-text)]" title="Umbenennen">
                    <Pencil size={12} />
                  </button>
                )}
                <button onClick={() => handleRemove(dir.id)} className="p-1 text-[var(--tf-danger-text)] cursor-pointer" title="Trennen"><Trash2 size={12} /></button>
              </div>
            }
            last={i === directories.length - 1}
          />
        ))
      )}

      <SectionHeader label="Verzeichnis hinzufügen" />

      <div className="flex gap-3 flex-wrap">
        <Button variant="secondary" icon={FileText} onClick={() => handleAdd('documents')}>
          Dokumentverzeichnis (Lesen)
        </Button>
        <Button variant="secondary" icon={Database} onClick={() => handleAdd('data')}>
          Datenverzeichnis (Lesen+Schreiben)
        </Button>
      </div>

      {showOpfs && (
        <div className="mt-2 p-3 rounded-[var(--tf-radius)] bg-amber-50/40 dark:bg-amber-950/20" style={{ border: '0.5px solid var(--tf-border)' }}>
          <p className="text-[12px] font-medium text-[var(--tf-text)] mb-1 flex items-center gap-1.5">
            <FlaskConical size={12} className="text-amber-700 dark:text-amber-400" /> OPFS-Sandbox (Dev/Preview)
          </p>
          <p className="text-[11px] text-[var(--tf-text-tertiary)] mb-2.5">
            Browser-interner Speicher — funktioniert in iframes (Preview), aber kein echtes Sharing zwischen Usern oder Geräten.
          </p>
          <div className="flex gap-2 flex-wrap">
            <Button variant="ghost" icon={FileText} onClick={() => handleAddOpfs('documents')}>OPFS-Dokumente</Button>
            <Button variant="ghost" icon={Database} onClick={() => handleAddOpfs('data')}>OPFS-Daten</Button>
            <Button variant="ghost" icon={FlaskConical} onClick={() => handleAddOpfs('models')}>OPFS-Modelle</Button>
          </div>
        </div>
      )}

      {error && <p className="text-[12px] text-[var(--tf-danger-text)]">{error}</p>}
    </div>
  );
}
