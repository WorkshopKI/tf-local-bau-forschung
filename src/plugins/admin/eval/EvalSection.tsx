import { useState, useEffect } from 'react';
import { FlaskConical } from 'lucide-react';
import { Button, ProgressBar, Select } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import { loadOramaFromDB, getDocCount } from '@/core/services/search/orama-store';
import { embeddingService } from '@/core/services/search/embedding-service';
import { getModelById } from '@/core/services/search/model-registry';
import { EvalRunner } from '@/core/services/search/eval/eval-runner';
import { EVAL_SUITES, getSuiteById } from '@/core/services/search/eval/eval-suites';
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
  const [suiteId, setSuiteId] = useState('alle');

  useEffect(() => {
    storage.idb.get<EvalReport>('eval-latest').then(r => { if (r) setReport(r); });
    storage.idb.get<EvalReport[]>('eval-history').then(h => {
      if (h && h.length > 0) setPreviousReport(h[0] ?? null);
    });
  }, [storage]);

  const startEval = async (): Promise<void> => {
    setRunning(true); setProgress(null); setError(null);
    try {
      const model = getModelById(modelId);
      await loadOramaFromDB(storage.idb);

      if (!embeddingService.isReady()) {
        let gpuAvailable = false;
        if ('gpu' in navigator) {
          try {
            gpuAvailable = !!(await (navigator as { gpu: { requestAdapter: () => Promise<unknown> } }).gpu.requestAdapter());
          } catch { /* no GPU */ }
        }
        await embeddingService.init(model, gpuAvailable);
      }

      const suite = getSuiteById(suiteId);
      const runner = new EvalRunner(modelId);
      const result = await runner.run(suite.cases, setProgress);

      result.suiteId = suite.id;
      result.suiteLabel = suite.label;
      result.totalChunks = chunkCount;
      result.totalDocs = getDocCount();

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

  const pct = progress && progress.total > 0 ? progress.current / progress.total : 0;

  return (
      <div className="space-y-4">
        <div className="flex items-end gap-3">
          <div className="w-56">
            <Select
              options={EVAL_SUITES.map(s => ({ value: s.id, label: `${s.label} (${s.cases.length})` }))}
              value={suiteId} onChange={e => setSuiteId(e.target.value)} />
          </div>
          <Button variant="secondary" icon={FlaskConical}
            disabled={running || chunkCount === 0} onClick={startEval}>
            {running ? 'Pruefe...' : 'Pruefen'}
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
          <>
            <EvalResultView report={report} previousReport={previousReport ?? undefined} />
            {report.summary.passed === report.summary.total ? (
              <p className="text-[12px] text-[var(--tf-success-text)] mt-2">
                Alle Tests bestanden — die Suche funktioniert wie erwartet.
              </p>
            ) : report.summary.passed >= report.summary.total - 2 ? (
              <p className="text-[12px] text-[var(--tf-text-secondary)] mt-2">
                Fast alle Tests bestanden. Klappen Sie die fehlgeschlagenen Tests auf um Details zu sehen.
              </p>
            ) : (
              <p className="text-[12px] text-[var(--tf-warning-text)] mt-2">
                Mehrere Tests fehlgeschlagen. Pruefen Sie ob das richtige Modell gewaehlt ist und der Index aktuell ist.
              </p>
            )}
          </>
        )}
      </div>
  );
}
