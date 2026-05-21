/**
 * Vertikaler Stepper fuer die KI-Analyse-Pipeline. Zeigt 5 Stufen,
 * aktiver Schritt mit Spinner, fertige Schritte mit Check + Zeit.
 */
import { Check, Circle, Loader2, X } from 'lucide-react';
import { STAGE_ORDER, STAGE_LABELS, type PipelineProgress, type PipelineStage } from './analyse/pipeline';

export interface AnalysePipelineViewProps {
  progress: PipelineProgress;
  onCancel: () => void;
}

function formatDuration(ms: number | undefined): string {
  if (!ms || ms < 0) return '';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function stageStatus(stage: PipelineStage, current: PipelineStage): 'done' | 'active' | 'pending' {
  if (current === 'done') return 'done';
  if (current === 'error' || current === 'cancelled') {
    const idx = STAGE_ORDER.indexOf(stage);
    const curIdx = STAGE_ORDER.indexOf(stage);
    return idx <= curIdx ? 'done' : 'pending';
  }
  const idx = STAGE_ORDER.indexOf(stage);
  const curIdx = STAGE_ORDER.indexOf(current);
  if (idx < curIdx) return 'done';
  if (idx === curIdx) return 'active';
  return 'pending';
}

function stageDetail(stage: PipelineStage, p: PipelineProgress): string | null {
  if (stage === 'extraction' && p.currentBatch && p.totalBatches) {
    return `Batch ${p.currentBatch} von ${p.totalBatches}`;
  }
  if (stage === 'retrieval' && p.candidateCount !== undefined && stageStatus(stage, p.stage) === 'done') {
    return `${p.candidateCount} Kandidaten`;
  }
  if (stage === 'validation' && p.resultCount !== undefined && stageStatus(stage, p.stage) === 'active') {
    return `${p.resultCount} Ergebnisse`;
  }
  return null;
}

export function AnalysePipelineView({ progress, onCancel }: AnalysePipelineViewProps): React.ReactElement {
  const overallPct = Math.round(progress.overallProgress * 100);
  const errored = progress.stage === 'error';
  const cancelled = progress.stage === 'cancelled';

  return (
    <div className="max-w-2xl mx-auto py-8">
      <div className="mb-4">
        <p className="text-[13px] text-[var(--tf-text-secondary)]">
          KI-Analyse laeuft… {overallPct}%
        </p>
        <div className="mt-2 h-1 bg-[var(--tf-bg-secondary)] rounded overflow-hidden">
          <div
            className="h-full bg-[var(--tf-text)] transition-all duration-300"
            style={{ width: `${overallPct}%` }}
          />
        </div>
      </div>

      <ol className="space-y-3">
        {STAGE_ORDER.map(stage => {
          const status = stageStatus(stage, progress.stage);
          const detail = stageDetail(stage, progress);
          const duration = progress.stageDurations[stage];
          return (
            <li key={stage} className="flex items-center gap-3">
              <div className="w-5 h-5 flex items-center justify-center shrink-0">
                {status === 'done' && <Check size={16} className="text-[var(--tf-text)]" />}
                {status === 'active' && <Loader2 size={16} className="text-[var(--tf-text)] animate-spin" />}
                {status === 'pending' && <Circle size={14} className="text-[var(--tf-text-tertiary)]" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-[13px] ${status === 'pending' ? 'text-[var(--tf-text-tertiary)]' : 'text-[var(--tf-text)]'}`}>
                  {STAGE_LABELS[stage]}
                  {detail && <span className="text-[var(--tf-text-tertiary)]"> · {detail}</span>}
                </p>
              </div>
              {duration !== undefined && (
                <span className="text-[11px] font-mono text-[var(--tf-text-tertiary)]">
                  {formatDuration(duration)}
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {progress.warnings && progress.warnings.length > 0 && (
        <div
          className="mt-4 px-3 py-2 text-[12px] text-[var(--tf-text-secondary)] rounded"
          style={{ border: '0.5px solid var(--tf-border)', backgroundColor: 'var(--tf-bg-secondary)' }}
        >
          {progress.warnings.map((w, i) => <p key={i}>· {w}</p>)}
        </div>
      )}

      {errored && progress.error && (
        <div className="mt-4 px-3 py-2 text-[12px] text-[var(--tf-text)] rounded"
          style={{ border: '0.5px solid var(--tf-border)', backgroundColor: 'var(--tf-bg-secondary)' }}>
          Fehler: {progress.error}
        </div>
      )}

      {!errored && !cancelled && (
        <div className="mt-6">
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-[var(--tf-text)] rounded hover:bg-[var(--tf-hover)]"
            style={{ border: '0.5px solid var(--tf-border)' }}
          >
            <X size={14} />
            <span>Abbrechen</span>
          </button>
        </div>
      )}
    </div>
  );
}
