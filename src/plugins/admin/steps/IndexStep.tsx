import { useState, useEffect, useRef } from 'react';
import { Database, RefreshCw, AlertCircle, Square, CheckCircle2, XCircle } from 'lucide-react';
import { Button, Select } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import { BatchIndexer } from '@/core/services/search/batch-indexer';
import type { IndexStatus, PipelineConfig } from '@/core/services/search/batch-indexer';
import {
  EMBEDDING_MODELS, getModelById, setActiveModelId,
} from '@/core/services/search/model-registry';
import { METADATA_LLM_MODELS, clearMetadataCache } from '@/core/services/search/metadata-extractor';
import type { AIProviderConfig } from '@/core/types/config';
import { RERANKER_MODELS, DEFAULT_RERANKER_ID } from '@/core/services/search/re-ranker';
import { useSearch } from '@/core/hooks/useSearch';
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
  const { toggleReRanker } = useSearch();
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<IndexStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [indexResult, setIndexResult] = useState<{ chunks: number; docs: number; skipped: number; duration: string } | null>(null);
  const [aborted, setAborted] = useState(false);
  const [metadataLLMId, setMetadataLLMId] = useState('none');
  const [useContextualPrefixes, setUseContextualPrefixes] = useState(false);
  const [useReRanker, setUseReRanker] = useState(false);
  const [reRankerModelId, setReRankerModelId] = useState(DEFAULT_RERANKER_ID);
  const [hasCheckpoint, setHasCheckpoint] = useState(false);
  const [checkpointProgress, setCheckpointProgress] = useState(0);
  const [checkpointTotal, setCheckpointTotal] = useState(0);
  const [hasModelDir, setHasModelDir] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [indexedPrefixes, setIndexedPrefixes] = useState<boolean | null>(null);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [metadataParallelism, setMetadataParallelism] = useState(3);
  const [metadataContext, setMetadataContext] = useState(4096);
  const [metadataPreferGPU, setMetadataPreferGPU] = useState(true);
  const [cacheMsg, setCacheMsg] = useState<string | null>(null);
  const abortRef = useRef(new AbortController());

  interface PipelineCfg { metadataLLMId: string; metadataParallelism: number; metadataContext: number; metadataPreferGPU: boolean; useContextualPrefixes: boolean; useReRanker: boolean; reRankerModelId: string }
  const savePipeline = (patch: Partial<PipelineCfg>): void => {
    const cfg: PipelineCfg = { metadataLLMId, metadataParallelism, metadataContext, metadataPreferGPU, useContextualPrefixes, useReRanker, reRankerModelId, ...patch };
    storage.idb.set('pipeline-config', cfg);
  };

  useEffect(() => {
    storage.idb.get<PipelineCfg>('pipeline-config').then(cfg => {
      if (cfg) {
        setMetadataLLMId(cfg.metadataLLMId);
        if (cfg.metadataParallelism) setMetadataParallelism(cfg.metadataParallelism);
        if (cfg.metadataContext) setMetadataContext(cfg.metadataContext);
        if (cfg.metadataPreferGPU !== undefined) setMetadataPreferGPU(cfg.metadataPreferGPU);
        setUseContextualPrefixes(cfg.useContextualPrefixes);
        setUseReRanker(cfg.useReRanker);
        if (cfg.reRankerModelId) setReRankerModelId(cfg.reRankerModelId);
      }
    });
    storage.idb.get<{ contextualPrefixes?: boolean }>('index-pipeline-config').then(c => {
      if (c) {
        setIndexedPrefixes(c.contextualPrefixes ?? false);
      }
    });
    storage.idb.get<AIProviderConfig>('ai-provider').then(c => {
      setHasApiKey(!!c?.apiKey);
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
        metadataParallelism,
        metadataContext,
        metadataPreferGPU,
        useContextualPrefixes,
        useReRanker,
        resumeFromCheckpoint: resume || !full,
      };
      const count = await indexer.indexAll(storage, pipelineConfig, setStatus, abortRef.current.signal);
      const elapsed = Date.now() - startTime;
      setChunkCount(count); setLastUpdate(new Date().toISOString());
      setIndexModelId(activeModelId); setNewDocsCount(0);
      await storage.idb.set('index-pipeline-config', { contextualPrefixes: useContextualPrefixes });
      setIndexedPrefixes(useContextualPrefixes);
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

      {(indexedPrefixes !== null && indexedPrefixes !== useContextualPrefixes) && !running && (
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

          <div className="space-y-2">
            <p className="text-[12px] font-medium text-[var(--tf-text)] mb-1">Metadata-Extraktion (LLM)</p>
            <Select
              options={METADATA_LLM_MODELS.map(m => ({ value: m.id, label: m.label }))}
              value={metadataLLMId}
              onChange={e => { setMetadataLLMId(e.target.value); savePipeline({ metadataLLMId: e.target.value }); }} />
            {(() => {
              const selectedModel = METADATA_LLM_MODELS.find(m => m.id === metadataLLMId);
              const isApi = selectedModel && metadataLLMId !== 'none';
              return metadataLLMId !== 'none' ? (
                <>
                  {isApi && !hasApiKey && !selectedModel.openRouterId.startsWith('local') && (
                    <p className="text-[11px] text-[var(--tf-warning-text)]">
                      API Key erforderlich — bitte unter Einstellungen → KI-Assistent konfigurieren.
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <label className="text-[12px] text-[var(--tf-text)]">Kontext-Tokens:</label>
                    <select value={metadataContext} onChange={e => {
                      const v = parseInt(e.target.value);
                      setMetadataContext(v); savePipeline({ metadataContext: v });
                    }}
                      className="px-2 py-1 text-[12px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none"
                      style={{ border: '0.5px solid var(--tf-border)' }}>
                      <option value={4096}>4K (schnell, wenig VRAM)</option>
                      <option value={8192}>8K (Standard)</option>
                      <option value={16384}>16K (grosse Dokumente)</option>
                      <option value={32768}>32K (voller Kontext)</option>
                    </select>
                  </div>
                  {isApi && (
                    <div className="flex items-center gap-2">
                      <label className="text-[12px] text-[var(--tf-text)]">Parallele API-Calls:</label>
                      <input type="number" min={1} max={10} value={metadataParallelism}
                        onChange={e => {
                          const v = Math.max(1, Math.min(10, parseInt(e.target.value) || 3));
                          setMetadataParallelism(v); savePipeline({ metadataParallelism: v });
                        }}
                        className="w-16 px-2 py-1 text-[12px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none"
                        style={{ border: '0.5px solid var(--tf-border)' }} />
                      <span className="text-[11px] text-[var(--tf-text-tertiary)]">(3-5 empfohlen)</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={async () => {
                      const count = await clearMetadataCache(storage);
                      setCacheMsg(`${count} Einträge gelöscht`);
                      setTimeout(() => setCacheMsg(null), 3000);
                    }}>Metadata-Cache leeren</Button>
                    {cacheMsg && <span className="text-[11px] text-[var(--tf-text-secondary)]">{cacheMsg}</span>}
                  </div>
                </>
              ) : null;
            })()}
          </div>

          <label className="flex items-center gap-2 text-[12px] text-[var(--tf-text)] cursor-pointer">
            <input type="checkbox" checked={useContextualPrefixes}
              onChange={e => { setUseContextualPrefixes(e.target.checked); savePipeline({ useContextualPrefixes: e.target.checked }); }} />
            Kontextuelle Chunk-Prefixes
            <span className="text-[11px] text-[var(--tf-text-tertiary)]">— erfordert Neu-Indexierung</span>
          </label>
          <label className="flex items-center gap-2 text-[12px] text-[var(--tf-text)] cursor-pointer">
            <input type="checkbox" checked={useReRanker}
              onChange={async e => {
                const enabled = e.target.checked;
                setUseReRanker(enabled);
                savePipeline({ useReRanker: enabled });
                await toggleReRanker(enabled, reRankerModelId);
              }} />
            Cross-Encoder Re-Ranker (Experimentell)
            <span className="text-[11px] text-[var(--tf-text-tertiary)]">— Experimentell — sehr langsam (3+ Min/Suche). Kein geeignetes Modell fuer schnelle Browser-Inferenz verfuegbar.</span>
          </label>
          {useReRanker && (
            <div className="ml-6 space-y-1">
              <div className="p-2 bg-[var(--tf-warning-bg)] rounded-[var(--tf-radius)] text-[11px] text-[var(--tf-warning-text)]">
                Re-Ranking dauert mehrere Minuten pro Suche. Nur fuer Testzwecke empfohlen.
              </div>
              <Select
                options={RERANKER_MODELS.map(m => ({ value: m.id, label: `${m.label} — ${m.sizeHint}` }))}
                value={reRankerModelId}
                onChange={async e => {
                  const newModelId = e.target.value;
                  setReRankerModelId(newModelId);
                  savePipeline({ reRankerModelId: newModelId });
                  if (useReRanker) await toggleReRanker(true, newModelId);
                }} />
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
            <Row label="Chunking" value="Heading-basiert (Fallback: 400W, 75 Overlap)" />
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
