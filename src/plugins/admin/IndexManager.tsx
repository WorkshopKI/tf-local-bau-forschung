import { useState, useEffect } from 'react';
import { Database, Cpu, RefreshCw, AlertCircle } from 'lucide-react';
import { Button, Badge, Card } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import { BatchIndexer } from '@/core/services/search/batch-indexer';
import type { IndexStatus } from '@/core/services/search/batch-indexer';

export function IndexManager(): React.ReactElement {
  const storage = useStorage();
  const [status, setStatus] = useState<IndexStatus | null>(null);
  const [running, setRunning] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [chunkCount, setChunkCount] = useState(0);
  const [docCount, setDocCount] = useState(0);
  const [hasGPU, setHasGPU] = useState(false);
  const fsConnected = storage.isFileServerConnected();

  useEffect(() => {
    storage.idb.get<string>('index-last-update').then(v => setLastUpdate(v));
    storage.idb.keys('doc:').then(k => setDocCount(k.length));
    storage.idb.get<unknown[]>('vector-chunks').then(c => setChunkCount(c?.length ?? 0));
    if ('gpu' in navigator) {
      (navigator as { gpu: { requestAdapter: () => Promise<unknown> } }).gpu
        .requestAdapter()
        .then(a => setHasGPU(!!a))
        .catch(() => setHasGPU(false));
    }
  }, [storage]);

  const runIndex = async (full: boolean): Promise<void> => {
    setRunning(true);
    setStatus(null);
    try {
      if (full) {
        await storage.idb.delete('index-manifest');
      }
      const indexer = new BatchIndexer();
      await indexer.init(hasGPU);
      const chunks = await indexer.indexAll(storage, setStatus);
      setChunkCount(chunks.length);
      setLastUpdate(new Date().toISOString());
      indexer.destroy();
    } catch (err) {
      console.error('Indexing failed:', err);
    } finally {
      setRunning(false);
    }
  };

  const progress = status && status.total > 0
    ? Math.round((status.processed / status.total) * 100)
    : 0;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold text-[var(--tf-text)] mb-6">Index-Verwaltung</h1>

      <Card className="mb-6">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-[var(--tf-text)]">{docCount}</p>
            <p className="text-sm text-[var(--tf-text-secondary)]">Dokumente</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-[var(--tf-text)]">{chunkCount}</p>
            <p className="text-sm text-[var(--tf-text-secondary)]">Chunks</p>
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--tf-text)]">
              {lastUpdate ? new Date(lastUpdate).toLocaleString('de-DE') : 'Noch nie'}
            </p>
            <p className="text-sm text-[var(--tf-text-secondary)]">Letztes Update</p>
          </div>
        </div>
      </Card>

      <Card className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Cpu size={18} className="text-[var(--tf-text-secondary)]" />
          <span className="text-sm text-[var(--tf-text)]">GPU:</span>
          <Badge variant={hasGPU ? 'success' : 'default'}>{hasGPU ? 'WebGPU verfügbar' : 'Nur WASM'}</Badge>
        </div>

        {!fsConnected && (
          <div className="flex items-center gap-2 p-3 mb-4 bg-yellow-50 border border-yellow-200 rounded-[var(--tf-radius-sm)]">
            <AlertCircle size={16} className="text-yellow-600" />
            <p className="text-sm text-yellow-700">
              File Server nicht verbunden. Index wird nur lokal in IndexedDB gespeichert.
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <Button icon={Database} disabled={running || docCount === 0} onClick={() => runIndex(false)}>
            Nur neue indexieren
          </Button>
          <Button variant="secondary" icon={RefreshCw} disabled={running || docCount === 0} onClick={() => runIndex(true)}>
            Komplett neu
          </Button>
        </div>
      </Card>

      {running && status && (
        <Card>
          <div className="space-y-3">
            <div className="flex justify-between text-sm text-[var(--tf-text)]">
              <span>{status.phase}: {status.currentDoc}</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full h-2 bg-[var(--tf-border)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--tf-primary)] rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-[var(--tf-text-secondary)]">
              {status.processed}/{status.total} verarbeitet, {status.skipped} übersprungen
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
