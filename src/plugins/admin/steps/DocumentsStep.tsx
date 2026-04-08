import { useState, useEffect } from 'react';
import { AlertCircle, Download, RefreshCw } from 'lucide-react';
import { Button } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';

interface DocumentsStepProps {
  docCount: number;
  setDocCount: (n: number) => void;
}

export function DocumentsStep({
  docCount, setDocCount,
}: DocumentsStepProps): React.ReactElement {
  const storage = useStorage();
  const [newFiles, setNewFiles] = useState(0);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [sharedDocStatus, setSharedDocStatus] = useState<{ missing: number; totalShared: number } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  useEffect(() => {
    if (storage.getDocDirectories().length > 0) {
      import('@/core/services/search/document-scanner').then(({ countChangedDocuments }) =>
        countChangedDocuments(storage).then(c => setNewFiles(c.newFiles)),
      ).catch(() => {});
    }
    if (storage.fs) {
      import('@/core/services/search/document-scanner').then(({ countMissingSharedDocuments }) =>
        countMissingSharedDocuments(storage).then(setSharedDocStatus),
      ).catch(() => {});
    }
  }, [storage]);

  const handleImport = async (): Promise<void> => {
    setImporting(true); setImportResult(null);
    try {
      const { scanDocDirectories, importDocuments } = await import('@/core/services/search/document-scanner');
      const files = await scanDocDirectories(storage);
      const result = await importDocuments(storage, files);
      setImportResult(`${result.imported} importiert, ${result.updated} aktualisiert, ${result.unchanged} unveraendert`);
      storage.idb.keys('doc:').then(k => setDocCount(k.length));
      setNewFiles(0);
    } catch (err) { setImportResult(`Fehler: ${err}`); }
    finally { setImporting(false); }
  };

  const handleSync = async (): Promise<void> => {
    setSyncing(true); setSyncResult(null);
    try {
      const { syncDocumentsFromFileServer } = await import('@/core/services/search/document-scanner');
      const count = await syncDocumentsFromFileServer(storage);
      setSyncResult(`${count} Dokumente synchronisiert`);
      storage.idb.keys('doc:').then(k => setDocCount(k.length));
      setSharedDocStatus(prev => prev ? { ...prev, missing: 0 } : null);
    } catch (err) { setSyncResult(`Fehler: ${err}`); }
    finally { setSyncing(false); }
  };

  const handleDownloadExamples = async (): Promise<void> => {
    const { downloadExampleDocs } = await import('@/core/services/search/example-docs');
    downloadExampleDocs();
  };

  return (
    <div className="space-y-3">
        {/* Server-Sync */}
        {sharedDocStatus && sharedDocStatus.missing > 0 && !syncing && (
          <div className="flex items-center justify-between p-3 bg-[var(--tf-info-bg)] rounded-[var(--tf-radius)]">
            <div className="flex items-center gap-2">
              <AlertCircle size={14} className="text-[var(--tf-info-text)]" />
              <p className="text-[12px] text-[var(--tf-info-text)]">{sharedDocStatus.missing} Dokumente vom Server verfuegbar.</p>
            </div>
            <Button variant="secondary" size="sm" onClick={handleSync}>Synchronisieren</Button>
          </div>
        )}
        {syncResult && <p className="text-[11px] text-[var(--tf-text-tertiary)]">{syncResult}</p>}

        {/* FS-Import */}
        {newFiles > 0 && !importing && (
          <div className="flex items-center justify-between p-3 bg-[var(--tf-info-bg)] rounded-[var(--tf-radius)]">
            <div className="flex items-center gap-2">
              <AlertCircle size={14} className="text-[var(--tf-info-text)]" />
              <p className="text-[12px] text-[var(--tf-info-text)]">{newFiles} neue Dateien in Dokumentverzeichnissen.</p>
            </div>
            <Button variant="secondary" size="sm" onClick={handleImport} disabled={importing}>Importieren</Button>
          </div>
        )}
        {importResult && <p className="text-[11px] text-[var(--tf-text-tertiary)]">{importResult}</p>}

        {newFiles === 0 && docCount > 0 && <p className="text-[12px] text-[var(--tf-text-tertiary)]">Alle Dokumente importiert.</p>}

        <div className="flex gap-3">
          {storage.getDocDirectories().length > 0 && newFiles === 0 && (
            <Button variant="secondary" size="sm" icon={RefreshCw} onClick={handleImport} disabled={importing}>Erneut scannen</Button>
          )}
          <Button variant="ghost" size="sm" icon={Download} onClick={handleDownloadExamples}>Beispieldokumente</Button>
        </div>

    </div>
  );
}
