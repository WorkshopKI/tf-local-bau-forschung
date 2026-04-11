import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import { ActionCard } from './ActionCard';

interface ActionCardDocumentsProps {
  docCount: number;
  setDocCount: (n: number) => void;
}

export function ActionCardDocuments({ docCount, setDocCount }: ActionCardDocumentsProps): React.ReactElement {
  const storage = useStorage();
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [dirCount, setDirCount] = useState(0);

  useEffect(() => {
    setDirCount(storage.getDirectories().length);
  }, [storage]);

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

  const statusText = `${docCount} Dokumente · ${dirCount} Verzeichnisse`;

  return (
    <ActionCard title="Dokumente scannen" status={result ?? statusText}>
      <Button variant="secondary" size="sm" icon={RefreshCw} disabled={scanning || dirCount === 0}
        onClick={handleScan}>{scanning ? 'Scanne...' : 'Erneut scannen'}</Button>
    </ActionCard>
  );
}
