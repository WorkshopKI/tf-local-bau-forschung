import { useState, useEffect, useRef } from 'react';
import { Database, RefreshCw, AlertCircle, Trash2, Square, CheckCircle2, XCircle } from 'lucide-react';
import { Button, Badge, CollapsibleSection, ProgressBar, Select } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import { useNavigation } from '@/core/hooks/useNavigation';
import { BatchIndexer } from '@/core/services/search/batch-indexer';
import type { IndexStatus } from '@/core/services/search/batch-indexer';
import {
  EMBEDDING_MODELS, getModelById, getActiveModelId, setActiveModelId,
} from '@/core/services/search/model-registry';
import { seedTestData, clearSeedData } from '@/core/services/seed/seed-data';
import { EvalSection } from './eval/EvalSection';

export function IndexManager(): React.ReactElement {
  const storage = useStorage();
  const { navigate } = useNavigation();
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
  const [indexResult, setIndexResult] = useState<{ chunks: number; docs: number; skipped: number; duration: string } | null>(null);
  const [aborted, setAborted] = useState(false);
  const [activeModelId, setActiveModelIdState] = useState('minilm-l6-v2');
  const [indexModelId, setIndexModelId] = useState<string | null>(null);
  const [newDocsCount, setNewDocsCount] = useState(0);
  const [fsDocCount, setFsDocCount] = useState<{ newFiles: number; totalFiles: number } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const abortRef = useRef(new AbortController());
  const fsConnected = storage.isFileServerConnected();

  useEffect(() => {
    storage.idb.get<boolean>('seed-complete').then(v => setSeeded(!!v));
    storage.idb.get<string>('index-last-update').then(v => setLastUpdate(v));
    storage.idb.keys('doc:').then(k => setDocCount(k.length));
    storage.idb.get<number>('index-chunk-count').then(c => setChunkCount(c ?? 0));
    storage.idb.get<string>('index-model-id').then(v => setIndexModelId(v ?? null));
    getActiveModelId(storage.idb).then(setActiveModelIdState);
    // Neue Docs erkennen
    Promise.all([
      storage.idb.keys('doc:'),
      storage.idb.get<Record<string, string>>('index-manifest'),
    ]).then(([keys, manifest]) => {
      const m = manifest ?? {};
      const unindexed = keys.filter(k => !m[k.replace('doc:', '')]);
      setNewDocsCount(unindexed.length);
    });
    if ('gpu' in navigator) {
      (navigator as { gpu: { requestAdapter: () => Promise<unknown> } }).gpu
        .requestAdapter().then(a => setHasGPU(!!a)).catch(() => setHasGPU(false));
    }
    // Dokumentverzeichnisse scannen
    if (storage.getDocDirectories().length > 0) {
      import('@/core/services/search/document-scanner').then(({ countChangedDocuments }) =>
        countChangedDocuments(storage).then(setFsDocCount),
      ).catch(() => {});
    }
  }, [storage]);

  const activeModel = getModelById(activeModelId);
  const indexOutdated = indexModelId !== null && indexModelId !== activeModelId;

  // Ampel-Logik
  const ampel = (): { color: string; label: string } => {
    if (chunkCount === 0 || docCount === 0)
      return { color: 'bg-[var(--tf-danger-text)]', label: 'Kein Index vorhanden — bitte indexieren' };
    if (indexOutdated)
      return { color: 'bg-[var(--tf-warning-text)]', label: 'Modell gewechselt — Neu-Indexierung noetig' };
    if (fsDocCount && fsDocCount.newFiles > 0)
      return { color: 'bg-[var(--tf-warning-text)]', label: `${fsDocCount.newFiles} neue Dateien — Import noetig` };
    if (newDocsCount > 0)
      return { color: 'bg-[var(--tf-warning-text)]', label: `${newDocsCount} Dokumente nicht indexiert` };
    return { color: 'bg-[var(--tf-success-text)]', label: 'Index aktuell' };
  };
  const amp = ampel();

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
      setIndexModelId(activeModelId); setNewDocsCount(0);
      indexer.destroy();
      if (abortRef.current.signal.aborted) { setAborted(true); }
      else { setIndexResult({ chunks: count, docs: status?.total ?? 0, skipped: status?.skipped ?? 0, duration: formatDuration(elapsed) }); }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setAborted(true); setLastUpdate(new Date().toISOString());
      } else { setError(String(err)); console.error('Indexing failed:', err); }
    } finally { setRunning(false); }
  };

  const handleImportDocs = async (): Promise<void> => {
    setImporting(true); setImportResult(null);
    try {
      const { scanDocDirectories, importDocuments } = await import('@/core/services/search/document-scanner');
      const files = await scanDocDirectories(storage);
      const result = await importDocuments(storage, files);
      setImportResult(`${result.imported} importiert, ${result.updated} aktualisiert, ${result.unchanged} unveraendert`);
      storage.idb.keys('doc:').then(k => setDocCount(k.length));
      setFsDocCount({ newFiles: 0, totalFiles: files.length });
    } catch (err) { setImportResult(`Fehler: ${err}`); }
    finally { setImporting(false); }
  };

  const handleDownloadExamples = async (): Promise<void> => {
    const { downloadExampleDocs } = await import('@/core/services/search/example-docs');
    downloadExampleDocs();
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header mit Ampel */}
      <div className="mb-6">
        <h1 className="text-[22px] font-medium text-[var(--tf-text)]">Suchindex</h1>
        <div className="flex items-center gap-2 mt-1">
          <span className={`w-2 h-2 rounded-full ${amp.color}`} />
          <p className="text-[13px] text-[var(--tf-text-secondary)]">{amp.label}</p>
        </div>
        {chunkCount > 0 && (
          <p className="text-[12px] text-[var(--tf-text-tertiary)] mt-0.5">
            {docCount} Dokumente · {chunkCount} Textabschnitte{lastUpdate ? ` · ${new Date(lastUpdate).toLocaleDateString('de-DE')}` : ''}
          </p>
        )}
      </div>

      {/* 1. Embedding-Modell */}
      <CollapsibleSection label="Embedding-Modell" defaultOpen={indexOutdated || chunkCount === 0}
        subtitle={activeModel.label}>
        <div className="space-y-3">
          <Select label="Modell"
            options={EMBEDDING_MODELS.map(m => ({ value: m.id, label: `${m.label} — ${m.description}` }))}
            value={activeModelId}
            onChange={async (e) => {
              const newId = e.target.value;
              setActiveModelIdState(newId);
              await setActiveModelId(storage.idb, newId);
            }} />
          <p className="text-[11px] text-[var(--tf-text-tertiary)]">
            {activeModel.sizeLabel} Parameter · {activeModel.dimensions} Dimensionen · {activeModel.downloadSize} Download · {hasGPU ? 'WebGPU' : 'CPU'}
          </p>
          {indexOutdated && (
            <div className="flex items-center justify-between p-3 bg-[var(--tf-warning-bg)] rounded-[var(--tf-radius)]">
              <div className="flex items-center gap-2">
                <AlertCircle size={14} className="text-[var(--tf-warning-text)]" />
                <p className="text-[12px] text-[var(--tf-warning-text)]">Modell gewechselt — Index muss neu erstellt werden.</p>
              </div>
              <Button variant="secondary" size="sm" disabled={running} onClick={() => runIndex(true)}>Jetzt neu indexieren</Button>
            </div>
          )}
          <details className="text-[11px] text-[var(--tf-text-tertiary)]">
            <summary className="cursor-pointer hover:text-[var(--tf-text-secondary)]">Technische Details</summary>
            <div className="mt-2 space-y-1 pl-3">
              <Row label="HuggingFace ID" value={activeModel.name} />
              <Row label="Dimensionen" value={String(activeModel.dimensions)} />
              <Row label="Chunk-Groesse" value="200 Woerter, 50 Overlap" />
              {activeModel.queryPrefix && <Row label="Query-Prefix" value={activeModel.queryPrefix} />}
              {activeModel.documentPrefix && <Row label="Document-Prefix" value={activeModel.documentPrefix} />}
              <Row label="Backend" value={hasGPU ? 'WebGPU' : 'WASM (CPU)'} />
            </div>
          </details>
        </div>
      </CollapsibleSection>

      {/* 2. Indexierung */}
      <CollapsibleSection label="Indexierung" defaultOpen={true}
        subtitle={chunkCount > 0 ? `${chunkCount} Textabschnitte${lastUpdate ? ` · ${new Date(lastUpdate).toLocaleDateString('de-DE')}` : ''}` : 'Nicht indexiert'}>
        <div className="space-y-3">
          {/* Dateien aus Verzeichnis importieren */}
          {fsDocCount && fsDocCount.newFiles > 0 && !running && !importing && (
            <div className="flex items-center justify-between p-3 bg-[var(--tf-info-bg)] rounded-[var(--tf-radius)]">
              <div className="flex items-center gap-2">
                <AlertCircle size={14} className="text-[var(--tf-info-text)]" />
                <p className="text-[12px] text-[var(--tf-info-text)]">{fsDocCount.newFiles} neue Dateien in Dokumentverzeichnissen.</p>
              </div>
              <Button variant="secondary" size="sm" onClick={handleImportDocs}>Importieren</Button>
            </div>
          )}
          {importResult && (
            <p className="text-[11px] text-[var(--tf-text-tertiary)]">{importResult}</p>
          )}
          {newDocsCount > 0 && !running && (
            <div className="flex items-center justify-between p-3 bg-[var(--tf-info-bg)] rounded-[var(--tf-radius)]">
              <div className="flex items-center gap-2">
                <AlertCircle size={14} className="text-[var(--tf-info-text)]" />
                <p className="text-[12px] text-[var(--tf-info-text)]">{newDocsCount} Dokumente nicht indexiert.</p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => runIndex(false)}>Jetzt aktualisieren</Button>
            </div>
          )}
          {!fsConnected && (
            <div className="flex items-center justify-between p-3 bg-[var(--tf-warning-bg)] rounded-[var(--tf-radius)]">
              <div className="flex items-center gap-2">
                <AlertCircle size={14} className="text-[var(--tf-warning-text)]" />
                <p className="text-[12px] text-[var(--tf-warning-text)]">Kein Datenverzeichnis verbunden. Index wird nur lokal gespeichert.</p>
              </div>
              <button onClick={() => navigate('einstellungen')}
                className="text-[12px] text-[var(--tf-warning-text)] underline cursor-pointer shrink-0">Verzeichnis verbinden</button>
            </div>
          )}
          {!running ? (
            <div className="flex gap-3">
              <Button variant="secondary" icon={Database} disabled={docCount === 0} onClick={() => runIndex(false)}>Neue Dokumente indexieren</Button>
              <Button variant="secondary" icon={RefreshCw} disabled={docCount === 0} onClick={() => runIndex(true)}>Alles neu aufbauen</Button>
            </div>
          ) : (
            <Button variant="danger" icon={Square} onClick={() => abortRef.current.abort()}>Abbrechen</Button>
          )}
          {!running && docCount > 0 && newDocsCount === 0 && chunkCount > 0 && (
            <p className="text-[11px] text-[var(--tf-text-tertiary)]">
              &quot;Neue Dokumente indexieren&quot; fuegt nur neue oder geaenderte Dokumente hinzu. &quot;Alles neu aufbauen&quot; erstellt den gesamten Index von Grund auf.
            </p>
          )}
          {!running && (
            <button onClick={handleDownloadExamples}
              className="text-[11px] text-[var(--tf-text-tertiary)] underline cursor-pointer hover:text-[var(--tf-text-secondary)]">
              Beispieldokumente herunterladen
            </button>
          )}
          <IndexProgress status={status} running={running} />
          {indexResult && !running && (
            <div className="flex items-center gap-2 p-3 bg-[var(--tf-bg-secondary)] rounded-[var(--tf-radius)]">
              <CheckCircle2 size={14} className="text-[var(--tf-text)]" />
              <p className="text-[12px] text-[var(--tf-text)]">
                {indexResult.skipped === indexResult.docs
                  ? 'Keine neuen Dokumente. Index ist aktuell.'
                  : indexResult.skipped > 0
                    ? `${indexResult.chunks} Textabschnitte (${indexResult.docs - indexResult.skipped} neue Dokumente, ${indexResult.skipped} uebersprungen) — ${indexResult.duration}`
                    : `${indexResult.chunks} Textabschnitte aus ${indexResult.docs} Dokumenten — ${indexResult.duration}`}
              </p>
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

      {/* 3. Suchqualitaet */}
      <EvalSection chunkCount={chunkCount} modelId={activeModelId} />

      {/* 4. Testdaten (unten, kompakt) */}
      <CollapsibleSection label="Testdaten" defaultOpen={!seeded && docCount === 0}
        subtitle={seeded ? '40 Vorgaenge · 60 Dokumente' : 'Nicht vorhanden'}>
        <SeedContent storage={storage} seeded={seeded} seeding={seeding} seedProgress={seedProgress}
          setSeeded={setSeeded} setSeeding={setSeeding} setSeedProgress={setSeedProgress} setDocCount={setDocCount} />
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
  const lastChunkRef = useRef('');
  if (!running || !status) return null;
  const isModelLoading = status.phase === 'Modell laden';
  const docProgress = status.total > 0 ? status.processed / status.total : 0;
  if (status.phase === 'Embedding' && status.chunkProgress) {
    lastChunkRef.current = `Textabschnitt ${status.chunkProgress.current} von ${status.chunkProgress.total}`;
  }

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
      <p className="text-[11px] text-[var(--tf-text-tertiary)] h-4">
        {lastChunkRef.current || '\u00a0'}
      </p>
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
