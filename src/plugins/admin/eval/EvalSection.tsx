import { useState, useEffect } from 'react';
import { FlaskConical } from 'lucide-react';
import { Button, CollapsibleSection, ProgressBar } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import { FulltextSearch } from '@/core/services/search/fulltext';
import { VectorStore } from '@/core/services/search/vector-store';
import { QueryEmbedder } from '@/core/services/search/query-embedder';
import { HybridSearch } from '@/core/services/search/hybrid-search';
import { EvalRunner } from '@/core/services/search/eval/eval-runner';
import { getModelById } from '@/core/services/search/model-registry';
import type { EvalReport, EvalProgress } from '@/core/services/search/eval/eval-types';
import { evalToMarkdown } from '@/core/services/search/eval/eval-export';
import { EvalResultView } from './EvalResultView';

const MAX_HISTORY = 20;

interface EvalSectionProps {
  chunkCount: number;
  modelId: string;
}

export function EvalSection({ chunkCount, modelId }: EvalSectionProps): React.ReactElement {
  const storage = useStorage();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<EvalProgress | null>(null);
  const [report, setReport] = useState<EvalReport | null>(null);
  const [previousReport, setPreviousReport] = useState<EvalReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    storage.idb.get<EvalReport>('eval-latest').then(r => { if (r) setReport(r); });
    storage.idb.get<EvalReport[]>('eval-history').then(h => {
      if (h && h.length > 0) setPreviousReport(h[0] ?? null);
    });
  }, [storage]);

  const startEval = async (): Promise<void> => {
    setRunning(true); setProgress(null); setError(null);
    try {
      const fulltext = new FulltextSearch();
      const indexJson = await storage.idb.get<string>('search-index');
      if (indexJson) fulltext.importIndex(indexJson);

      const vectorStore = new VectorStore();
      await vectorStore.loadFromStorage(storage.idb);

      const model = getModelById(modelId);
      const queryEmbedder = new QueryEmbedder();
      await queryEmbedder.init(model);

      const hybridSearch = new HybridSearch(fulltext, vectorStore, queryEmbedder);
      const runner = new EvalRunner(hybridSearch, modelId);
      const result = await runner.run(setProgress);

      result.totalChunks = vectorStore.getChunkCount();
      result.totalDocs = fulltext.getDocumentCount();

      const oldLatest = await storage.idb.get<EvalReport>('eval-latest');
      if (oldLatest) setPreviousReport(oldLatest);

      await storage.idb.set('eval-latest', result);
      const history = await storage.idb.get<EvalReport[]>('eval-history') ?? [];
      history.unshift(result);
      if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
      await storage.idb.set('eval-history', history);

      if (storage.fs) {
        try { await storage.fs.writeFile('EVAL_REPORT.md', evalToMarkdown(result)); }
        catch { /* ignore */ }
      }
      setReport(result);
    } catch (err) {
      setError(String(err)); console.error('Eval failed:', err);
    } finally { setRunning(false); }
  };

  const subtitle = report
    ? `${report.summary.passed}/${report.summary.total} bestanden`
    : 'Noch nicht geprueft';

  const pct = progress && progress.total > 0 ? progress.current / progress.total : 0;

  return (
    <CollapsibleSection label="Suchqualitaet pruefen" defaultOpen={true} subtitle={subtitle}>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="secondary" icon={FlaskConical}
            disabled={running || chunkCount === 0} onClick={startEval}>
            {running ? 'Pruefe...' : 'Qualitaet pruefen'}
          </Button>
          {chunkCount === 0 && !running && (
            <span className="text-[11px] text-[var(--tf-warning-text)]">Erst indexieren</span>
          )}
        </div>

        {running && progress && (
          <div className="space-y-2">
            <div className="flex justify-between text-[12px] text-[var(--tf-text-secondary)]">
              <span>Query {progress.current}/{progress.total} — {progress.currentQuery}</span>
              <span>{Math.round(pct * 100)}%</span>
            </div>
            <ProgressBar value={pct} />
          </div>
        )}

        {error && !running && (
          <div className="p-3 bg-[var(--tf-error-bg)] rounded-[var(--tf-radius)]">
            <p className="text-[12px] text-[var(--tf-error-text)]">{error}</p>
          </div>
        )}

        {report && !running && (
          <EvalResultView report={report} previousReport={previousReport ?? undefined} />
        )}
      </div>
    </CollapsibleSection>
  );
}
