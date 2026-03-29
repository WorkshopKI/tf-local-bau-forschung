import { useState, useEffect, useRef } from 'react';
import { Database, RefreshCw, AlertCircle, Trash2, Square, CheckCircle2, XCircle } from 'lucide-react';
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
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ chunks: number; docs: number; duration: string } | null>(null);
  const [aborted, setAborted] = useState(false);
  const abortRef = useRef(new AbortController());
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
    setError(null);
    setResult(null);
    setAborted(false);
    abortRef.current = new AbortController();
    const startTime = Date.now();

    try {
      if (full) await storage.idb.delete('index-manifest');
      const indexer = new BatchIndexer();
      await indexer.init(hasGPU, setStatus);
      const chunks = await indexer.indexAll(storage, setStatus, abortRef.current.signal);
      const elapsed = Date.now() - startTime;
      setChunkCount(chunks.length);
      setLastUpdate(new Date().toISOString());
      indexer.destroy();

      if (abortRef.current.signal.aborted) {
        setAborted(true);
      } else {
        setResult({ chunks: chunks.length, docs: status?.total ?? 0, duration: formatDuration(elapsed) });
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setAborted(true);
        // Partielle Ergebnisse wurden bereits gespeichert
        const c = await storage.idb.get<unknown[]>('vector-chunks');
        setChunkCount(c?.length ?? 0);
        setLastUpdate(new Date().toISOString());
      } else {
        setError(String(err));
        console.error('Indexing failed:', err);
      }
    } finally {
      setRunning(false);
    }
  };

  const handleAbort = (): void => {
    abortRef.current.abort();
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-[22px] font-medium text-[var(--tf-text)] mb-6">Index-Verwaltung</h1>

      <SeedSection
        storage={storage} seeded={seeded} seeding={seeding} seedProgress={seedProgress}
        setSeeded={setSeeded} setSeeding={setSeeding} setSeedProgress={setSeedProgress}
        setDocCount={setDocCount}
      />

      <StatusCards docCount={docCount} chunkCount={chunkCount} lastUpdate={lastUpdate} />

      <ConfigSection
        hasGPU={hasGPU} fsConnected={fsConnected} running={running}
        docCount={docCount} onIndex={runIndex} onAbort={handleAbort}
      />

      <ProgressSection status={status} running={running} />

      {result && !running && (
        <ResultBanner chunks={result.chunks} docs={result.docs} duration={result.duration} />
      )}

      {aborted && !running && (
        <AbortBanner processed={status?.processed ?? 0} total={status?.total ?? 0} />
      )}

      {error && !running && (
        <ErrorBanner error={error} onRetry={() => runIndex(true)} />
      )}
    </div>
  );
}

/* ─── Sub-Components ─── */

