import { useState, useEffect } from 'react';
import { AlertCircle, Download, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';

interface DocumentsStepProps {
  docCount: number;
  setDocCount: (n: number) => void;
  setSeeded: (v: boolean) => void;
  setChunkCount: (n: number) => void;
  setLastUpdate: (s: string | null) => void;
  setIndexModelId: (s: string | null) => void;
  setNewDocsCount: (n: number) => void;
}

export function DocumentsStep({
  docCount, setDocCount, setSeeded,
  setChunkCount, setLastUpdate, setIndexModelId, setNewDocsCount,
}: DocumentsStepProps): React.ReactElement {
  const storage = useStorage();
  const [newFiles, setNewFiles] = useState(0);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [sharedDocStatus, setSharedDocStatus] = useState<{ missing: number; totalShared: number } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [clearResult, setClearResult] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

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

  const handleClear = async (): Promise<void> => {
    setClearing(true); setClearResult(null);
    try {
      const keys = await storage.idb.keys('doc:');
      for (const key of keys) await storage.idb.delete(key);
      for (const key of ['doc-file-hashes', 'doc-chunk-counts', 'index-manifest', 'orama-db', 'index-chunk-count', 'index-last-update', 'index-model-id', 'seed-complete']) {
        await storage.idb.delete(key);
      }
      setDocCount(0); setChunkCount(0); setLastUpdate(null);
      setIndexModelId(null); setNewDocsCount(0); setSeeded(false);
      setClearResult(`${keys.length} Dokumente und Index geloescht.`);
    } catch (err) { setClearResult(`Fehler: ${err}`); }
    finally { setClearing(false); setConfirmClear(false); }
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

        {/* Wartung */}
        {docCount > 0 && (
          <div className="pt-3 mt-3" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
            <p className="text-[12px] text-[var(--tf-text-tertiary)] mb-2">
              Loescht alle Dokumente und den Suchindex aus dem Browser-Speicher. Dateien auf dem Server bleiben erhalten.
            </p>
            {!confirmClear ? (
              <Button variant="danger" icon={Trash2} size="sm" disabled={clearing} onClick={() => setConfirmClear(true)}>
                Dokument-Store loeschen
              </Button>
            ) : (
              <div className="flex items-center gap-3 p-3 bg-[var(--tf-error-bg)] rounded-[var(--tf-radius)]">
                <p className="text-[12px] text-[var(--tf-error-text)] flex-1">Wirklich alle {docCount} Dokumente loeschen?</p>
                <Button variant="danger" size="sm" loading={clearing} onClick={handleClear}>Ja, loeschen</Button>
                <Button variant="secondary" size="sm" onClick={() => setConfirmClear(false)}>Abbrechen</Button>
              </div>
            )}
            {clearResult && <p className="text-[11px] text-[var(--tf-text-tertiary)] mt-2">{clearResult}</p>}
          </div>
        )}
    </div>
  );
}
