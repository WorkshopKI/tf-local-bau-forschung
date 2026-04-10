import { useState, useEffect, useRef } from 'react';
import { FlaskConical, Square, Trash2, RefreshCw } from 'lucide-react';
import { Button, Badge, ProgressBar } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import {
  METADATA_LLM_MODELS, initMetadataLLM, extractMetadata, disposeMetadataLLM,
  METADATA_SYSTEM_PROMPT, buildExtractionPrompt,
} from '@/core/services/search/metadata-extractor';
import type { DocumentMetadata, MetadataModelConfig } from '@/core/services/search/metadata-extractor';
import { embeddingService } from '@/core/services/search/embedding-service';
import { disposeReRanker } from '@/core/services/search/re-ranker';
import { Row } from './IndexHelpers';
import { validateMetadata } from './smoke-test-validation';
import type { ValidationResult } from './smoke-test-validation';
import { formatDuration } from './IndexHelpers';
import { SmokeTestChunkPreview } from './SmokeTestChunkPreview';

type TestPhase = 'idle' | 'loading-model' | 'testing' | 'done' | 'error';

interface DocResult {
  index: number;
  filename: string;
  markdown: string;
  docId: string;
  metadata: DocumentMetadata;
  validation: ValidationResult;
  inferenceMs: number;
}

interface PipelineCfg { metadataLLMId: string; metadataPreferGPU?: boolean; metadataContext?: number }

