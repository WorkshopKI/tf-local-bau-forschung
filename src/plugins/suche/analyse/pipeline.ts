/**
 * Orchestrator der 5-stufigen KI-Analyse-Pipeline.
 *
 * Stufen:
 *  1. query-understanding  — LLM zerlegt die Frage
 *  2. retrieval            — Vorfilter + semantische Suche (kein LLM)
 *  3. extraction           — Batch-Calls fuer strukturierte Felder
 *  4. merging              — Pure Mapping auf UnifiedSearchResult (kein LLM)
 *  5. validation           — LLM-Qualitaetspruefung
 *
 * State-Machine — Datei darf > 300 LOC werden (CLAUDE.md, kohäsive
 * State-Machine). Aktuell unter Limit gehalten.
 *
 * Caller verschafft sich `AITransport` via `useAIBridge().getActiveTransport()`
 * und uebergibt ihn der Pipeline. Pipeline returnt im Erfolgsfall ein
 * `PipelineResult`; bei Abbruch via `signal` wirft sie `LLMAbortError`.
 */
import type { AITransport } from '@/core/services/ai/transports/streamlit';
import type { IDBStore } from '@/core/services/storage/idb-store';
import type { Antrag, Programm } from '@/core/services/csv/types';
import type { UnifiedSearchResult } from '@/core/types/search-result';
import { getAntrag } from '@/core/services/csv/idb-csv';
import { stageQueryUnderstanding, type QueryUnderstanding } from './stages/query-understanding';
import { stageRetrieval, type RetrievalResult } from './stages/retrieval';
import { stageBatchExtraction, type BatchExtractionResult } from './stages/batch-extraction';
import { mergeResults } from './stages/merge-results';
import { stageValidation, type ValidationResult } from './stages/validation';
import { LLMAbortError } from './llm-client';
import { buildProgrammNameToIdMap } from './antrag-schema';

export type PipelineStage =
  | 'idle' | 'query-understanding' | 'retrieval' | 'extraction'
  | 'merging' | 'validation' | 'done' | 'error' | 'cancelled';

export const STAGE_LABELS: Record<PipelineStage, string> = {
  'idle': 'Bereit',
  'query-understanding': 'Anfrage analysieren',
  'retrieval': 'Kandidaten finden',
  'extraction': 'Daten extrahieren',
  'merging': 'Ergebnisse zusammenfuehren',
  'validation': 'Qualitaetspruefung',
  'done': 'Abgeschlossen',
  'error': 'Fehler',
  'cancelled': 'Abgebrochen',
};

export const STAGE_ORDER: PipelineStage[] = [
  'query-understanding', 'retrieval', 'extraction', 'merging', 'validation',
];

export interface PipelineProgress {
  stage: PipelineStage;
  stageLabel: string;
  stageProgress: number;
  overallProgress: number;
  currentBatch?: number;
  totalBatches?: number;
  candidateCount?: number;
  resultCount?: number;
  warnings?: string[];
  error?: string;
  stageDurations: Partial<Record<PipelineStage, number>>;
}

export interface PipelineResult {
  results: UnifiedSearchResult[];
  validation: ValidationResult | null;
  understanding: QueryUnderstanding;
  warnings: string[];
  dynamicColumnKeys: string[];
  stats: {
    candidatesFound: number;
    resultsExtracted: number;
    batchesSent: number;
    failedBatches: number;
    durationMs: number;
    tokensUsedEstimate: number;
  };
  finalStage: PipelineStage;
}

export interface RunPipelineOpts {
  question: string;
  transport: AITransport;
  idb: IDBStore;
  programmId: string;
  programme: ReadonlyArray<Programm>;
  signal: AbortSignal;
  onProgress: (p: PipelineProgress) => void;
}

function stageWeight(stage: PipelineStage): number {
  // Stufe 3 (Batches) ist die teuerste — entsprechend hoeheres Gewicht
  // im Overall-Progress.
  switch (stage) {
    case 'query-understanding': return 0.1;
    case 'retrieval': return 0.15;
    case 'extraction': return 0.55;
    case 'merging': return 0.05;
    case 'validation': return 0.15;
    default: return 0;
  }
}

function overallFromStage(stage: PipelineStage, withinStage: number): number {
  let sum = 0;
  for (const s of STAGE_ORDER) {
    if (s === stage) { sum += stageWeight(s) * withinStage; break; }
    sum += stageWeight(s);
  }
  return Math.min(1, Math.max(0, sum));
}

async function loadFullAntraege(
  idb: IDBStore,
  aktenzeichen: string[],
  signal: AbortSignal,
): Promise<Map<string, Antrag>> {
  const out = new Map<string, Antrag>();
  // Sequential mit Yield alle 50 Records — wir laden bis zu 500 Records
  // und wollen den Main-Thread nicht blocken.
  for (let i = 0; i < aktenzeichen.length; i++) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    const akz = aktenzeichen[i]!;
    const a = await getAntrag(idb, akz);
    if (a) out.set(akz, a);
    if (i > 0 && i % 50 === 0) await new Promise(r => setTimeout(r, 0));
  }
  return out;
}

