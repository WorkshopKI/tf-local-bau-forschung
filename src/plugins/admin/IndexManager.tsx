import { useState, useEffect, useRef } from 'react';
import { Database, RefreshCw, AlertCircle, Trash2, Square, CheckCircle2, XCircle } from 'lucide-react';
import { Button, Badge, CollapsibleSection, ProgressBar, Select } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import { BatchIndexer } from '@/core/services/search/batch-indexer';
import type { IndexStatus } from '@/core/services/search/batch-indexer';
import {
  EMBEDDING_MODELS, getModelById, getActiveModelId, setActiveModelId,
} from '@/core/services/search/model-registry';
import { seedTestData, clearSeedData } from '@/core/services/seed/seed-data';
import { EvalSection } from './eval/EvalSection';

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
  const [indexResult, setIndexResult] = useState<{ chunks: number; docs: number; duration: string } | null>(null);
  const [aborted, setAborted] = useState(false);
  const [activeModelId, setActiveModelIdState] = useState('minilm-l6-v2');
  const [indexModelId, setIndexModelId] = useState<string | null>(null);
  const abortRef = useRef(new AbortController());
  const fsConnected = storage.isFileServerConnected();

  useEffect(() => {
    storage.idb.get<boolean>('seed-complete').then(v => setSeeded(!!v));
    storage.idb.get<string>('index-last-update').then(v => setLastUpdate(v));
    storage.idb.keys('doc:').then(k => setDocCount(k.length));
    storage.idb.get<number>('index-chunk-count').then(c => setChunkCount(c ?? 0));
    storage.idb.get<string>('index-model-id').then(v => setIndexModelId(v ?? null));
    getActiveModelId(storage.idb).then(setActiveModelIdState);
    if ('gpu' in navigator) {
      (navigator as { gpu: { requestAdapter: () => Promise<unknown> } }).gpu
        .requestAdapter().then(a => setHasGPU(!!a)).catch(() => setHasGPU(false));
    }
  }, [storage]);

  const activeModel = getModelById(activeModelId);
  const indexOutdated = indexModelId !== null && indexModelId !== activeModelId;

  const runIndex = async (full: boolean): Promise<void> => {
    setRunning(true); setStatus(null); setError(null); setIndexResult(null); setAborted(false);
    abortRef.current = new AbortController();
    const startTime = Date.now();
    try {
      if (full) await storage.idb.delete('index-manifest');
      const indexer = new BatchIndexer();
      const model = getModelById(activeModelId);
      await indexer.init(model, hasGPU, setStatus);
      const count = await indexer.indexAll(storage, setStatus, abortRef.current.signal);
      const elapsed = Date.now() - startTime;
      setChunkCount(count); setLastUpdate(new Date().toISOString());
      setIndexModelId(activeModelId);
      indexer.destroy();
      if (abortRef.current.signal.aborted) { setAborted(true); }
      else { setIndexResult({ chunks: count, docs: status?.total ?? 0, duration: formatDuration(elapsed) }); }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setAborted(true);
        const c = await storage.idb.get<unknown[]>('vector-chunks');
        setChunkCount(c?.length ?? 0); setLastUpdate(new Date().toISOString());
      } else { setError(String(err)); console.error('Indexing failed:', err); }
    } finally { setRunning(false); }
  };

  const statusText = (): string => {
    if (docCount === 0) return 'Noch nicht indexiert';
    const parts = [`${docCount} Dokumente`, `${chunkCount} Chunks`];
    if (lastUpdate) parts.push(new Date(lastUpdate).toLocaleDateString('de-DE'));
    return parts.join(' \u00b7 ');
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-[22px] font-medium text-[var(--tf-text)]">Suchindex</h1>
        <p className={`text-[13px] ${docCount === 0 ? 'text-[var(--tf-warning-text)]' : 'text-[var(--tf-text-secondary)]'}`}>
          {statusText()}
        </p>
      </div>

      {/* Section 1: Testdaten */}
      <CollapsibleSection label="Testdaten" defaultOpen={false}
        subtitle={seeded ? '40 Vorgaenge, 60 Dokumente' : 'Keine Testdaten'}>
        <SeedContent storage={storage} seeded={seeded} seeding={seeding} seedProgress={seedProgress}
          setSeeded={setSeeded} setSeeding={setSeeding} setSeedProgress={setSeedProgress} setDocCount={setDocCount} />
      </CollapsibleSection>

      {/* Section 2: Indexierung */}
      <CollapsibleSection label="Indexierung" defaultOpen={true}
        subtitle={hasGPU ? 'WebGPU' : 'CPU (WASM)'}>
        <div className="space-y-3">
          <p className="text-[12px] text-[var(--tf-text-secondary)]">
            {hasGPU ? 'WebGPU verfuegbar — Indexierung laeuft auf GPU.' : 'Kein GPU — Indexierung laeuft auf CPU.'}
          </p>
          {!fsConnected && (
            <div className="flex items-center gap-2 p-3 bg-[var(--tf-warning-bg)] rounded-[var(--tf-radius)]">
              <AlertCircle size={14} className="text-[var(--tf-warning-text)]" />
              <p className="text-[12px] text-[var(--tf-warning-text)]">File Server nicht verbunden. Index nur lokal.</p>
            </div>
          )}
          <div className="flex gap-3">
            {running ? (
              <Button variant="danger" icon={Square} onClick={() => abortRef.current.abort()}>Abbrechen</Button>
            ) : (
              <>
                <Button variant="secondary" icon={Database} disabled={docCount === 0} onClick={() => runIndex(false)}>Aktualisieren</Button>
                <Button variant="secondary" icon={RefreshCw} disabled={docCount === 0} onClick={() => runIndex(true)}>Komplett neu</Button>
              </>
            )}
          </div>
          <IndexProgress status={status} running={running} />
          {indexResult && !running && (
            <div className="flex items-center gap-2 p-3 bg-[var(--tf-bg-secondary)] rounded-[var(--tf-radius)]">
              <CheckCircle2 size={14} className="text-[var(--tf-text)]" />
              <p className="text-[12px] text-[var(--tf-text)]">{indexResult.chunks} Chunks aus {indexResult.docs} Dokumenten — {indexResult.duration}</p>
            </div>
          )}
          {aborted && !running && (
            <div className="flex items-center gap-2 p-3 bg-[var(--tf-warning-bg)] rounded-[var(--tf-radius)]">
              <AlertCircle size={14} className="text-[var(--tf-warning-text)]" />
              <p className="text-[12px] text-[var(--tf-warning-text)]">Abgebrochen. {status?.processed ?? 0}/{status?.total ?? 0} Dokumente.</p>
            </div>
          )}
          {error && !running && (
            <div className="p-3 bg-[var(--tf-error-bg)] rounded-[var(--tf-radius)] space-y-2">
              <div className="flex items-center gap-2">
                <XCircle size={14} className="text-[var(--tf-error-text)]" />
                <p className="text-[12px] text-[var(--tf-error-text)]">{error}</p>
              </div>
              <Button variant="secondary" onClick={() => runIndex(true)}>Erneut versuchen</Button>
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* Section 3: Suchqualitaet */}
      <EvalSection chunkCount={chunkCount} modelId={activeModelId} />

      {/* Section 4: Modell & Konfiguration */}
      <CollapsibleSection label="Modell & Konfiguration" defaultOpen={false}
        subtitle={`${activeModel.label} \u00b7 ${activeModel.dimensions} Dim.`}>
        <div className="space-y-4">
          <Select label="Embedding-Modell"
            options={EMBEDDING_MODELS.map(m => ({ value: m.id, label: `${m.label} (${m.sizeLabel}, ${m.dimensions}d)` }))}
            value={activeModelId}
            onChange={async (e) => {
              const newId = e.target.value;
              setActiveModelIdState(newId);
              await setActiveModelId(storage.idb, newId);
            }} />
          <div className="space-y-2 text-[12px] text-[var(--tf-text-secondary)]">
            <Row label="Modell" value={activeModel.name} />
            <Row label="Dimensionen" value={String(activeModel.dimensions)} />
            <Row label="Download" value={activeModel.downloadSize} />
            <Row label="Backend" value={hasGPU ? 'WebGPU' : 'WASM'} />
            <Row label="Chunk-Groesse" value="200 Woerter, 50 Overlap" />
            {activeModel.queryPrefix && <Row label="Query-Prefix" value={activeModel.queryPrefix} />}
          </div>
          <p className="text-[11px] text-[var(--tf-text-tertiary)]">{activeModel.description}</p>
          {indexOutdated && (
            <div className="flex items-center gap-2 p-3 bg-[var(--tf-warning-bg)] rounded-[var(--tf-radius)]">
              <AlertCircle size={14} className="text-[var(--tf-warning-text)]" />
              <div>
                <p className="text-[12px] text-[var(--tf-warning-text)]">Index wurde mit einem anderen Modell erstellt.</p>
                <p className="text-[11px] text-[var(--tf-warning-text)] opacity-80">Bitte unter "Indexierung" komplett neu erstellen.</p>
              </div>
            </div>
          )}
        </div>
      </CollapsibleSection>
    </div>
  );
}

