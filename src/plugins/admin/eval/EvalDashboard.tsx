import { useState, useEffect } from 'react';
import { FlaskConical } from 'lucide-react';
import { Button, Badge, SectionHeader } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import { FulltextSearch } from '@/core/services/search/fulltext';
import { VectorStore } from '@/core/services/search/vector-store';
import { QueryEmbedder } from '@/core/services/search/query-embedder';
import { HybridSearch } from '@/core/services/search/hybrid-search';
import { EvalRunner } from '@/core/services/search/eval/eval-runner';
import type { EvalReport, EvalProgress } from '@/core/services/search/eval/eval-types';
import { evalToMarkdown } from '@/core/services/search/eval/eval-export';
import { EvalResultView } from './EvalResultView';

const MAX_HISTORY = 20;

export function EvalDashboard(): React.ReactElement {
  const storage = useStorage();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<EvalProgress | null>(null);
  const [report, setReport] = useState<EvalReport | null>(null);
  const [previousReport, setPreviousReport] = useState<EvalReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chunkCount, setChunkCount] = useState(0);

  useEffect(() => {
    storage.idb.get<EvalReport>('eval-latest').then(r => { if (r) setReport(r); });
    storage.idb.get<EvalReport[]>('eval-history').then(h => {
      if (h && h.length > 0) setPreviousReport(h[0] ?? null);
    });
    storage.idb.get<unknown[]>('vector-chunks').then(c => setChunkCount(c?.length ?? 0));
  }, [storage]);

  const startEval = async (): Promise<void> => {
    setRunning(true);
    setProgress(null);
    setError(null);

    try {
      // Suchinfrastruktur aufbauen
      const fulltext = new FulltextSearch();
      const indexJson = await storage.idb.get<string>('search-index');
      if (indexJson) fulltext.importIndex(indexJson);

      const vectorStore = new VectorStore();
      await vectorStore.loadFromStorage(storage.idb);

      const queryEmbedder = new QueryEmbedder();
      await queryEmbedder.init();

      const hybridSearch = new HybridSearch(fulltext, vectorStore, queryEmbedder);
      const runner = new EvalRunner(hybridSearch);

      const result = await runner.run(setProgress);

      // Metadaten ergaenzen
      result.totalChunks = vectorStore.getChunkCount();
      result.totalDocs = fulltext.getDocumentCount();

      // Persistenz
      const oldLatest = await storage.idb.get<EvalReport>('eval-latest');
      if (oldLatest) setPreviousReport(oldLatest);

      await storage.idb.set('eval-latest', result);

      const history = await storage.idb.get<EvalReport[]>('eval-history') ?? [];
      history.unshift(result);
      if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
      await storage.idb.set('eval-history', history);

      // FS-Export wenn verbunden
      if (storage.fs) {
        try {
          await storage.fs.writeFile('EVAL_REPORT.md', evalToMarkdown(result));
        } catch { /* FS-Schreibfehler ignorieren */ }
      }

      setReport(result);
    } catch (err) {
      setError(String(err));
      console.error('Eval failed:', err);
    } finally {
      setRunning(false);
    }
  };

  const pct = progress && progress.total > 0
    ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="mt-6">
      <SectionHeader label="Suche Evaluierung" />
      <div className="mt-3 space-y-4">
        <p className="text-[12px] text-[var(--tf-text-secondary)]">
          Testet 20 Queries gegen den aktuellen Index (5 Keyword + 15 Semantisch)
        </p>

        <Button variant="secondary" icon={FlaskConical}
          disabled={running || chunkCount === 0} onClick={startEval}>
          {running ? 'Eval laeuft...' : 'Eval starten'}
        </Button>

        {chunkCount === 0 && !running && (
          <p className="text-[11px] text-[var(--tf-warning-text)]">
            Kein Index vorhanden. Bitte zuerst indexieren.
          </p>
        )}

        {running && progress && (
          <div className="space-y-2">
            <div className="flex justify-between text-[12px] text-[var(--tf-text-secondary)]">
              <span>Query {progress.current}/{progress.total} — {progress.currentQuery}</span>
              <span>{pct}%</span>
            </div>
            <div className="w-full h-1 bg-[var(--tf-bg-secondary)] rounded-sm overflow-hidden">
              <div className="h-full bg-[var(--tf-text)] rounded-sm transition-all"
                style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}

        {error && !running && (
          <div className="p-3 bg-[var(--tf-error-bg)] rounded-[var(--tf-radius)]">
            <p className="text-[12px] text-[var(--tf-error-text)]">{error}</p>
          </div>
        )}

        {report && !running && (
          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-2 text-[11px] text-[var(--tf-text-tertiary)]">
              <Badge variant="default">{new Date(report.timestamp).toLocaleString('de-DE')}</Badge>
              <span>{report.duration} ms</span>
              <span>{report.totalChunks} Chunks</span>
              <span>{report.totalDocs} Docs</span>
            </div>
            <EvalResultView report={report} previousReport={previousReport ?? undefined} />
          </div>
        )}
      </div>
    </div>
  );
}
