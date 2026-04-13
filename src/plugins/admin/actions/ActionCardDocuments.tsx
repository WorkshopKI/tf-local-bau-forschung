import { useState, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import { DirectorySlot } from './DirectorySlot';

interface ActionCardDocumentsProps {
  docCount: number;
  setDocCount: (n: number) => void;
}

export function ActionCardDocuments({ docCount, setDocCount }: ActionCardDocumentsProps): React.ReactElement {
  const storage = useStorage();
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [dirCount, setDirCount] = useState(0);
  const [, forceUpdate] = useState(0);

  const refreshDirs = useCallback((): void => {
    setDirCount(storage.getDocDirectories().length);
    forceUpdate(n => n + 1);
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

  const docDir = storage.getDocDirectories()[0];
  const statusText = dirCount > 0
    ? `${docCount} Dokumente · ${docDir?.folderName ?? docDir?.label ?? ''}`
    : 'Kein Dokumentenordner verbunden';

  return (
    <div className="p-[14px] rounded-[var(--tf-radius)] space-y-2"
      style={{ border: '0.5px solid var(--tf-border)' }}>
      <div>
        <p className="text-[13px] font-medium text-[var(--tf-text)]">Dokumente scannen</p>
        <p className="text-[12px] text-[var(--tf-text-secondary)]">{result ?? statusText}</p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="secondary" size="sm" icon={RefreshCw} disabled={scanning || dirCount === 0}
          onClick={handleScan}>{scanning ? 'Scanne...' : 'Erneut scannen'}</Button>
      </div>
      <DirectorySlot type="documents" label="Dokumentenordner"
        badgeText="Quelldateien" badgeVariant="info" onChanged={refreshDirs} />
    </div>
  );
}