export function MetadataSmokeTest(): React.ReactElement | null {
  const storage = useStorage();
  const [metadataLLMId, setMetadataLLMId] = useState<string | null>(null);
  const [phase, setPhase] = useState<TestPhase>('idle');
  const [modelProgress, setModelProgress] = useState('');
  const [modelLoadMs, setModelLoadMs] = useState(0);
  const [results, setResults] = useState<DocResult[]>([]);
  const [currentDoc, setCurrentDoc] = useState(0);
  const [totalDocs, setTotalDocs] = useState(0);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [errorMsg, setErrorMsg] = useState('');
  const [gpuMsg, setGpuMsg] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const abortRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    const readCfg = (): void => {
      storage.idb.get<PipelineCfg>('pipeline-config').then(cfg =>
        mountedRef.current && setMetadataLLMId(cfg?.metadataLLMId ?? 'none'),
      );
    };
    readCfg();
    const id = setInterval(readCfg, 2000);
    return () => { mountedRef.current = false; clearInterval(id); };
  }, []);

  if (metadataLLMId === null || metadataLLMId === 'none') return null;

  const modelCfg = METADATA_LLM_MODELS.find(m => m.id === metadataLLMId);
  const modelLabel = modelCfg?.label ?? metadataLLMId;

  const runTest = async (): Promise<void> => {
    setPhase('loading-model'); setResults([]); setErrorMsg(''); abortRef.current = false;
    const t0 = Date.now();
    try {
      const pipelineCfg = await storage.idb.get<PipelineCfg>('pipeline-config');
      const isLocal = modelCfg && modelCfg.maxParallelism <= 1;
      const contextTokens = isLocal ? 8192 : (pipelineCfg?.metadataContext ?? 8192);
      const ok = await initMetadataLLM(metadataLLMId, msg => { if (mountedRef.current) setModelProgress(msg); },
        { idb: storage.idb });
      if (!mountedRef.current) return;
      setModelLoadMs(Date.now() - t0);
      if (!ok) { setPhase('error'); setErrorMsg('LLM konnte nicht geladen werden.'); return; }

      setPhase('testing');
      const keys = await storage.idb.keys('doc:');
      const testKeys = keys.slice(0, 10);
      setTotalDocs(testKeys.length);
      if (testKeys.length === 0) { setPhase('error'); setErrorMsg('Keine Dokumente vorhanden.'); disposeMetadataLLM(); return; }

      for (let i = 0; i < testKeys.length; i++) {
        if (!mountedRef.current || abortRef.current) break;
        setCurrentDoc(i + 1);
        const key = testKeys[i]!;
        const doc = await storage.idb.get<{ id: string; filename: string; markdown: string }>(key);
        if (!doc) continue;
        const start = performance.now();
        const metadata = await extractMetadata(doc.filename, doc.markdown, contextTokens);
        const inferenceMs = Math.round(performance.now() - start);
        const validation = validateMetadata(metadata, doc.filename, doc.markdown);
        if (mountedRef.current) {
          setResults(prev => [...prev, {
            index: i, filename: doc.filename, markdown: doc.markdown,
            docId: doc.id, metadata, validation, inferenceMs,
          }]);
        }
        await new Promise(r => setTimeout(r, 100));
      }
      disposeMetadataLLM();
      if (mountedRef.current) setPhase(abortRef.current ? 'idle' : 'done');
    } catch (err) {
      disposeMetadataLLM();
      if (mountedRef.current) { setPhase('error'); setErrorMsg(String(err)); }
    }
  };

  const unloadAllGPU = (): void => {
    const unloaded: string[] = [];
    disposeMetadataLLM(); unloaded.push('Metadata-LLM');
    if (embeddingService.isReady()) { embeddingService.destroy(); unloaded.push('Embedding'); }
    try { disposeReRanker(); unloaded.push('Re-Ranker'); } catch { /* nicht geladen */ }
    const msg = unloaded.length > 0
      ? `Entladen: ${unloaded.join(', ')}`
      : 'Keine GPU-Modelle geladen';
    setGpuMsg(msg);
    setTimeout(() => { if (mountedRef.current) setGpuMsg(null); }, 4000);
  };

  const avgScore = results.length > 0 ? Math.round(results.reduce((s, r) => s + r.validation.score, 0) / results.length) : 0;
  const avgTime = results.length > 0 ? Math.round(results.reduce((s, r) => s + r.inferenceMs, 0) / results.length) : 0;
  const totalTime = results.reduce((s, r) => s + r.inferenceMs, 0);
  const llmCount = results.filter(r => !r.validation.isFallback).length;
  const fallbackCount = results.filter(r => r.validation.isFallback).length;
  const firstGoodDoc = results.find(r => r.validation.score >= 70);

  return (
    <div className="py-4" style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
      <div className="flex items-center justify-between mb-2 pb-1.5"
        style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
        <span className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--tf-text)]">Metadata Smoke-Test</span>
        <span className="text-[11px] text-[var(--tf-text-secondary)]">{modelLabel}</span>
      </div>

      {phase === 'idle' && (
        <div className="space-y-2">
          <p className="text-[11px] text-[var(--tf-text-tertiary)]">
            Testet die LLM-Metadata-Extraktion an den ersten 10 Dokumenten, ohne den Index zu verändern.
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" icon={FlaskConical} onClick={runTest}>
              Metadata-Test starten
            </Button>
            <Button variant="secondary" size="sm" icon={Trash2} onClick={unloadAllGPU}>
              GPU-Modelle entladen
            </Button>
          </div>
          {gpuMsg && <p className="text-[11px] text-[var(--tf-text-secondary)]">{gpuMsg}</p>}
        </div>
      )}

      {/* Erweiterte Einstellungen */}
      <MetadataDetails modelCfg={modelCfg ?? null} />

      {phase === 'loading-model' && (
        <div className="space-y-2">
          <div className="flex justify-between text-[12px] text-[var(--tf-text-secondary)]">
            <span>Modell laden...</span>
            <span className="font-mono">{modelProgress}</span>
          </div>
          <ProgressBar value={0} />
          <Button variant="danger" size="sm" icon={Square} onClick={() => { abortRef.current = true; }}>Abbrechen</Button>
        </div>
      )}

      {phase === 'testing' && (
        <div className="space-y-2">
          <div className="flex justify-between text-[12px] text-[var(--tf-text-secondary)]">
            <span>Dokument {currentDoc}/{totalDocs}</span>
            <span className="font-mono">{Math.round((currentDoc / totalDocs) * 100)}%</span>
          </div>
          <ProgressBar value={totalDocs > 0 ? currentDoc / totalDocs : 0} />
          <Button variant="danger" size="sm" icon={Square} onClick={() => { abortRef.current = true; }}>Abbrechen</Button>
        </div>
      )}

      {phase === 'error' && (
        <div className="p-3 bg-[var(--tf-error-bg)] rounded-[var(--tf-radius)] space-y-2">
          <p className="text-[12px] text-[var(--tf-error-text)]">{errorMsg}</p>
          <Button variant="secondary" size="sm" onClick={() => setPhase('idle')}>Zurück</Button>
        </div>
      )}

      {(phase === 'done' || (phase === 'testing' && results.length > 0)) && (
        <SmokeTestResults
          results={results} avgScore={avgScore} avgTime={avgTime}
          totalTime={totalTime} modelLoadMs={modelLoadMs} modelLabel={modelLabel}
          llmCount={llmCount} fallbackCount={fallbackCount}
          expandedRows={expandedRows} setExpandedRows={setExpandedRows}
          isDone={phase === 'done'}
        />
      )}

      {phase === 'done' && (
        <div className="flex gap-2 mt-3">
          <Button variant="secondary" size="sm" icon={RefreshCw} onClick={runTest}>
            Test neu starten
          </Button>
          <Button variant="secondary" size="sm" icon={Trash2} onClick={unloadAllGPU}>
            GPU-Modelle entladen
          </Button>
          {gpuMsg && <span className="text-[11px] text-[var(--tf-text-secondary)] self-center">{gpuMsg}</span>}
        </div>
      )}

      {phase === 'done' && firstGoodDoc && (
        <SmokeTestChunkPreview
          docId={firstGoodDoc.docId} filename={firstGoodDoc.filename}
          markdown={firstGoodDoc.markdown} metadata={firstGoodDoc.metadata}
        />
      )}
    </div>
  );
}

