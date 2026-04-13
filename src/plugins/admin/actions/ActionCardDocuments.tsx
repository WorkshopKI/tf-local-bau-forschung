import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, FolderOpen, Trash2, FolderPlus } from 'lucide-react';
import { Button } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
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
  const [error, setError] = useState('');

  const refreshDirs = useCallback((): void => {
    setDirs(storage.getDocDirectories());
  }, [storage]);

  useEffect(() => { refreshDirs(); }, [refreshDirs]);

  const handleScan = async (): Promise<void> => {
    setScanning(true); setResult(null);
    try {
      const { scanDocDirectories, importDocuments } = await import('@/core/services/search/document-scanner');
      const files = await scanDocDirectories(storage);
      const r = await importDocuments(storage, files);
      setResult(`${r.imported} importiert, ${r.updated} aktualisiert`);
      storage.idb.keys('doc:').then(k => setDocCount(k.length));
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
    refreshDirs();
  };

  const docInfo = docCount > 0
    ? `${docCount} Dokumente · ${dirs.length} ${dirs.length === 1 ? 'Ordner' : 'Ordner'}`
    : dirs.length > 0 ? `${dirs.length} ${dirs.length === 1 ? 'Ordner' : 'Ordner'}` : '';

  return (
    <div className="p-[16px] rounded-[var(--tf-radius)] space-y-3"
      style={{ border: '0.5px solid var(--tf-border)' }}>

      {/* Header: title + folder info */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-0.5">
          <p className="text-[13px] font-medium text-[var(--tf-text)]">Dokumente scannen</p>
          <p className="text-[12px] text-[var(--tf-text-secondary)]">{docInfo || 'Keine Ordner verbunden'}</p>
          {result && <p className="text-[11px] text-[var(--tf-text-tertiary)]">{result}</p>}
        </div>
        <div className="shrink-0">
          <button onClick={handleAdd}
            className="flex items-center gap-1.5 text-[12px] text-[var(--tf-text-tertiary)] cursor-pointer hover:text-[var(--tf-text)] transition-colors">
            <FolderPlus size={13} />
            <span>{dirs.length > 0 ? 'Ordner hinzufuegen' : 'Ordner verbinden'}</span>
          </button>
        </div>
      </div>

      {/* Connected folders */}
      {dirs.length > 0 && (
        <div className="space-y-1">
          {dirs.map(dir => (
            <div key={dir.id} className="flex items-center justify-between group">
              <div className="flex items-center gap-2 text-[12px] text-[var(--tf-text-secondary)] min-w-0">
                <FolderOpen size={13} className="text-[var(--tf-text-tertiary)] shrink-0" />
                <span className="truncate">{dir.folderName ?? dir.label}</span>
              </div>
              <button onClick={() => handleRemove(dir.id)} title="Ordner trennen"
                className="p-0.5 text-[var(--tf-text-tertiary)] cursor-pointer opacity-0 group-hover:opacity-100 hover:text-[var(--tf-danger-text)] transition-opacity">
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-[11px] text-[var(--tf-danger-text)]">{error}</p>}

      {/* Actions */}
      {dirs.length > 0 ? (
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="secondary" size="sm" icon={RefreshCw} disabled={scanning}
            onClick={handleScan}>{scanning ? 'Scanne...' : 'Erneut scannen'}</Button>
        </div>
      ) : (
        <p className="text-[11px] text-[var(--tf-warning-text)]">Dokumentenordner verbinden um Dokumente zu scannen</p>
      )}
    </div>
  );
}
