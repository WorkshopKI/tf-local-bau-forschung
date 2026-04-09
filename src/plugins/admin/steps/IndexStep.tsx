import { useState, useEffect, useRef } from 'react';
import { Database, RefreshCw, AlertCircle, Square, CheckCircle2, XCircle } from 'lucide-react';
import { Button, Select } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import { BatchIndexer } from '@/core/services/search/batch-indexer';
import type { IndexStatus, PipelineConfig, ChunkStrategy } from '@/core/services/search/batch-indexer';
import {
  EMBEDDING_MODELS, getModelById, setActiveModelId,
} from '@/core/services/search/model-registry';
import { METADATA_LLM_MODELS } from '@/core/services/search/metadata-extractor';
import { RERANKER_MODELS, DEFAULT_RERANKER_ID } from '@/core/services/search/re-ranker';
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
  const [reRankerModelId, setReRankerModelId] = useState(DEFAULT_RERANKER_ID);
  const [chunkStrategy, setChunkStrategy] = useState<ChunkStrategy>('fixed-200');
  const [hasCheckpoint, setHasCheckpoint] = useState(false);
  const [checkpointProgress, setCheckpointProgress] = useState(0);
  const [checkpointTotal, setCheckpointTotal] = useState(0);
  const [hasModelDir, setHasModelDir] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [indexedPrefixes, setIndexedPrefixes] = useState<boolean | null>(null);
  const [indexedStrategy, setIndexedStrategy] = useState<ChunkStrategy | null>(null);
  const abortRef = useRef(new AbortController());

  interface PipelineCfg { metadataLLMId: string; useContextualPrefixes: boolean; useReRanker: boolean; reRankerModelId: string; chunkStrategy: ChunkStrategy }
  const savePipeline = (patch: Partial<PipelineCfg>): void => {
    const cfg: PipelineCfg = { metadataLLMId, useContextualPrefixes, useReRanker, reRankerModelId, chunkStrategy, ...patch };
    storage.idb.set('pipeline-config', cfg);
  };

  useEffect(() => {
    storage.idb.get<PipelineCfg>('pipeline-config').then(cfg => {
      if (cfg) {
        setMetadataLLMId(cfg.metadataLLMId);
        setUseContextualPrefixes(cfg.useContextualPrefixes);
        setUseReRanker(cfg.useReRanker);
        if (cfg.reRankerModelId) setReRankerModelId(cfg.reRankerModelId);
        if (cfg.chunkStrategy) setChunkStrategy(cfg.chunkStrategy);
      }
    });
    storage.idb.get<{ contextualPrefixes?: boolean; chunkStrategy?: ChunkStrategy }>('index-pipeline-config').then(c => {
      if (c) {
        setIndexedPrefixes(c.contextualPrefixes ?? false);
        if (c.chunkStrategy) setIndexedStrategy(c.chunkStrategy);
      }
    });
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
        chunkStrategy,
      };
      const count = await indexer.indexAll(storage, pipelineConfig, setStatus, abortRef.current.signal);
      const elapsed = Date.now() - startTime;
      setChunkCount(count); setLastUpdate(new Date().toISOString());
      setIndexModelId(activeModelId); setNewDocsCount(0);
      await storage.idb.set('index-pipeline-config', { contextualPrefixes: useContextualPrefixes, chunkStrategy });
      setIndexedPrefixes(useContextualPrefixes);
      setIndexedStrategy(chunkStrategy);
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
      {/* Modell-Info (nur Text, kein Dropdown) */}
      <p className="text-[13px] text-[var(--tf-text)]">
        {activeModel.label} · {activeModel.sizeLabel} · {activeModel.useMRL && activeModel.mrlDimensions ? activeModel.mrlDimensions : activeModel.dimensions} Dim. · {hasGPU ? 'WebGPU' : 'CPU'}
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

      {((indexedPrefixes !== null && indexedPrefixes !== useContextualPrefixes) || (indexedStrategy !== null && indexedStrategy !== chunkStrategy)) && !running && (
        <div className="flex items-center justify-between p-3 bg-[var(--tf-warning-bg)] rounded-[var(--tf-radius)]">
          <div className="flex items-center gap-2">
            <AlertCircle size={14} className="text-[var(--tf-warning-text)]" />
            <p className="text-[12px] text-[var(--tf-warning-text)]">Einstellungen geändert — &quot;Alle Dokumente indizieren&quot; nötig damit die Änderungen wirken.</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => runIndex(true)}>Jetzt indizieren</Button>
        </div>
      )}

      {/* Erweiterte Einstellungen (merged: Pipeline + Technische Details) */}
      <details className="text-[11px] text-[var(--tf-text-tertiary)]">
        <summary className="cursor-pointer hover:text-[var(--tf-text-secondary)]">Erweiterte Einstellungen</summary>
        <div className="mt-3 space-y-4 p-3 bg-[var(--tf-bg-secondary)] rounded-[var(--tf-radius)]">
          <div>
            <p className="text-[12px] font-medium text-[var(--tf-text)] mb-1">Embedding-Modell</p>
            <Select
              options={EMBEDDING_MODELS.map(m => ({ value: m.id, label: `${m.label} — ${m.description}` }))}
              value={activeModelId}
              onChange={async (e) => {
                const newId = e.target.value;
                setActiveModelIdState(newId);
                await setActiveModelId(storage.idb, newId);
              }} />
            <p className="text-[11px] text-[var(--tf-text-tertiary)] mt-1">
              {activeModel.dimensions} Dimensionen · {activeModel.downloadSize}
            </p>
          </div>

          <div>
            <p className="text-[12px] font-medium text-[var(--tf-text)] mb-1">Chunking-Strategie</p>
            <Select
              options={[
                { value: 'fixed-200', label: 'Fixed 200 Wörter — Baseline' },
                { value: 'fixed-400', label: 'Fixed 400 Wörter — mehr Kontext' },
                { value: 'heading', label: 'Heading-basiert — nutzt Dokumentstruktur (empfohlen)' },
              ]}
              value={chunkStrategy}
              onChange={e => { setChunkStrategy(e.target.value as ChunkStrategy); savePipeline({ chunkStrategy: e.target.value as ChunkStrategy }); }} />
            <span className="text-[11px] text-[var(--tf-text-tertiary)]">erfordert Neu-Indexierung</span>
          </div>

          <div>
            <p className="text-[12px] font-medium text-[var(--tf-text)] mb-1">Metadata-Extraktion (LLM)</p>
            <Select
              options={METADATA_LLM_MODELS.map(m => ({ value: m.id, label: `${m.label} — ${m.size}` }))}
              value={metadataLLMId}
              onChange={e => { setMetadataLLMId(e.target.value); savePipeline({ metadataLLMId: e.target.value }); }} />
          </div>

          <label className="flex items-center gap-2 text-[12px] text-[var(--tf-text)] cursor-pointer">
            <input type="checkbox" checked={useContextualPrefixes}
              onChange={e => { setUseContextualPrefixes(e.target.checked); savePipeline({ useContextualPrefixes: e.target.checked }); }} />
            Kontextuelle Chunk-Prefixes
            <span className="text-[11px] text-[var(--tf-text-tertiary)]">— erfordert Neu-Indexierung</span>
          </label>
          <label className="flex items-center gap-2 text-[12px] text-[var(--tf-text)] cursor-pointer">
            <input type="checkbox" checked={useReRanker}
              onChange={e => { setUseReRanker(e.target.checked); savePipeline({ useReRanker: e.target.checked }); }} />
            Cross-Encoder Re-Ranker
            <span className="text-[11px] text-[var(--tf-text-tertiary)]">— wirkt sofort, kein Reindexing</span>
          </label>
          {useReRanker && (
            <div className="ml-6 space-y-1">
              <Select
                options={RERANKER_MODELS.map(m => ({ value: m.id, label: `${m.label} — ${m.sizeHint}` }))}
                value={reRankerModelId}
                onChange={e => { setReRankerModelId(e.target.value); savePipeline({ reRankerModelId: e.target.value }); }} />
              <p className="text-[11px] text-[var(--tf-text-tertiary)]">
                Fuegt ~500ms–2000ms Latenz pro Suche hinzu. Empfohlen nur wenn Suchergebnisse ohne Re-Ranker nicht ausreichen.
              </p>
            </div>
          )}

          {hasCheckpoint && (
            <div className="flex items-center justify-between p-2 bg-[var(--tf-bg)] rounded-[var(--tf-radius)]">
              <span className="text-[12px] text-[var(--tf-text-secondary)]">
                Unterbrochene Indexierung: {checkpointProgress}/{checkpointTotal} Dokumente
              </span>
              <Button variant="secondary" size="sm" onClick={() => runIndex(false, true)}>Fortsetzen</Button>
            </div>
          )}

          {!hasModelDir && metadataLLMId !== 'none' && (
            <p className="text-[11px] text-[var(--tf-text-tertiary)]">
              Modelle werden von HuggingFace geladen. Offline: <code className="text-[10px]">./scripts/download-models.sh</code>
            </p>
          )}
          {hasModelDir && availableModels.length > 0 && (
            <p className="text-[11px] text-[var(--tf-text-tertiary)]">
              {availableModels.length} Modelle im Verzeichnis: {availableModels.join(', ')}
            </p>
          )}
          {hasModelDir && availableModels.length === 0 && (
            <p className="text-[11px] text-[var(--tf-warning-text)]">
              Modellverzeichnis verbunden, aber keine Modelle gefunden.
            </p>
          )}

          {/* Technische Details (flach, nicht nochmal aufklappbar) */}
          <div className="pt-3" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
            <p className="text-[11px] text-[var(--tf-text-tertiary)] mb-1">Technische Details</p>
            <Row label="HuggingFace ID" value={activeModel.name} />
            <Row label="Chunking" value={chunkStrategy === 'heading' ? 'Heading-basiert (Fallback: 400W, 75 Overlap)' : chunkStrategy === 'fixed-400' ? '400 Woerter, 75 Overlap' : '200 Woerter, 50 Overlap'} />
            {activeModel.queryPrefix && <Row label="Query-Prefix" value={activeModel.queryPrefix} />}
            {activeModel.documentPrefix && <Row label="Document-Prefix" value={activeModel.documentPrefix} />}
            <Row label="Backend" value={hasGPU ? 'WebGPU' : 'WASM (CPU)'} />
          </div>
        </div>
      </details>

      {/* Indexierungs-Buttons */}
      {!running ? (
        <div className="flex gap-3">
          <Button variant="secondary" icon={Database} disabled={docCount === 0} onClick={() => runIndex(false)}>Neue Dokumente indexieren</Button>
          <Button variant="secondary" icon={RefreshCw} disabled={docCount === 0} onClick={() => runIndex(true)}>Alle Dokumente indizieren</Button>
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
