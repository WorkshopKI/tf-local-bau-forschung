import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, FolderOpen, Trash2, FolderPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStorage } from '@/core/hooks/useStorage';
import { ActionCard } from './ActionCard';
import type { DirectoryEntry } from '@/core/types/config';

interface ActionCardDocumentsProps {
  docCount: number;
  setDocCount: (n: number) => void;
}

export function ActionCardDocuments({ docCount, setDocCount }: ActionCardDocumentsProps): React.ReactElement {
  const storage = useStorage();
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [dirs, setDirs] = useState<DirectoryEntry[]>([]);
  const [dirCounts, setDirCounts] = useState<Record<string, number>>({});
  const [error, setError] = useState('');

  const refreshDirs = useCallback((): void => {
    setDirs(storage.getDocDirectories());
  }, [storage]);

  const loadDirCounts = useCallback(async (): Promise<void> => {
    const keys = await storage.idb.keys('doc:');
    const counts: Record<string, number> = {};
    for (const key of keys) {
      const doc = await storage.idb.get<{ directoryId?: string }>(key);
      if (doc?.directoryId) counts[doc.directoryId] = (counts[doc.directoryId] ?? 0) + 1;
    }
    setDirCounts(counts);
  }, [storage]);

  useEffect(() => { refreshDirs(); loadDirCounts(); }, [refreshDirs, loadDirCounts]);

  const handleScan = async (): Promise<void> => {
    setScanning(true); setResult(null);
    try {
      const { scanDocDirectories, importDocuments } = await import('@/core/services/search/document-scanner');
      const files = await scanDocDirectories(storage);
      const r = await importDocuments(storage, files);
      setResult(`${r.imported} importiert, ${r.updated} aktualisiert`);
      storage.idb.keys('doc:').then(k => setDocCount(k.length));
      await loadDirCounts();
    } catch (err) { setResult(`Fehler: ${err}`); }
    finally { setScanning(false); }
  };

  const handleAdd = async (): Promise<void> => {
    setError('');
    const entry = await storage.addDirectory('documents');
    if (entry) { refreshDirs(); }
    else { setError('Ordner konnte nicht verbunden werden.'); }
  };

  const handleRemove = async (id: string): Promise<void> => {
    await storage.removeDirectory(id);
    refreshDirs(); await loadDirCounts();
  };

  /** Die verbundenen Ordner mit ihrer Dokumentzahl — plus ein etwaiger Fehler. */
  const notiz = (dirs.length > 0 || error) ? (
    <>
      {dirs.length > 0 && (
        <div className="space-y-1">
          {dirs.map(dir => (
            <div key={dir.id} className="flex items-center justify-between group">
              <div className="flex items-center gap-2 text-[12px] min-w-0">
                <FolderOpen size={13} className="text-[var(--tf-text-tertiary)] shrink-0" />
                <span className="text-[var(--tf-text-secondary)] truncate">{dir.folderName ?? dir.label}</span>
                {dirCounts[dir.id] != null && (
                  <span className="text-[var(--tf-text-tertiary)] shrink-0">{dirCounts[dir.id]} Dok.</span>
                )}
              </div>
              <button onClick={() => handleRemove(dir.id)} title="Ordner trennen"
                className="p-0.5 shrink-0 text-[var(--tf-text-tertiary)] cursor-pointer opacity-0 group-hover:opacity-100 hover:text-[var(--tf-danger-text)] transition-opacity">
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
      {error && <p className="text-[11px] text-[var(--tf-danger-text)]">{error}</p>}
    </>
  ) : undefined;

  return (
    <ActionCard
      title="Dokumente scannen"
      status={docCount > 0 ? `${docCount} Dokumente gesamt` : dirs.length > 0 ? 'Keine Dokumente importiert' : 'Keine Ordner verbunden'}
      hinweis={result ?? undefined}
      kopfAktion={
        <button onClick={handleAdd}
          className="flex items-center gap-1.5 text-[12px] text-[var(--tf-text-tertiary)] cursor-pointer hover:text-[var(--tf-text)] transition-colors">
          <FolderPlus size={13} className="shrink-0" />
          <span>{dirs.length > 0 ? 'Ordner hinzufuegen' : 'Ordner verbinden'}</span>
        </button>
      }
      notiz={notiz}
    >
      {dirs.length > 0 ? (
        <Button variant="secondary" size="sm" icon={RefreshCw} disabled={scanning}
          onClick={handleScan}>{scanning ? 'Scanne...' : 'Erneut scannen'}</Button>
      ) : (
        <p className="text-[11px] text-[var(--tf-warning-text)]">Dokumentenordner verbinden um Dokumente zu scannen</p>
      )}
    </ActionCard>
  );
}