/* ── Results sub-component (keeps main component under 300 lines) ── */
function SmokeTestResults({ results, avgScore, avgTime, totalTime, modelLoadMs, modelLabel,
  llmCount, fallbackCount, expandedRows, setExpandedRows, isDone,
}: {
  results: DocResult[]; avgScore: number; avgTime: number; totalTime: number;
  modelLoadMs: number; modelLabel: string; llmCount: number; fallbackCount: number;
  expandedRows: Set<number>; setExpandedRows: (s: Set<number>) => void; isDone: boolean;
}): React.ReactElement {
  return (
    <div className="space-y-3 mt-3">
      {isDone && (
        <div className="p-3 bg-[var(--tf-bg-secondary)] rounded-[var(--tf-radius)] space-y-1">
          <p className="text-[12px] font-medium text-[var(--tf-text)]">
            {modelLabel} — {results.length} Dokumente
          </p>
          <div className="flex gap-4 text-[11px] text-[var(--tf-text-secondary)]">
            <span>Ø Score: <span className="font-mono">{avgScore}/100</span></span>
            <span>LLM: {llmCount} · Fallback: {fallbackCount}</span>
          </div>
          <div className="flex gap-4 text-[11px] text-[var(--tf-text-tertiary)]">
            <span>Ø Inferenz: <span className="font-mono">{formatDuration(avgTime)}</span>/Dok</span>
            <span>Gesamt: <span className="font-mono">{formatDuration(totalTime)}</span></span>
            <span>LLM-Ladezeit: <span className="font-mono">{formatDuration(modelLoadMs)}</span></span>
          </div>
        </div>
      )}

      <table className="w-full text-[11px] table-fixed">
        <colgroup>
          <col className="w-[24px]" />
          <col className="w-[15%]" />
          <col className="w-[22%]" />
          <col className="w-[25%]" />
          <col className="w-[36px]" />
          <col className="w-[44px]" />
          <col className="w-[44px]" />
          <col className="w-[60px]" />
        </colgroup>
        <thead>
          <tr className="text-left text-[var(--tf-text-tertiary)]" style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
            <th className="py-1 pr-2 font-medium">#</th>
            <th className="py-1 pr-2 font-medium">Datei</th>
            <th className="py-1 pr-2 font-medium">doc_type</th>
            <th className="py-1 pr-2 font-medium">title</th>
            <th className="py-1 pr-2 font-medium">Tags</th>
            <th className="py-1 pr-2 font-medium text-right">Score</th>
            <th className="py-1 pr-2 font-medium text-right">Zeit</th>
            <th className="py-1 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r, i) => (
            <ResultRow key={i} result={r} index={i}
              expanded={expandedRows.has(i)}
              onToggle={() => {
                const next = new Set(expandedRows);
                if (next.has(i)) next.delete(i); else next.add(i);
                setExpandedRows(next);
              }} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ score, isFallback }: { score: number; isFallback: boolean }): React.ReactElement {
  if (isFallback) return <Badge variant="default">Fallback</Badge>;
  if (score >= 60) return <Badge variant="success">OK</Badge>;
  if (score >= 30) return <Badge variant="warning">Teilweise</Badge>;
  return <Badge variant="error">Schlecht</Badge>;
}