/* ─── Helpers ─── */

function SeedContent({ storage, seeded, seeding, seedProgress, setSeeded, setSeeding, setSeedProgress, setDocCount }: {
  storage: ReturnType<typeof useStorage>; seeded: boolean; seeding: boolean; seedProgress: string;
  setSeeded: (v: boolean) => void; setSeeding: (v: boolean) => void;
  setSeedProgress: (v: string) => void; setDocCount: (v: number) => void;
}): React.ReactElement {
  return (
    <div className="space-y-3">
      <p className="text-[12px] text-[var(--tf-text-secondary)]">
        Erzeugt 40 Vorgaenge, 60 Dokumente und 10 Artefakte mit realistischem Inhalt.
      </p>
      {seedProgress && <p className="text-[12px] text-[var(--tf-text-secondary)]">{seedProgress}</p>}
      <div className="flex gap-3">
        <Button variant="secondary" icon={Database} disabled={seeding || seeded}
          onClick={async () => {
            setSeeding(true); setSeedProgress('Erzeuge...');
            try {
              const r = await seedTestData(storage, (c, t) => setSeedProgress(`Erzeuge... (${c}/${t})`));
              setSeedProgress(`${r.vorgaenge} Vorgaenge, ${r.dokumente} Dokumente, ${r.artefakte} Artefakte`);
              setSeeded(true); storage.idb.keys('doc:').then(k => setDocCount(k.length));
            } catch (err) { setSeedProgress(`Fehler: ${err}`); }
            finally { setSeeding(false); }
          }}>
          {seeded ? 'Testdaten vorhanden' : seeding ? 'Erzeuge...' : 'Testdaten generieren'}
        </Button>
        {seeded && (
          <Button variant="danger" icon={Trash2} disabled={seeding}
            onClick={async () => {
              await clearSeedData(storage); setSeeded(false); setDocCount(0); setSeedProgress('Geloescht');
            }}>Testdaten loeschen</Button>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="flex justify-between">
      <span className="text-[var(--tf-text-tertiary)]">{label}</span>
      <span className="text-[var(--tf-text)]">{value}</span>
    </div>
  );
}

function IndexProgress({ status, running }: { status: IndexStatus | null; running: boolean }): React.ReactElement | null {
  if (!running || !status) return null;
  const isModelLoading = status.phase === 'Modell laden';
  const docProgress = status.total > 0 ? status.processed / status.total : 0;

  if (isModelLoading) {
    const modelPct = status.modelProgress?.loaded && status.modelProgress?.total
      ? status.modelProgress.loaded / status.modelProgress.total : 0;
    return (
      <div className="space-y-2">
        <div className="flex justify-between text-[12px] text-[var(--tf-text-secondary)]">
          <span>Modell laden...</span>
          {status.modelProgress?.status && <Badge variant="default">{status.modelProgress.status}</Badge>}
        </div>
        <ProgressBar value={modelPct} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-[12px] text-[var(--tf-text-secondary)]">
        <span>Dokument {status.processed + 1}/{status.total} — {status.currentDoc}</span>
        <span>{Math.round(docProgress * 100)}%</span>
      </div>
      <ProgressBar value={docProgress} />
      {status.chunkProgress && (
        <p className="text-[11px] text-[var(--tf-text-tertiary)]">Chunk {status.chunkProgress.current}/{status.chunkProgress.total}</p>
      )}
    </div>
  );
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes === 0) return `${secs}s`;
  return `${minutes}:${String(secs).padStart(2, '0')} min`;
}