function SeedSection({ storage, seeded, seeding, seedProgress, setSeeded, setSeeding, setSeedProgress, setDocCount }: {
  storage: ReturnType<typeof useStorage>;
  seeded: boolean; seeding: boolean; seedProgress: string;
  setSeeded: (v: boolean) => void; setSeeding: (v: boolean) => void;
  setSeedProgress: (v: string) => void; setDocCount: (v: number) => void;
}): React.ReactElement {
  return (
    <>
      <SectionHeader label="Testdaten" />
      <div className="mt-3 mb-6 space-y-3">
        <p className="text-[12px] text-[var(--tf-text-secondary)]">
          Erzeugt 40 Vorgaenge, 60 Dokumente und 10 Artefakte mit realistischem Inhalt.
        </p>
        {seedProgress && <p className="text-[12px] text-[var(--tf-text-secondary)]">{seedProgress}</p>}
        <div className="flex gap-3">
          <Button variant="secondary" icon={Database} disabled={seeding || seeded}
            onClick={async () => {
              setSeeding(true);
              setSeedProgress('Erzeuge...');
              try {
                const r = await seedTestData(storage, (c, t) => setSeedProgress(`Erzeuge... (${c}/${t})`));
                setSeedProgress(`${r.vorgaenge} Vorgaenge, ${r.dokumente} Dokumente, ${r.artefakte} Artefakte erzeugt`);
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
                setSeedProgress('Testdaten geloescht');
              }}>
              Testdaten loeschen
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

function StatusCards({ docCount, chunkCount, lastUpdate }: {
  docCount: number; chunkCount: number; lastUpdate: string | null;
}): React.ReactElement {
  return (
    <>
      <SectionHeader label="Status" />
      <div className="grid grid-cols-3 gap-4 mt-3 mb-6">
        <MetricCard label="Dokumente" value={String(docCount)} />
        <MetricCard label="Chunks" value={String(chunkCount)} />
        <MetricCard label="Letztes Update" value={lastUpdate ? new Date(lastUpdate).toLocaleDateString('de-DE') : 'Noch nie'} />
      </div>
    </>
  );
}

function ConfigSection({ hasGPU, fsConnected, running, docCount, onIndex, onAbort }: {
  hasGPU: boolean; fsConnected: boolean; running: boolean;
  docCount: number; onIndex: (full: boolean) => void; onAbort: () => void;
}): React.ReactElement {
  return (
    <>
      <SectionHeader label="Konfiguration" />
      <div className="mt-3 mb-6 space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-[var(--tf-text)]">GPU</span>
          <Badge variant={hasGPU ? 'success' : 'default'}>
            {hasGPU ? 'WebGPU' : 'WASM'}
          </Badge>
        </div>

        {!fsConnected && (
          <div className="flex items-center gap-2 p-3 bg-[var(--tf-warning-bg)] rounded-[var(--tf-radius)]">
            <AlertCircle size={14} className="text-[var(--tf-warning-text)]" />
            <p className="text-[12px] text-[var(--tf-warning-text)]">File Server nicht verbunden. Index nur lokal.</p>
          </div>
        )}

        <div className="flex gap-3">
          {running ? (
            <Button variant="danger" icon={Square} onClick={onAbort}>
              Abbrechen
            </Button>
          ) : (
            <>
              <Button variant="secondary" icon={Database} disabled={docCount === 0} onClick={() => onIndex(false)}>
                Nur neue indexieren
              </Button>
              <Button variant="secondary" icon={RefreshCw} disabled={docCount === 0} onClick={() => onIndex(true)}>
                Komplett neu
              </Button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function ProgressSection({ status, running }: {
  status: IndexStatus | null; running: boolean;
}): React.ReactElement | null {
  if (!running || !status) return null;

  const isModelLoading = status.phase === 'Modell laden';
  const docProgress = status.total > 0 ? Math.round((status.processed / status.total) * 100) : 0;

  return (
    <div>
      <SectionHeader label="Fortschritt" />
      <div className="mt-3 space-y-3">
        {isModelLoading ? (
          <ModelLoadingProgress modelProgress={status.modelProgress} />
        ) : (
          <EmbeddingProgress status={status} docProgress={docProgress} />
        )}
      </div>
    </div>
  );
}

function ModelLoadingProgress({ modelProgress }: {
  modelProgress?: { status: string; loaded?: number; total?: number };
}): React.ReactElement {
  const pct = modelProgress?.loaded && modelProgress?.total
    ? Math.round((modelProgress.loaded / modelProgress.total) * 100)
    : 0;

  return (
    <>
      <div className="flex justify-between text-[12px] text-[var(--tf-text-secondary)]">
        <span>Modell laden... (Erstmalig ~80MB Download)</span>
        {modelProgress?.status && <Badge variant="default">{modelProgress.status}</Badge>}
      </div>
      <div className="w-full h-1 bg-[var(--tf-bg-secondary)] rounded-sm overflow-hidden">
        <div className="h-full bg-[var(--tf-text)] rounded-sm transition-all" style={{ width: `${pct}%` }} />
      </div>
    </>
  );
}

function EmbeddingProgress({ status, docProgress }: {
  status: IndexStatus; docProgress: number;
}): React.ReactElement {
  return (
    <>
      <div className="flex justify-between text-[12px] text-[var(--tf-text-secondary)]">
        <span>Dokument {status.processed + 1}/{status.total} — {status.currentDoc}</span>
        <span>{docProgress}%</span>
      </div>
      <div className="w-full h-1 bg-[var(--tf-bg-secondary)] rounded-sm overflow-hidden">
        <div className="h-full bg-[var(--tf-text)] rounded-sm transition-all" style={{ width: `${docProgress}%` }} />
      </div>
      {status.chunkProgress && (
        <p className="text-[11px] text-[var(--tf-text-tertiary)]">
          Chunk {status.chunkProgress.current}/{status.chunkProgress.total} dieses Dokuments
        </p>
      )}
      <p className="text-[11px] text-[var(--tf-text-tertiary)]">
        {status.processed}/{status.total} verarbeitet, {status.skipped} uebersprungen
      </p>
    </>
  );
}

function ResultBanner({ chunks, docs, duration }: {
  chunks: number; docs: number; duration: string;
}): React.ReactElement {
  return (
    <div className="flex items-center gap-2 p-3 mt-4 bg-[var(--tf-bg-secondary)] rounded-[var(--tf-radius)]">
      <CheckCircle2 size={14} className="text-[var(--tf-text)]" />
      <p className="text-[12px] text-[var(--tf-text)]">
        {chunks} Chunks aus {docs} Dokumenten indexiert — Dauer: {duration}
      </p>
    </div>
  );
}

function AbortBanner({ processed, total }: { processed: number; total: number }): React.ReactElement {
  return (
    <div className="flex items-center gap-2 p-3 mt-4 bg-[var(--tf-warning-bg)] rounded-[var(--tf-radius)]">
      <AlertCircle size={14} className="text-[var(--tf-warning-text)]" />
      <p className="text-[12px] text-[var(--tf-warning-text)]">
        Indexierung abgebrochen. {processed}/{total} Dokumente indexiert.
      </p>
    </div>
  );
}

function ErrorBanner({ error, onRetry }: { error: string; onRetry: () => void }): React.ReactElement {
  return (
    <div className="p-3 mt-4 bg-[var(--tf-error-bg)] rounded-[var(--tf-radius)] space-y-2">
      <div className="flex items-center gap-2">
        <XCircle size={14} className="text-[var(--tf-error-text)]" />
        <p className="text-[12px] text-[var(--tf-error-text)]">{error}</p>
      </div>
      <Button variant="secondary" onClick={onRetry}>Erneut versuchen</Button>
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

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes === 0) return `${secs} Sekunden`;
  return `${minutes}:${String(secs).padStart(2, '0')} Minuten`;
}