function ResultRow({ result, index, expanded, onToggle }: {
  result: DocResult; index: number; expanded: boolean; onToggle: () => void;
}): React.ReactElement {
  const r = result;
  const tags = r.metadata.topic_tags?.length ?? 0;
  return (
    <>
      <tr className="cursor-pointer hover:bg-[var(--tf-bg-secondary)]"
        style={{ borderBottom: '0.5px solid var(--tf-border)' }} onClick={onToggle}>
        <td className="py-1.5 pr-2 font-mono text-[var(--tf-text-tertiary)]">{index + 1}</td>
        <td className="py-1.5 pr-2 text-[var(--tf-text)] truncate overflow-hidden">{r.filename}</td>
        <td className="py-1.5 pr-2 text-[var(--tf-text-secondary)] break-words">{r.metadata.doc_type}</td>
        <td className="py-1.5 pr-2 text-[var(--tf-text)] break-words">{r.metadata.title}</td>
        <td className="py-1.5 pr-2 text-[var(--tf-text-tertiary)]">{tags}</td>
        <td className="py-1.5 pr-2 text-right font-mono">{r.validation.score}</td>
        <td className="py-1.5 pr-2 text-right font-mono text-[var(--tf-text-tertiary)]">{formatDuration(r.inferenceMs)}</td>
        <td className="py-1.5"><StatusBadge score={r.validation.score} isFallback={r.validation.isFallback} /></td>
      </tr>
      {expanded && (
        <tr><td colSpan={8} className="pb-3">
          <div className="p-3 bg-[var(--tf-bg-secondary)] rounded-[var(--tf-radius)] space-y-2 mt-1">
            {r.validation.issues.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-[var(--tf-text-secondary)] mb-1">Issues</p>
                <ul className="text-[11px] text-[var(--tf-text-tertiary)] list-disc list-inside">
                  {r.validation.issues.map((issue, j) => <li key={j}>{issue}</li>)}
                </ul>
              </div>
            )}
            <details className="text-[11px] text-[var(--tf-text-tertiary)]">
              <summary className="cursor-pointer hover:text-[var(--tf-text-secondary)]">JSON-Ausgabe</summary>
              <pre className="mt-1 text-[10px] font-mono whitespace-pre-wrap overflow-x-auto">
                {JSON.stringify(r.metadata, null, 2)}
              </pre>
            </details>
            <details className="text-[11px] text-[var(--tf-text-tertiary)]">
              <summary className="cursor-pointer hover:text-[var(--tf-text-secondary)]">Text-Ausschnitt (500 Zeichen)</summary>
              <p className="mt-1 text-[10px] font-mono whitespace-pre-wrap">{r.markdown.slice(0, 500)}</p>
            </details>
          </div>
        </td></tr>
      )}
    </>
  );
}

/* ── Technical details collapsible ── */
function MetadataDetails({ modelCfg }: { modelCfg: MetadataModelConfig | null }): React.ReactElement {
  const samplePrompt = buildExtractionPrompt('[...Dokumenttext...]');
  return (
    <details className="text-[11px] text-[var(--tf-text-tertiary)]">
      <summary className="cursor-pointer hover:text-[var(--tf-text-secondary)]">Erweiterte Einstellungen</summary>
      <div className="mt-3 space-y-3 p-3 bg-[var(--tf-bg-secondary)] rounded-[var(--tf-radius)]">
        <div>
          <p className="text-[11px] text-[var(--tf-text-tertiary)] mb-1">Modell</p>
          <Row label="Modell-ID" value={modelCfg?.openRouterId ?? '—'} />
          <Row label="Label" value={modelCfg?.label ?? '—'} />
          <Row label="Reasoning" value={modelCfg?.requiresReasoning ? 'Ja (effort: low)' : 'Nein'} />
        </div>
        <div className="pt-2" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
          <p className="text-[11px] text-[var(--tf-text-tertiary)] mb-1">System-Prompt</p>
          <pre className="text-[10px] font-mono whitespace-pre-wrap text-[var(--tf-text)]">{METADATA_SYSTEM_PROMPT}</pre>
        </div>
        <div className="pt-2" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
          <p className="text-[11px] text-[var(--tf-text-tertiary)] mb-1">User-Prompt (Template)</p>
          <pre className="text-[10px] font-mono whitespace-pre-wrap text-[var(--tf-text)] max-h-[200px] overflow-y-auto">{samplePrompt}</pre>
        </div>
        <div className="pt-2" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
          <p className="text-[11px] text-[var(--tf-text-tertiary)] mb-1">Pipeline</p>
          <Row label="Text-Limit" value="Smart Trim (Anfang + Headings + Ende)" />
          <Row label="Testumfang" value="Erste 10 Dokumente aus IDB" />
          <Row label="Caching" value="IDB (metadata-cache:{docId})" />
        </div>
      </div>
    </details>
  );
}