export async function runAnalysisPipeline(opts: RunPipelineOpts): Promise<PipelineResult> {
  const { question, transport, idb, programmId, programme, signal, onProgress } = opts;
  const stageDurations: Partial<Record<PipelineStage, number>> = {};
  const startedAt = Date.now();
  const warnings: string[] = [];

  function emit(p: Omit<PipelineProgress, 'stageLabel' | 'stageDurations'> & { stage: PipelineStage }): void {
    onProgress({
      ...p,
      stageLabel: STAGE_LABELS[p.stage],
      stageDurations: { ...stageDurations },
    });
  }

  let understanding: QueryUnderstanding;
  let retrieval: RetrievalResult;
  let extraction: BatchExtractionResult;
  let results: UnifiedSearchResult[] = [];
  let validation: ValidationResult | null = null;

  try {
    // Stufe 1
    emit({ stage: 'query-understanding', stageProgress: 0, overallProgress: 0 });
    let t = Date.now();
    understanding = await stageQueryUnderstanding({ transport, question, programme, signal });
    stageDurations['query-understanding'] = Date.now() - t;
    emit({ stage: 'query-understanding', stageProgress: 1, overallProgress: overallFromStage('retrieval', 0) });

    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

    // Stufe 2
    emit({ stage: 'retrieval', stageProgress: 0, overallProgress: overallFromStage('retrieval', 0) });
    t = Date.now();
    const programmNameToId = buildProgrammNameToIdMap(programme);
    retrieval = await stageRetrieval({ understanding, idb, programmId, programmNameToId, signal });
    stageDurations['retrieval'] = Date.now() - t;
    warnings.push(...retrieval.warnings);
    emit({
      stage: 'retrieval', stageProgress: 1,
      overallProgress: overallFromStage('extraction', 0),
      candidateCount: retrieval.candidates.length,
      warnings: [...warnings],
    });

    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

    // Stufe 3
    emit({
      stage: 'extraction', stageProgress: 0,
      overallProgress: overallFromStage('extraction', 0),
      candidateCount: retrieval.candidates.length,
    });
    t = Date.now();
    const fullAntraege = await loadFullAntraege(idb, retrieval.candidates.map(c => c.aktenzeichen), signal);
    extraction = await stageBatchExtraction({
      transport, question,
      candidates: retrieval.candidates,
      fullAntraege,
      gewuenschteSpalten: understanding.ausgabeFormat.gewuenschteSpalten,
      signal,
      onBatchProgress: (current, total) => emit({
        stage: 'extraction',
        stageProgress: total > 0 ? current / total : 0,
        overallProgress: overallFromStage('extraction', total > 0 ? current / total : 0),
        currentBatch: current,
        totalBatches: total,
        candidateCount: retrieval.candidates.length,
      }),
    });
    stageDurations['extraction'] = Date.now() - t;
    if (extraction.failedBatches > 0) {
      warnings.push(`${extraction.failedBatches} von ${extraction.totalBatches} Batches konnten nicht extrahiert werden.`);
    }

    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

    // Stufe 4
    emit({
      stage: 'merging', stageProgress: 0,
      overallProgress: overallFromStage('merging', 0),
      resultCount: 0,
    });
    t = Date.now();
    const programmNameById = new Map(programme.map(p => [p.id, p.name]));
    results = mergeResults({ candidates: retrieval.candidates, extraction, programmNameById });
    stageDurations['merging'] = Date.now() - t;

    // Stufe 5
    emit({
      stage: 'validation', stageProgress: 0,
      overallProgress: overallFromStage('validation', 0),
      resultCount: results.length,
    });
    t = Date.now();
    validation = await stageValidation({ transport, question, results, signal });
    stageDurations['validation'] = Date.now() - t;

    emit({
      stage: 'done', stageProgress: 1, overallProgress: 1,
      resultCount: results.length,
      warnings: [...warnings],
    });

    return {
      results,
      validation,
      understanding,
      warnings,
      dynamicColumnKeys: understanding.ausgabeFormat.gewuenschteSpalten,
      stats: {
        candidatesFound: retrieval.candidates.length,
        resultsExtracted: results.length,
        batchesSent: extraction.totalBatches,
        failedBatches: extraction.failedBatches,
        durationMs: Date.now() - startedAt,
        tokensUsedEstimate: extraction.tokensUsedEstimate,
      },
      finalStage: 'done',
    };
  } catch (err) {
    const isAbort = err instanceof LLMAbortError || (err as Error).name === 'AbortError' || signal.aborted;
    if (isAbort) {
      emit({ stage: 'cancelled', stageProgress: 0, overallProgress: 0, warnings: [...warnings] });
    } else {
      console.error('[runAnalysisPipeline] error:', err);
      emit({
        stage: 'error', stageProgress: 0, overallProgress: 0,
        error: (err as Error).message ?? 'Unbekannter Fehler',
        warnings: [...warnings],
      });
    }
    throw err;
  }
}
