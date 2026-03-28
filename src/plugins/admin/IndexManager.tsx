import { useState, useEffect } from 'react';
import { Database, RefreshCw, AlertCircle, Trash2 } from 'lucide-react';
import { Button, Badge, SectionHeader } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import { BatchIndexer } from '@/core/services/search/batch-indexer';
import type { IndexStatus } from '@/core/services/search/batch-indexer';
import { seedTestData, clearSeedData } from '@/core/services/seed/seed-data';

export function IndexManager(): React.ReactElement {
  const storage = useStorage();
  const [status, setStatus] = useState<IndexStatus | null>(null);
  const [running, setRunning] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [chunkCount, setChunkCount] = useState(0);
  const [docCount, setDocCount] = useState(0);
  const [hasGPU, setHasGPU] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedProgress, setSeedProgress] = useState('');
  const fsConnected = storage.isFileServerConnected();

  useEffect(() => {
    storage.idb.get<boolean>('seed-complete').then(v => setSeeded(!!v));
    storage.idb.get<string>('index-last-update').then(v => setLastUpdate(v));
    storage.idb.keys('doc:').then(k => setDocCount(k.length));
    storage.idb.get<unknown[]>('vector-chunks').then(c => setChunkCount(c?.length ?? 0));
    if ('gpu' in navigator) {
      (navigator as { gpu: { requestAdapter: () => Promise<unknown> } }).gpu
        .requestAdapter().then(a => setHasGPU(!!a)).catch(() => setHasGPU(false));
    }
  }, [storage]);

  const runIndex = async (full: boolean): Promise<void> => {
    setRunning(true);
    setStatus(null);
    try {
      if (full) await storage.idb.delete('index-manifest');
      const indexer = new BatchIndexer();
      await indexer.init(hasGPU);
      const chunks = await indexer.indexAll(storage, setStatus);
      setChunkCount(chunks.length);
      setLastUpdate(new Date().toISOString());
      indexer.destroy();
    } catch (err) { console.error('Indexing failed:', err); }
    finally { setRunning(false); }
  };

  const progress = status && status.total > 0 ? Math.round((status.processed / status.total) * 100) : 0;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-[22px] font-medium text-[var(--tf-text)] mb-6">Index-Verwaltung</h1>

      <SectionHeader label="Testdaten" />
      <div className="mt-3 mb-6 space-y-3">
        <p className="text-[12px] text-[var(--tf-text-secondary)]">
          Erzeugt 40 Vorgänge, 60 Dokumente und 10 Artefakte mit realistischem Inhalt.
        </p>
        {seedProgress && <p className="text-[12px] text-[var(--tf-text-secondary)]">{seedProgress}</p>}
        <div className="flex gap-3">
          <Button variant="secondary" icon={Database} disabled={seeding || seeded}
            onClick={async () => {
              setSeeding(true);
              setSeedProgress('Erzeuge...');
              try {
                const result = await seedTestData(storage, (c, t) => setSeedProgress(`Erzeuge... (${c}/${t})`));
                setSeedProgress(`✓ ${result.vorgaenge} Vorgänge, ${result.dokumente} Dokumente, ${result.artefakte} Artefakte erzeugt`);
                setSeeded(true);
                storage.idb.keys('doc:').then(k => setDocCount(k.length));
              } catch (err) { setSeedProgress(`Fehler: ${err}`); }
              finally { setSeeding(false); }
            }}>
            {seeded ? 'Testdaten vorhanden' : seeding ? 'Erzeuge...' : 'Testdaten generieren'}
          </Button>
          {seeded && (
            <Button variant="danger" icon={Trash2} disabled={seeding}
              onClick={async () => {
                await clearSeedData(storage);
                setSeeded(false);
                setDocCount(0);
                setSeedProgress('Testdaten gelöscht');
              }}>
              Testdaten löschen
            </Button>
          )}
        </div>
      </div>

      <SectionHeader label="Status" />
      <div className="grid grid-cols-3 gap-4 mt-3 mb-6">
        <MetricCard label="Dokumente" value={String(docCount)} />
        <MetricCard label="Chunks" value={String(chunkCount)} />
        <MetricCard label="Letztes Update" value={lastUpdate ? new Date(lastUpdate).toLocaleDateString('de-DE') : 'Noch nie'} />
      </div>

      <SectionHeader label="Konfiguration" />
      <div className="mt-3 mb-6 space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-[var(--tf-text)]">GPU</span>
          <Badge variant={hasGPU ? 'success' : 'default'}>
            {hasGPU ? '● WebGPU' : '● WASM'}
          </Badge>
        </div>

        {!fsConnected && (
          <div className="flex items-center gap-2 p-3 bg-[var(--tf-warning-bg)] rounded-[var(--tf-radius)]">
            <AlertCircle size={14} className="text-[var(--tf-warning-text)]" />
            <p className="text-[12px] text-[var(--tf-warning-text)]">File Server nicht verbunden. Index nur lokal.</p>
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="secondary" icon={Database} disabled={running || docCount === 0} onClick={() => runIndex(false)}>
            Nur neue indexieren
          </Button>
          <Button variant="secondary" icon={RefreshCw} disabled={running || docCount === 0} onClick={() => runIndex(true)}>
            Komplett neu
          </Button>
        </div>
      </div>

      {running && status && (
        <div>
          <SectionHeader label="Fortschritt" />
          <div className="mt-3 space-y-2">
            <div className="flex justify-between text-[12px] text-[var(--tf-text-secondary)]">
              <span>{status.phase}: {status.currentDoc}</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full h-1 bg-[var(--tf-bg-secondary)] rounded-full overflow-hidden">
              <div className="h-full bg-[var(--tf-text)] rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-[11px] text-[var(--tf-text-tertiary)]">
              {status.processed}/{status.total} verarbeitet, {status.skipped} übersprungen
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="bg-[var(--tf-bg-secondary)] rounded-[var(--tf-radius)] p-4">
      <p className="text-[22px] font-medium text-[var(--tf-text)]">{value}</p>
      <p className="text-[12px] text-[var(--tf-text-tertiary)]">{label}</p>
    </div>
  );
}
