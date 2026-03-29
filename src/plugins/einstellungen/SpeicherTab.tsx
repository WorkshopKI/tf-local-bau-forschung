import { useState } from 'react';
import { FolderOpen, Trash2, FileText, Database } from 'lucide-react';
import { Button, Badge, SectionHeader, ListItem } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import type { DirectoryEntry } from '@/core/types/config';

export function SpeicherTab(): React.ReactElement {
  const storage = useStorage();
  const [directories, setDirectories] = useState<DirectoryEntry[]>(storage.getDirectories());
  const [addLabel, setAddLabel] = useState('');
  const [addType, setAddType] = useState<'documents' | 'data' | null>(null);

  const refresh = (): void => setDirectories(storage.getDirectories());

  const [error, setError] = useState('');

  const handleAdd = async (): Promise<void> => {
    if (!addType || !addLabel.trim()) return;
    setError('');
    const result = await storage.addDirectory(addLabel.trim(), addType);
    if (result) {
      setAddLabel('');
      setAddType(null);
      refresh();
    } else {
      setError('Verzeichnis konnte nicht verbunden werden. Bitte erneut versuchen.');
    }
  };

  const handleRemove = async (id: string): Promise<void> => {
    await storage.removeDirectory(id);
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
            title={dir.label}
            subtitle={dir.folderName ?? ''}
            meta={
              <div className="flex items-center gap-2">
                <Badge variant={dir.type === 'documents' ? 'info' : 'success'}>{dir.type === 'documents' ? 'Dokumente' : 'Daten'}</Badge>
                <button onClick={() => handleRemove(dir.id)} className="p-1 text-[var(--tf-danger-text)] cursor-pointer" title="Trennen"><Trash2 size={12} /></button>
              </div>
            }
            last={i === directories.length - 1}
          />
        ))
      )}

      <SectionHeader label="Verzeichnis hinzufügen" />

      {addType === null ? (
        <div className="flex gap-3">
          <Button variant="secondary" icon={FileText} onClick={() => setAddType('documents')}>
            Dokumentverzeichnis (Lesen)
          </Button>
          <Button variant="secondary" icon={Database} onClick={() => setAddType('data')}>
            Datenverzeichnis (Lesen+Schreiben)
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-[12px] text-[var(--tf-text-secondary)]">
            {addType === 'documents' ? 'Dokumentverzeichnis (nur Lesen) — z.B. Vorlagen, Referenzen' : 'Datenverzeichnis (Lesen+Schreiben) — z.B. Vorgänge, Config'}
          </p>
          <div className="flex gap-2">
            <input value={addLabel} onChange={e => setAddLabel(e.target.value)} placeholder="Label für das Verzeichnis..."
              className="flex-1 px-3 py-2 text-[13px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none placeholder:text-[var(--tf-text-tertiary)]"
              style={{ border: '0.5px solid var(--tf-border)' }}
              onKeyDown={e => { if (e.key === 'Enter' && addLabel.trim()) handleAdd(); }}
              autoFocus />
            <Button icon={FolderOpen} onClick={handleAdd} disabled={!addLabel.trim()}>Ordner wählen</Button>
            <Button variant="ghost" onClick={() => { setAddType(null); setAddLabel(''); setError(''); }}>Abbrechen</Button>
          {error && <p className="text-[12px] text-[var(--tf-danger-text)]">{error}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
