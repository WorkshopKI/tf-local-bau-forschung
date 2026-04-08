import { useState, useEffect, useRef } from 'react';
import { Database, RefreshCw, AlertCircle, Square, CheckCircle2, XCircle } from 'lucide-react';
import { Button, Select } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import { BatchIndexer } from '@/core/services/search/batch-indexer';
import type { IndexStatus, PipelineConfig } from '@/core/services/search/batch-indexer';
import {
  EMBEDDING_MODELS, getModelById, setActiveModelId,
} from '@/core/services/search/model-registry';
import { METADATA_LLM_MODELS } from '@/core/services/search/metadata-extractor';
import { loadCheckpoint } from '@/core/services/search/checkpoint';
import { listAvailableModels } from '@/core/services/search/model-loader';
import { IndexProgress, Row, formatDuration } from '../IndexHelpers';

interface IndexStepProps {
  activeModelId: string;
  setActiveModelIdState: (id: string) => void;
  setIndexModelId: (id: string | null) => void;
  setChunkCount: (n: number) => void;
  docCount: number;
  setLastUpdate: (s: string | null) => void;
  indexOutdated: boolean;
  setNewDocsCount: (n: number) => void;
  hasGPU: boolean;
}

export function IndexStep({
  activeModelId, setActiveModelIdState, setIndexModelId,
  setChunkCount, docCount, setLastUpdate, indexOutdated, setNewDocsCount, hasGPU,
}: IndexStepProps): React.ReactElement {
  const storage = useStorage();
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<IndexStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [indexResult, setIndexResult] = useState<{ chunks: number; docs: number; skipped: number; duration: string } | null>(null);
  const [aborted, setAborted] = useState(false);
  const [metadataLLMId, setMetadataLLMId] = useState('none');
  const [useContextualPrefixes, setUseContextualPrefixes] = useState(false);
  const [useReRanker, setUseReRanker] = useState(false);
  const [hasCheckpoint, setHasCheckpoint] = useState(false);
  const [checkpointProgress, setCheckpointProgress] = useState(0);
  const [checkpointTotal, setCheckpointTotal] = useState(0);
  const [hasModelDir, setHasModelDir] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const abortRef = useRef(new AbortController());

  useEffect(() => {
    loadCheckpoint(storage).then(cp => {
      if (cp) {
        setHasCheckpoint(true);
        setCheckpointProgress(cp.processedDocIds.length);
        setCheckpointTotal(cp.totalDocs);
      }
    }).catch(() => {});
    const modelStore = storage.getModelDirectoryStore();
    setHasModelDir(!!modelStore);
    if (modelStore) {
      listAvailableModels(storage).then(setAvailableModels).catch(() => {});
    }
  }, []);

  const activeModel = getModelById(activeModelId);

  const runIndex = async (full: boolean, resume = false): Promise<void> => {
    setRunning(true); setStatus(null); setError(null); setIndexResult(null); setAborted(false);
    abortRef.current = new AbortController();
    const startTime = Date.now();
    try {
      if (full) await storage.idb.delete('index-manifest');
      const indexer = new BatchIndexer();
      const model = getModelById(activeModelId);
      await indexer.init(model, hasGPU, setStatus);
      const pipelineConfig: PipelineConfig = {
        embeddingModelId: activeModelId,
        metadataLLMId: metadataLLMId !== 'none' ? metadataLLMId : null,
        useContextualPrefixes,
        useReRanker,
        resumeFromCheckpoint: resume || !full,
      };
      const count = await indexer.indexAll(storage, pipelineConfig, setStatus, abortRef.current.signal);
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

  return (
    <div className="space-y-3">
        {/* Modell-Auswahl */}
        <Select label="Embedding-Modell"
          options={EMBEDDING_MODELS.map(m => ({ value: m.id, label: `${m.label} — ${m.description}` }))}
          value={activeModelId}
          onChange={async (e) => {
            const newId = e.target.value;
            setActiveModelIdState(newId);
            await setActiveModelId(storage.idb, newId);
          }} />
        <p className="text-[11px] text-[var(--tf-text-tertiary)]">
          {activeModel.sizeLabel} · {activeModel.useMRL && activeModel.mrlDimensions ? activeModel.mrlDimensions : activeModel.dimensions} Dim.{activeModel.useMRL ? ' (MRL)' : ''} · {activeModel.downloadSize} · {hasGPU ? 'WebGPU' : 'CPU'}
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
            <Row label="Dimensionen" value={String(activeModel.useMRL && activeModel.mrlDimensions ? `${activeModel.mrlDimensions} (MRL von ${activeModel.dimensions})` : activeModel.dimensions)} />
            <Row label="Chunk-Groesse" value="200 Woerter, 50 Overlap" />
            {activeModel.queryPrefix && <Row label="Query-Prefix" value={activeModel.queryPrefix} />}
            {activeModel.documentPrefix && <Row label="Document-Prefix" value={activeModel.documentPrefix} />}
            <Row label="Backend" value={hasGPU ? 'WebGPU' : 'WASM (CPU)'} />
          </div>
        </details>

        <details className="text-[12px] text-[var(--tf-text-secondary)]">
          <summary className="cursor-pointer hover:text-[var(--tf-text)] font-medium">Pipeline konfigurieren</summary>
          <div className="mt-3 space-y-3 pl-3" style={{ borderLeft: '2px solid var(--tf-border)' }}>
            <Select label="Embedding-Modell"
              options={EMBEDDING_MODELS.map(m => ({
                value: m.id,
                label: `${m.label} (${m.sizeLabel}${m.useMRL ? ', MRL' : ''})`,
              }))}
              value={activeModelId}
              onChange={async (e) => {
                const newId = e.target.value;
                setActiveModelIdState(newId);
                await setActiveModelId(storage.idb, newId);
              }} />
            <Select label="Metadata-Extraktion (LLM)"
              options={METADATA_LLM_MODELS.map(m => ({
                value: m.id,
                label: `${m.label} — ${m.size}`,
              }))}
              value={metadataLLMId}
              onChange={e => setMetadataLLMId(e.target.value)} />
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={useContextualPrefixes}
                onChange={e => setUseContextualPrefixes(e.target.checked)} />
              <span>Kontextuelle Chunk-Prefixes (verbessert Embedding-Qualitaet)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={useReRanker}
                onChange={e => setUseReRanker(e.target.checked)} />
              <span>Cross-Encoder Re-Ranker (ms-marco-MiniLM, ~500ms extra pro Suche)</span>
            </label>
            {hasCheckpoint && (
              <div className="flex items-center justify-between p-2 bg-[var(--tf-bg-secondary)] rounded-[var(--tf-radius)]">
                <span className="text-[var(--tf-text-secondary)]">
                  Unterbrochene Indexierung: {checkpointProgress}/{checkpointTotal} Dokumente
                </span>
                <Button variant="secondary" size="sm" onClick={() => runIndex(false, true)}>Fortsetzen</Button>
              </div>
            )}
            {!hasModelDir && (
              <div className="p-3 bg-[var(--tf-bg-secondary)] rounded-[var(--tf-radius)] text-[12px] text-[var(--tf-text-secondary)]">
                <p className="font-medium mb-1">Modelle werden direkt von HuggingFace geladen.</p>
                <p>Fuer Offline-Betrieb: Verbinden Sie ein Modellverzeichnis (Schritt 1) und fuehren Sie das Download-Script aus:</p>
                <code className="block mt-1 p-2 bg-[var(--tf-bg)] rounded text-[11px] font-mono">
                  ./scripts/download-models.sh /pfad/zum/modell-verzeichnis
                </code>
              </div>
            )}
            {hasModelDir && availableModels.length > 0 && (
              <p className="text-[11px] text-[var(--tf-text-tertiary)]">
                {availableModels.length} Modelle im Verzeichnis: {availableModels.join(', ')}
              </p>
            )}
            {hasModelDir && availableModels.length === 0 && (
              <div className="p-3 bg-[var(--tf-warning-bg)] rounded-[var(--tf-radius)] text-[12px] text-[var(--tf-warning-text)]">
                Modellverzeichnis verbunden, aber keine Modelle gefunden.
                Fuehren Sie das Download-Script aus oder laden Sie Modelle manuell herunter.
              </div>
            )}
          </div>
        </details>

        {/* Indexierungs-Buttons */}
        {!running ? (
          <div className="flex gap-3">
            <Button variant="secondary" icon={Database} disabled={docCount === 0} onClick={() => runIndex(false)}>Neue Dokumente indexieren</Button>
            <Button variant="secondary" icon={RefreshCw} disabled={docCount === 0} onClick={() => runIndex(true)}>Alles neu aufbauen</Button>
          </div>
        ) : (
          <Button variant="danger" icon={Square} onClick={() => abortRef.current.abort()}>Abbrechen</Button>
        )}

        <IndexProgress status={status} running={running} />

        {indexResult && !running && (
          <div className="flex items-center gap-2 p-3 bg-[var(--tf-bg-secondary)] rounded-[var(--tf-radius)]">
            <CheckCircle2 size={14} className="text-[var(--tf-text)]" />
            <p className="text-[12px] text-[var(--tf-text)]">
              {indexResult.skipped === indexResult.docs
                ? 'Keine neuen Dokumente. Index ist aktuell.'
                : indexResult.skipped > 0
                  ? `${indexResult.chunks} Textabschnitte (${indexResult.docs - indexResult.skipped} neue, ${indexResult.skipped} uebersprungen) — ${indexResult.duration}`
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
  );
}
