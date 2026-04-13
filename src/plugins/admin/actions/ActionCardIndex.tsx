import { useState, useRef } from 'react';
import { Database, RefreshCw, AlertCircle, Square, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import { BatchIndexer } from '@/core/services/search/batch-indexer';
import type { IndexStatus, PipelineConfig } from '@/core/services/search/batch-indexer';
import { getModelById } from '@/core/services/search/model-registry';
import { IndexProgress, formatDuration } from '../IndexHelpers';
import { DirectorySlot } from './DirectorySlot';
import type { PipelineConfigState } from '../hooks/usePipelineConfig';

interface ActionCardIndexProps {
  chunkCount: number;
  docCount: number;
  activeModelId: string;
  indexOutdated: boolean;
  hasGPU: boolean;
  newDocsCount: number;
  pipelineConfig: PipelineConfigState;
  setChunkCount: (n: number) => void;
  setLastUpdate: (s: string | null) => void;
  setIndexModelId: (s: string | null) => void;
  setNewDocsCount: (n: number) => void;
}

export function ActionCardIndex({
  chunkCount, docCount, activeModelId, indexOutdated, hasGPU, newDocsCount,
  pipelineConfig, setChunkCount, setLastUpdate, setIndexModelId, setNewDocsCount,
}: ActionCardIndexProps): React.ReactElement {
  const storage = useStorage();
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<IndexStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [indexResult, setIndexResult] = useState<{ chunks: number; docs: number; skipped: number; duration: string } | null>(null);
  const [aborted, setAborted] = useState(false);
  const abortRef = useRef(new AbortController());

  const runIndex = async (full: boolean): Promise<void> => {
    setRunning(true); setStatus(null); setError(null); setIndexResult(null); setAborted(false);
    abortRef.current = new AbortController();
    const startTime = Date.now();
    try {
      if (full) await storage.idb.delete('index-manifest');
      const indexer = new BatchIndexer();
      const model = getModelById(activeModelId);
      await indexer.init(model, hasGPU, setStatus);
      const cfg: PipelineConfig = {
        embeddingModelId: activeModelId,
        metadataLLMId: pipelineConfig.metadataLLMId !== 'none' ? pipelineConfig.metadataLLMId : null,
        metadataParallelism: pipelineConfig.metadataParallelism,
        metadataContext: pipelineConfig.metadataContext,
        metadataPreferGPU: pipelineConfig.metadataPreferGPU,
        useContextualPrefixes: pipelineConfig.useContextualPrefixes,
        useReRanker: pipelineConfig.useReRanker,
        resumeFromCheckpoint: !full,
      };
      const count = await indexer.indexAll(storage, cfg, setStatus, abortRef.current.signal);
      const elapsed = Date.now() - startTime;
      setChunkCount(count); setLastUpdate(new Date().toISOString());
      setIndexModelId(activeModelId); setNewDocsCount(0);
      await storage.idb.set('index-pipeline-config', { contextualPrefixes: pipelineConfig.useContextualPrefixes });
      indexer.destroy();
      if (abortRef.current.signal.aborted) { setAborted(true); }
      else { setIndexResult({ chunks: count, docs: status?.total ?? 0, skipped: status?.skipped ?? 0, duration: formatDuration(elapsed) }); }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setAborted(true); setLastUpdate(new Date().toISOString());
      } else { setError(String(err)); console.error('Indexing failed:', err); }
    } finally { setRunning(false); }
  };

  const statusText = indexOutdated
    ? 'Modell gewechselt — Neu-Indexierung noetig'
    : newDocsCount > 0
      ? `${newDocsCount} neue Dokumente`
      : chunkCount > 0 ? `${chunkCount} Chunks — aktuell` : 'Nicht indexiert';

  return (
    <div className="space-y-2">
      <div className="p-[14px] rounded-[var(--tf-radius)] space-y-2"
        style={{ border: '0.5px solid var(--tf-border)' }}>
        <div>
          <p className="text-[13px] font-medium text-[var(--tf-text)]">Index aktualisieren</p>
          <p className="text-[12px] text-[var(--tf-text-secondary)]">{statusText}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!running ? (
            <>
              <Button variant="secondary" size="sm" icon={Database} disabled={docCount === 0}
                onClick={() => runIndex(false)}>Neue indexieren</Button>
              <Button variant="secondary" size="sm" icon={RefreshCw} disabled={docCount === 0}
                onClick={() => runIndex(true)}>Alle neu</Button>
            </>
          ) : (
            <Button variant="danger" size="sm" icon={Square}
              onClick={() => abortRef.current.abort()}>Abbrechen</Button>
          )}
        </div>
        {!running && <DirectorySlot type="data" label="Datenordner"
          badgeText="Geteilter Speicher" badgeVariant="success" />}
      </div>

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
          <Button variant="secondary" size="sm" onClick={() => runIndex(true)}>Erneut versuchen</Button>
        </div>
      )}
    </div>
  );
}
