/**
 * Orchestrator der KI-Analyse.
 *
 * Seit dem Begründung-Umbau ist die Pipeline einstufig: Sie ERSETZT die
 * Suchtreffer NICHT mehr (kein eigenes Retrieval, keine dynamischen Spalten),
 * sondern annotiert die ÜBERGEBENEN Treffer mit einer per-Treffer-Begründung.
 * SuchSeite legt das Ergebnis (`begruendungById`) per `r.id` über die
 * bestehende Tabelle und blendet genau EINE zusätzliche Spalte „Begründung" ein.
 *
 * Caller verschafft sich `AITransport` via `useAIBridge().getActiveTransport()`
 * und übergibt ihn der Pipeline. Bei Abbruch via `signal` wirft sie `LLMAbortError`.
 */
import type { AITransport } from '@/core/services/ai/transports/streamlit';
import type { UnifiedSearchResult } from '@/core/types/search-result';
import { stageBegruendung } from './stages/begruendung';
import { LLMAbortError } from './llm-client';

export type PipelineStage = 'idle' | 'begruendung' | 'done' | 'error' | 'cancelled';

export const STAGE_LABELS: Record<PipelineStage, string> = {
  'idle': 'Bereit',
  'begruendung': 'Begründungen erstellen',
  'done': 'Abgeschlossen',
  'error': 'Fehler',
  'cancelled': 'Abgebrochen',
};

export interface PipelineProgress {
  stage: PipelineStage;
  stageLabel: string;
  overallProgress: number;
  currentBatch?: number;
  totalBatches?: number;
  resultCount?: number;
  warnings?: string[];
  error?: string;
}

export interface PipelineResult {
  /** Map `UnifiedSearchResult.id` → Begründung. Overlay über die bestehenden
   *  Treffer; nicht jeder Treffer muss enthalten sein. */
  begruendungById: Record<string, string>;
  warnings: string[];
  stats: {
    resultCount: number;
    annotatedCount: number;
    batchesSent: number;
    failedBatches: number;
    durationMs: number;
    tokensUsedEstimate: number;
  };
  finalStage: PipelineStage;
}

export interface RunPipelineOpts {
  /** Such-/Analysefrage (Kontext für die Begründungen). */
  question: string;
  /** Die zu annotierenden Treffer (genau das, was der User sieht — bereits
   *  gefiltert/begrenzt vom Caller). */
  results: ReadonlyArray<UnifiedSearchResult>;
  /** Editierte Anweisung aus dem Prompt-Dialog. */
  promptOverride: string;
  transport: AITransport;
  signal: AbortSignal;
  onProgress: (p: PipelineProgress) => void;
  /** Teil-Ergebnisse nach jedem Batch (progressives Füllen der Spalte). */
  onPartial?: (begruendungById: Record<string, string>) => void;
}

export async function runAnalysisPipeline(opts: RunPipelineOpts): Promise<PipelineResult> {
  const { question, results, promptOverride, transport, signal, onProgress, onPartial } = opts;
  const startedAt = Date.now();
  const warnings: string[] = [];

  function emit(p: Omit<PipelineProgress, 'stageLabel'>): void {
    onProgress({ ...p, stageLabel: STAGE_LABELS[p.stage] });
  }

  try {
    emit({ stage: 'begruendung', overallProgress: 0, resultCount: results.length });

    const res = await stageBegruendung({
      transport,
      query: question,
      instruction: promptOverride,
      results,
      signal,
      onBatchProgress: (current, total) => emit({
        stage: 'begruendung',
        overallProgress: total > 0 ? current / total : 0,
        currentBatch: current,
        totalBatches: total,
        resultCount: results.length,
      }),
      onPartial,
    });

    if (res.failedBatches > 0) {
      warnings.push(`${res.failedBatches} von ${res.totalBatches} Batches konnten nicht ausgewertet werden.`);
    }

    emit({ stage: 'done', overallProgress: 1, resultCount: results.length, warnings: [...warnings] });

    return {
      begruendungById: res.begruendungById,
      warnings,
      stats: {
        resultCount: results.length,
        annotatedCount: Object.keys(res.begruendungById).length,
        batchesSent: res.totalBatches,
        failedBatches: res.failedBatches,
        durationMs: Date.now() - startedAt,
        tokensUsedEstimate: res.tokensUsedEstimate,
      },
      finalStage: 'done',
    };
  } catch (err) {
    const isAbort = err instanceof LLMAbortError || (err as Error).name === 'AbortError' || signal.aborted;
    if (isAbort) {
      emit({ stage: 'cancelled', overallProgress: 0, warnings: [...warnings] });
    } else {
      console.error('[runAnalysisPipeline] error:', err);
      emit({ stage: 'error', overallProgress: 0, error: (err as Error).message ?? 'Unbekannter Fehler', warnings: [...warnings] });
    }
    throw err;
  }
}
